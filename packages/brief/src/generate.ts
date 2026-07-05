import type { LlmPort } from '@rudy/ai';
import {
  insertBriefWithCards,
  memories,
  replaceBriefContent,
  users,
  type BriefCardInsert,
  type Db,
} from '@rudy/db';
import {
  SCORING,
  getTone,
  pickDiscoverySources,
  pickFallbackCards,
  type Locale,
  type ReasonCode,
} from '@rudy/shared';
import type { InferSelectModel } from 'drizzle-orm';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { DateTime } from 'luxon';
import { collectCandidates, type CandidateBundle, type MemoryRow } from './candidates';
import { composeBrief, type ComposeCandidate } from './compose';
import { checkUrlAlive } from './linkCheck';
import { writeCopy } from './reasonWriter';
import { cosine, feedbackRatio, pickReasonCode, scoreMemory, type ScoreInput } from './scoring';

export type UserRow = InferSelectModel<typeof users>;

export interface BriefDeps {
  db: Db;
  /** null이면 완전 결정적 생성 (동기 GET 경로 — API는 LLM 없이 엔진을 돌린다). */
  llm: LlmPort | null;
}

export type GenerateResult = 'created' | 'promoted' | 'skipped' | 'no_candidates';

const DAY_MS = 24 * 60 * 60 * 1000;
const LINK_CHECK_ROUNDS = 3;

/** 후보 전체를 스코어링해 ComposeCandidate 목록으로 변환. */
function buildCandidates(bundle: CandidateBundle, user: UserRow, local: DateTime): ComposeCandidate[] {
  const weekday = local.weekday;
  const now = local.toJSDate();
  const out: ComposeCandidate[] = [];

  for (const m of bundle.eligibleMemories) {
    let alignment = 0;
    let bestInterestId: string | null = null;
    let risingMatch = false;
    for (const i of bundle.activeInterests) {
      const sim = cosine(m.embedding as number[], i.centroid as number[]);
      if (sim > alignment) {
        alignment = sim;
        bestInterestId = i.id;
      }
      if (i.status === 'rising' && sim >= SCORING.interestMatchThreshold) risingMatch = true;
    }
    const input: ScoreInput = {
      intent: m.inferredIntent,
      weekday,
      ageDays: (now.getTime() - m.createdAt.getTime()) / DAY_MS,
      surfaceCount: m.surfaceCount,
      interestAlignment: alignment,
      risingMatch,
      feedbackRatio: feedbackRatio(bundle.topicStats, m.topics),
      hasLinks: bundle.linkedMemoryIds.has(m.id),
    };
    const { score, breakdown } = scoreMemory(input);
    out.push({
      key: m.id,
      cardType: 'rediscovery',
      memoryId: m.id,
      externalContent: null,
      score,
      breakdown,
      reasonCode: pickReasonCode(input, breakdown),
      interestId: bestInterestId,
    });
  }

  // Reflection ≤ 1장: momentum ≥ 0.5 rising interest (M5 전까진 자연히 0건).
  const rising = bundle.risingInterests[0];
  if (rising) {
    out.push({
      key: `reflection:${rising.id}`,
      cardType: 'reflection',
      memoryId: null,
      externalContent: { url: '', title: rising.name, thumbnail_url: null, source: 'reflection' },
      score: SCORING.baseScore.reflection,
      breakdown: null,
      reasonCode: 'rising_interest',
      interestId: rising.id,
    });
  }

  // Discovery: 콜드스타트 사용자(memory < 15) 또는 rediscovery 후보 부족 시 보충.
  // 온보딩 관심사 key 매칭, 미매칭이면 프리셋 전체 풀 (pickDiscoverySources).
  if (
    bundle.memoryCount < SCORING.coldstartMemoryThreshold ||
    bundle.eligibleMemories.length < SCORING.cards.min
  ) {
    const locale = user.locale as Locale;
    for (const { source: s } of pickDiscoverySources(user.onboardingInterests, locale, 4)) {
      out.push({
        key: s.url,
        cardType: 'discovery',
        memoryId: null,
        externalContent: { url: s.url, title: s.title, thumbnail_url: s.thumbnail_url, source: s.source },
        score: SCORING.baseScore.discovery,
        breakdown: null,
        reasonCode: 'cold_start',
        interestId: null,
      });
    }
  }

  return out;
}

