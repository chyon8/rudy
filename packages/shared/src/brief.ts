import { COLDSTART_SOURCES, PRESET_INTERESTS, type ColdstartSource } from './config/coldstartSources';
import { getTone, type ReasonCode } from './config/tone';
import type { Locale } from './contracts';

export type CardType = 'rediscovery' | 'discovery' | 'reflection';

export interface ExternalContent {
  url: string;
  title: string;
  thumbnail_url: string | null;
  source: string;
}

/** DB insert 직전의 카드 명세 — api(동기 coldstart/fallback)와 worker(배치)가 공유. */
export interface BriefCardSeed {
  memoryId: string | null;
  externalContent: ExternalContent | null;
  cardType: CardType;
  reasonCode: ReasonCode;
  curationReason: string;
  position: number;
}

export interface MemoryLite {
  id: string;
  createdAt: Date;
}

function toDiscoverySeed(s: ColdstartSource, reason: string, position: number): BriefCardSeed {
  return {
    memoryId: null,
    externalContent: { url: s.url, title: s.title, thumbnail_url: s.thumbnail_url, source: s.source },
    cardType: 'discovery',
    reasonCode: 'cold_start',
    curationReason: reason,
    position,
  };
}

/** 온보딩 관심사 key에 매칭되는 discovery 소스를 라운드로빈으로 뽑는다. 미매칭이면 전체 풀에서. */
function pickDiscoverySources(
  onboardingKeys: string[],
  locale: Locale,
  count: number,
): { source: ColdstartSource; label: string }[] {
  const matched = onboardingKeys
    .map((key) => {
      const preset = PRESET_INTERESTS.find((p) => p.key === key);
      const sources = COLDSTART_SOURCES[key]?.[locale] ?? COLDSTART_SOURCES[key]?.en;
      return preset && sources?.length ? { label: preset.label[locale], sources } : null;
    })
    .filter((x): x is { label: string; sources: ColdstartSource[] } => x !== null);

  // 자유 입력만 있는 등 매칭 0건이어도 빈 Home은 안 된다 — 프리셋 전체 풀 폴백.
  const pools = matched.length
    ? matched
    : PRESET_INTERESTS.map((p) => ({
        label: p.label[locale],
        sources: COLDSTART_SOURCES[p.key]?.[locale] ?? [],
      })).filter((p) => p.sources.length > 0);

  const picked: { source: ColdstartSource; label: string }[] = [];
  const seen = new Set<string>();
  for (let round = 0; picked.length < count && round < 5; round++) {
    for (const pool of pools) {
      if (picked.length >= count) break;
      const source = pool.sources[round];
      if (source && !seen.has(source.url)) {
        seen.add(source.url);
        picked.push({ source, label: pool.label });
      }
    }
  }
  return picked;
}

/**
 * 콜드스타트 조립 (PLAN #7): 방금 저장한 memory 1장(cold_start) + 관심사 매칭 discovery 2장.
 * memory 0건이면 discovery 3장. 어떤 입력에서도 카드 ≥ 1을 보장한다.
 */
export function pickColdstartCards(
  memories: MemoryLite[],
  onboardingKeys: string[],
  locale: Locale,
): BriefCardSeed[] {
  const tone = getTone(locale);
  const cards: BriefCardSeed[] = [];

  const latest = [...memories].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (latest) {
    cards.push({
      memoryId: latest.id,
      externalContent: null,
      cardType: 'rediscovery',
      reasonCode: 'cold_start',
      curationReason: tone.templates.reasons.cold_start,
      position: 0,
    });
  }

  const discoveryCount = latest ? 2 : 3;
  for (const { source, label } of pickDiscoverySources(onboardingKeys, locale, discoveryCount)) {
    cards.push(toDiscoverySeed(source, tone.templates.coldstartDiscoveryReason(label), cards.length));
  }
  return cards;
}

/** Fallback 조립 (생성 실패/배치 전 GET): 최근 memory 3건 + 템플릿 문구. */
export function pickFallbackCards(memories: MemoryLite[], locale: Locale): BriefCardSeed[] {
  const tone = getTone(locale);
  return [...memories]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 3)
    .map((m, i) => ({
      memoryId: m.id,
      externalContent: null,
      cardType: 'rediscovery' as const,
      reasonCode: 'timing' as const,
      curationReason: tone.templates.fallbackReason,
      position: i,
    }));
}
