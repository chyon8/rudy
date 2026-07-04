import { SCORING, type CardType, type ExternalContent, type ReasonCode } from '@rudy/shared';
import type { ScoreBreakdown } from './scoring';

/** 구성 입력 후보 — rediscovery는 스코어링 결과, discovery/reflection은 baseScore. */
export interface ComposeCandidate {
  /** memoryId 또는 discovery URL — 후보 식별용. */
  key: string;
  cardType: CardType;
  memoryId: string | null;
  externalContent: ExternalContent | null;
  score: number;
  breakdown: ScoreBreakdown | null;
  reasonCode: ReasonCode;
  /** 최고 매칭 interest — 같은 interest ≤ 2장 규칙용. */
  interestId: string | null;
}

/**
 * 구성 규칙 (docs/spec.md §4.3) — 순수 함수:
 * 카드 3~5장, hero(0번)=최고점 rediscovery(없으면 discovery),
 * rediscovery ≥ 50%, reflection ≤ 1, 같은 interest ≤ 2.
 * 후보 3장 미만이면 있는 만큼 (최소 1장은 호출자가 보장).
 */
export function composeBrief(candidates: ComposeCandidate[]): ComposeCandidate[] {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const rediscoveries = sorted.filter((c) => c.cardType === 'rediscovery');

  const selected: ComposeCandidate[] = [];
  const interestCount = new Map<string, number>();
  let reflectionCount = 0;

  const violates = (c: ComposeCandidate): boolean => {
    if (c.cardType === 'reflection' && reflectionCount >= SCORING.maxReflection) return true;
    if (c.interestId && (interestCount.get(c.interestId) ?? 0) >= SCORING.maxPerInterest) return true;
    // rediscovery ≥ 50% — rediscovery가 하나라도 있으면 비-rediscovery가 과반을 넘지 못한다.
    if (c.cardType !== 'rediscovery' && rediscoveries.length > 0) {
      const nonRedis = selected.filter((s) => s.cardType !== 'rediscovery').length + 1;
      const redis = selected.filter((s) => s.cardType === 'rediscovery').length;
      const redisRemaining = rediscoveries.filter((r) => !selected.includes(r)).length;
      if (nonRedis > redis + redisRemaining) return true;
    }
    return false;
  };

  const add = (c: ComposeCandidate) => {
    selected.push(c);
    if (c.interestId) interestCount.set(c.interestId, (interestCount.get(c.interestId) ?? 0) + 1);
    if (c.cardType === 'reflection') reflectionCount++;
  };

  // hero: 최고점 rediscovery. 없으면 최고점 discovery.
  const hero = rediscoveries[0] ?? sorted.find((c) => c.cardType === 'discovery');
  if (!hero) return sorted.slice(0, SCORING.cards.max); // reflection만 있는 극단 케이스
  add(hero);

  for (const c of sorted) {
    if (selected.length >= SCORING.cards.max) break;
    if (selected.includes(c) || violates(c)) continue;
    add(c);
  }

  // 최종 50% 보정: rediscovery 존재 시 비-rediscovery가 절반을 넘으면 낮은 점수부터 제거.
  if (rediscoveries.length > 0) {
    while (selected.length > 1) {
      const redis = selected.filter((s) => s.cardType === 'rediscovery').length;
      if (redis * 2 >= selected.length) break;
      const lowestNonRedis = [...selected]
        .reverse()
        .find((s) => s.cardType !== 'rediscovery' && s !== hero);
      if (!lowestNonRedis) break;
      selected.splice(selected.indexOf(lowestNonRedis), 1);
    }
  }

  return selected;
}