/** 선정 카드만 링크 검증, 죽은 후보는 풀에서 제거하고 재구성 (PLAN #6). */
async function selectWithLinkCheck(
  db: Db,
  pool: ComposeCandidate[],
  memMap: Map<string, MemoryRow>,
): Promise<ComposeCandidate[]> {
  const aliveCache = new Map<string, boolean>();
  let current = pool;

  for (let round = 0; round < LINK_CHECK_ROUNDS; round++) {
    const selection = composeBrief(current);
    if (selection.length === 0) return [];

    const dead: ComposeCandidate[] = [];
    for (const c of selection) {
      const url = c.memoryId ? memMap.get(c.memoryId)?.sourceUrl : c.externalContent?.url;
      if (!url) continue;
      let alive = aliveCache.get(url);
      if (alive === undefined) {
        alive = await checkUrlAlive(url);
        aliveCache.set(url, alive);
      }
      if (!alive) dead.push(c);
    }
    if (dead.length === 0) return selection;

    for (const c of dead) {
      if (c.memoryId) {
        await db
          .update(memories)
          .set({ linkAlive: false, updatedAt: new Date() })
          .where(eq(memories.id, c.memoryId));
      }
    }
    current = current.filter((c) => !dead.includes(c));
  }
  return composeBrief(current);
}

function toCardInsert(c: ComposeCandidate, reason: string, position: number): BriefCardInsert {
  return {
    memoryId: c.memoryId,
    externalContent: c.externalContent,
    cardType: c.cardType,
    reasonCode: c.reasonCode,
    curationReason: reason,
    position,
    score: c.score,
    scoreBreakdown: c.breakdown,
  };
}

export interface GenerateOptions {
  /** 동기(GET) 경로에서는 링크 검증을 생략해 응답을 빠르게 한다 — 죽은 링크는 다음 배치가 잡는다. */
  checkLinks?: boolean;
}

