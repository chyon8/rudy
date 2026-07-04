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
  COLDSTART_SOURCES,
  SCORING,
  getTone,
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
  llm: LlmPort;
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

  // Discovery: 콜드스타트 사용자(memory < 15)만, 온보딩 관심사 key 화이트리스트 매칭.
  if (bundle.memoryCount < SCORING.coldstartMemoryThreshold) {
    const locale = user.locale as Locale;
    for (const key of user.onboardingInterests) {
      const sources = COLDSTART_SOURCES[key]?.[locale] ?? COLDSTART_SOURCES[key]?.en ?? [];
      for (const s of sources) {
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

/**
 * 정식 브리핑 생성 (스코어링→구성→링크 검증→문구). replaceBriefId가 있으면
 * fallback 승격 경로 — 기존 brief의 카드를 교체한다.
 */
export async function generateBriefForUser(
  deps: BriefDeps,
  user: UserRow,
  briefDate: string,
  local: DateTime,
  replaceBriefId?: string,
): Promise<GenerateResult> {
  const { db, llm } = deps;
  const now = local.toJSDate();
  const locale = user.locale as Locale;

  const bundle = await collectCandidates(db, user.id, now);
  const pool = buildCandidates(bundle, user, local);
  if (pool.length === 0) return 'no_candidates';

  const memMap = new Map(bundle.eligibleMemories.map((m) => [m.id, m]));
  const selection = await selectWithLinkCheck(db, pool, memMap);
  if (selection.length === 0) return 'no_candidates';

  const dateLabel = local.setLocale(locale === 'ko' ? 'ko' : 'en').toLocaleString({
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const copy = await writeCopy(llm, {
    locale,
    userName: user.displayName,
    dateLabel,
    cards: selection.map((c) => {
      const mem = c.memoryId ? memMap.get(c.memoryId) : undefined;
      return {
        title: mem?.title ?? c.externalContent?.title ?? 'Untitled',
        summary: mem?.summary ?? undefined,
        userNote: mem?.type === 'link' ? (mem.rawText ?? undefined) : undefined,
        reasonCode: c.reasonCode as ReasonCode,
        cardType: c.cardType,
        ageDays: mem ? Math.floor((now.getTime() - mem.createdAt.getTime()) / DAY_MS) : 0,
      };
    }),
  });

  const cards = selection.map((c, i) => toCardInsert(c, copy.reasons[i] ?? '', i));

  if (replaceBriefId) {
    await replaceBriefContent(
      db,
      replaceBriefId,
      { greeting: copy.greeting, closing: copy.closing, status: 'generated' },
      cards,
    );
    return 'promoted';
  }

  const id = await insertBriefWithCards(
    db,
    { userId: user.id, briefDate, greeting: copy.greeting, closing: copy.closing, status: 'generated' },
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
  const seeds = pickFallbackCards(recent, locale);
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
