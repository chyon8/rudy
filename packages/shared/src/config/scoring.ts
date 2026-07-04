/**
 * Brief Engine 스코어링·구성 상수 집약 (docs/spec.md §4.2~4.3).
 * 튜닝(M5)은 이 파일만 수정한다.
 */
export const SCORING = {
  weights: {
    interestAlignment: 0.35,
    timingFit: 0.2,
    maturity: 0.2,
    novelty: 0.15,
    feedback: 0.1,
  },
  /** 같은 memory 재등장 쿨다운 (last_surfaced_at 기준). */
  surfaceCooldownDays: 21,
  /** not_today 피드백 시 suppressed_until 기간. */
  suppressDays: 14,
  /** 이 값 미만이면 콜드스타트 사용자 (discovery 후보 대상). */
  coldstartMemoryThreshold: 15,
  /** 브리핑 카드 수. 후보가 min 미만이면 있는 만큼 (최소 1장). */
  cards: { min: 3, max: 5 },
  /** 같은 interest 카드 최대 수. */
  maxPerInterest: 2,
  /** reflection 카드 최대 수. */
  maxReflection: 1,
  /** memory↔interest 매칭으로 보는 cosine 하한 (rising 매칭 판단). */
  interestMatchThreshold: 0.75,
  /** reflection 후보가 되는 rising interest의 momentum 하한. */
  reflectionMomentumThreshold: 0.5,
  /** novelty = 1 − min(surface_count / cap, 1). */
  noveltySurfaceCap: 3,
  /** 스코어 공식이 없는 카드 타입의 기본 점수 (구성 정렬용). */
  baseScore: { reflection: 0.5, discovery: 0.25 },
  /** 생성 창: [notify_time − 2h, notify_time). 15분 tick이 이 창에서 생성·보충. */
  generationWindowMinutes: 120,
} as const;