/** 오늘 카드에 지배적 관심사(같은 interest 카드 ≥ 2장)가 있으면 그 이름을 반환 — 서사는 창발일 때만. */
function dominantInterest(
  selection: ComposeCandidate[],
  interests: CandidateBundle['activeInterests'],
): string | null {
  const counts = new Map<string, number>();
  for (const c of selection) {
    if (c.interestId) counts.set(c.interestId, (counts.get(c.interestId) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!top || top[1] < 2) return null;
  return interests.find((i) => i.id === top[0])?.name ?? null;
}

/**
 * 정식 브리핑 생성 (스코어링→구성→링크 검증→문구). replaceBriefId가 있으면
 * fallback 승격 경로 — 기존 brief의 카드를 교체한다.
 *
 * 문구 원칙 (§4.4): '왜 오늘'은 스코어링이 이미 계산했다(reason_code + 사실).
 * 모든 카드의 reason은 그 사실로 만든 결정적 템플릿이고, LLM은 hero 한 장에만
 * 목소리를 입힌다. llm이 null이면(동기 GET 경로) 완전 결정적으로 동작한다.
 */
export async function generateBriefForUser(
  deps: BriefDeps,
  user: UserRow,
  briefDate: string,
  local: DateTime,
  replaceBriefId?: string,
  options: GenerateOptions = {},
): Promise<GenerateResult> {
  const { db, llm } = deps;
  const now = local.toJSDate();
  const locale = user.locale as Locale;
  const tone = getTone(locale);

  const bundle = await collectCandidates(db, user.id, now);
  const pool = buildCandidates(bundle, user, local);
  if (pool.length === 0) return 'no_candidates';

  const memMap = new Map(bundle.eligibleMemories.map((m) => [m.id, m]));
  let selection =
    options.checkLinks === false ? composeBrief(pool) : await selectWithLinkCheck(db, pool, memMap);
  if (selection.length === 0) return 'no_candidates';

  // 서사: 지배적 관심사가 있는 날만 — 그 카드들을 hero 다음에 묶는다 (억지 테마 금지).
  const narrative = dominantInterest(selection, bundle.activeInterests);
  if (narrative) {
    const [hero, ...rest] = selection;
    const domId = [...selection]
      .filter((c) => c.interestId)
      .map((c) => c.interestId!)
      .find((id) => bundle.activeInterests.find((i) => i.id === id)?.name === narrative);
    selection = [
      hero!,
      ...rest.filter((c) => c.interestId === domId),
      ...rest.filter((c) => c.interestId !== domId),
    ];
  }

  // 1. 모든 카드: reason_code + 사실 기반 결정적 reason (주어는 '너').
  //    같은 문장이 두 번 나오면 회전 템플릿으로 교체 — 반복은 피드처럼 읽힌다.
  const usedReasons = new Set<string>();
  const reasons = selection.map((c) => {
    const mem = c.memoryId ? memMap.get(c.memoryId) : undefined;
    let reason =
      c.cardType === 'discovery'
        ? tone.templates.discoveryReason
        : tone.templates.reasonFor(c.reasonCode as ReasonCode, {
            ageDays: mem ? (now.getTime() - mem.createdAt.getTime()) / DAY_MS : 0,
            interestName: c.interestId
              ? (bundle.activeInterests.find((i) => i.id === c.interestId)?.name ?? null)
              : null,
          });
    if (usedReasons.has(reason)) {
      reason = tone.templates.fallbackReasons[usedReasons.size % tone.templates.fallbackReasons.length]!;
    }
    usedReasons.add(reason);
    return reason;
  });

  // 2. hero 한 장만 LLM으로 목소리 업그레이드 (greeting/closing 포함, 실패 시 템플릿 유지).
  let greeting = narrative
    ? tone.templates.narrativeGreeting(narrative)
    : tone.templates.greeting(user.displayName);
  let closing = tone.templates.closing;
  if (llm) {
    const hero = selection[0]!;
    const mem = hero.memoryId ? memMap.get(hero.memoryId) : undefined;
    const dateLabel = local.setLocale(locale === 'ko' ? 'ko' : 'en').toLocaleString({
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    const copy = await writeCopy(llm, {
      locale,
      userName: user.displayName,
      dateLabel,
      cards: [
        {
          title: mem?.title ?? hero.externalContent?.title ?? 'Untitled',
          summary: mem?.summary ?? undefined,
          topics: mem?.topics ?? undefined,
          userNote: mem?.type === 'link' ? (mem.rawText ?? undefined) : undefined,
          reasonCode: hero.reasonCode as ReasonCode,
          cardType: hero.cardType,
          ageDays: mem ? Math.floor((now.getTime() - mem.createdAt.getTime()) / DAY_MS) : 0,
        },
      ],
    });
    if (copy.reasons[0]) reasons[0] = copy.reasons[0];
    if (!narrative) greeting = copy.greeting;
    closing = copy.closing;
  }

  console.log(`[brief] reason sample (${user.id}): ${reasons[0]}`);

  const cards = selection.map((c, i) => toCardInsert(c, reasons[i] ?? '', i));

  if (replaceBriefId) {
    await replaceBriefContent(db, replaceBriefId, { greeting, closing, status: 'generated' }, cards);
    return 'promoted';
  }

  const id = await insertBriefWithCards(
    db,
    { userId: user.id, briefDate, greeting, closing, status: 'generated' },
    cards,
  );
  return id ? 'created' : 'skipped';
}

/** 생성 실패/후보 0건 폴백: 최근 memory 3건 + 템플릿 문구, status='fallback' (§4.5). */
export async function createFallbackBrief(db: Db, user: UserRow, briefDate: string): Promise<void> {
  const locale = user.locale as Locale;
  const recent = await db
    .select()
    .from(memories)
    .where(and(eq(memories.userId, user.id), isNull(memories.deletedAt)))
    .orderBy(desc(memories.createdAt))
    .limit(3);
  const seeds = pickFallbackCards(recent, user.onboardingInterests, locale);
  if (seeds.length === 0) return; // memory 0건 — GET의 coldstart 경로가 처리
  const tone = getTone(locale);
  await insertBriefWithCards(
    db,
    {
      userId: user.id,
      briefDate,
      greeting: tone.templates.fallbackGreeting,
      closing: tone.templates.closing,
      status: 'fallback',
    },
    seeds.map((s) => ({
      memoryId: s.memoryId,
      externalContent: s.externalContent,
      cardType: s.cardType,
      reasonCode: s.reasonCode,
      curationReason: s.curationReason,
      position: s.position,
    })),
  );
}
