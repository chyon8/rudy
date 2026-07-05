import { SCORING, type ReasonCode } from '@rudy/shared';

/** 스코어링 입력 — DB 접근 없이 미리 계산된 값만 받는 결정적 순수 함수 (LLM 금지). */
export interface ScoreInput {
  intent: string | null;
  /** Luxon weekday: 1=월 … 7=일. 사용자 로컬 기준. */
  weekday: number;
  ageDays: number;
  surfaceCount: number;
  /** rising/stable interest centroid와의 최대 cosine (0~1, interest 없으면 0). */
  interestAlignment: number;
  /** rising interest와 cosine ≥ 0.75로 매칭되는가. */
  risingMatch: boolean;
  /** 같은 topics 과거 like/open 비율. 무데이터면 null → 0.5. */
  feedbackRatio: number | null;
  hasLinks: boolean;
}

export interface ScoreBreakdown {
  interest_alignment: number;
  timing_fit: number;
  maturity: number;
  novelty: number;
  feedback: number;
}

export function timingFit(intent: string | null, weekday: number, risingMatch: boolean): number {
  if (intent === 'go') return weekday >= 5 ? 1.0 : 0.4; // 금~일
  if (intent === 'learn') return risingMatch ? 1.0 : 0.5;
  return 0.6;
}

export function maturity(intent: string | null, ageDays: number): number {
  const d = ageDays;
  switch (intent) {
    case 'go':
      return d >= 3 ? 1.0 : 0.3;
    case 'learn': {
      // 피크 30일 사인 곡선 (0.5~1.0), 60일 이후 0.5 유지.
      const clamped = Math.min(Math.max(d, 0), 60);
      return 0.5 + 0.5 * Math.sin((Math.PI * clamped) / 60);
    }
    case 'buy':
      if (d >= 7 && d <= 21) return 1.0;
      return d > 21 ? 0.4 : 0.6; // 7일 미만은 중립 (스펙 미규정 — 기타와 동일 취급)
    case 'idea': {
      const windows: [number, number][] = [
        [14, 3],
        [30, 5],
        [90, 10],
      ];
      return windows.some(([c, r]) => Math.abs(d - c) <= r) ? 1.0 : 0.3;
    }
    default:
      return 0.6;
  }
}

export function novelty(surfaceCount: number): number {
  return 1 - Math.min(surfaceCount / SCORING.noveltySurfaceCap, 1);
}

export function scoreMemory(input: ScoreInput): { score: number; breakdown: ScoreBreakdown } {
  const breakdown: ScoreBreakdown = {
    interest_alignment: Math.max(0, Math.min(input.interestAlignment, 1)),
    timing_fit: timingFit(input.intent, input.weekday, input.risingMatch),
    maturity: maturity(input.intent, input.ageDays),
    novelty: novelty(input.surfaceCount),
    feedback: input.feedbackRatio ?? 0.5,
  };
  const w = SCORING.weights;
  const score =
    w.interestAlignment * breakdown.interest_alignment +
    w.timingFit * breakdown.timing_fit +
    w.maturity * breakdown.maturity +
    w.novelty * breakdown.novelty +
    w.feedback * breakdown.feedback;
  return { score, breakdown };
}

/** reason_code 판정 — 점수 기여가 뚜렷한 요인 우선, 없으면 connection/surprise. */
export function pickReasonCode(input: ScoreInput, breakdown: ScoreBreakdown): ReasonCode {
  if (input.risingMatch && breakdown.interest_alignment >= SCORING.interestMatchThreshold) {
    return 'rising_interest';
  }
  if (breakdown.timing_fit >= 1) return 'timing';
  if (breakdown.maturity >= 1) return 'maturity';
  if (input.hasLinks) return 'connection';
  return 'surprise';
}

/** 코사인 유사도 — interest_alignment 계산용 (사용자당 interest 수가 작아 JS 계산으로 충분). */
export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** 같은 topics의 과거 like/open 비율. topicStats: topic → {pos, imp}. */
export function feedbackRatio(
  topicStats: Map<string, { pos: number; imp: number }>,
  topics: string[],
): number | null {
  let pos = 0;
  let imp = 0;
  for (const t of topics) {
    const s = topicStats.get(t);
    if (s) {
      pos += s.pos;
      imp += s.imp;
    }
  }
  if (pos + imp === 0) return null;
  return Math.min(pos / Math.max(imp, 1), 1);
}
