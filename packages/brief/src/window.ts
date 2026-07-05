import { SCORING } from '@rudy/shared';

/** 'HH:MM' 또는 'HH:MM:SS' → 자정 기준 분. 파싱 불가 시 08:00. */
export function timeToMinutes(t: string): number {
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return 8 * 60;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * 생성 창 판정 (PLAN #9): [notify − 2h, notify) 반열림.
 * 15분 tick이 창을 놓쳐도 다음 tick에서 "notify 이전 && 오늘 brief 없음"으로 보충되도록
 * 창 전체를 허용한다. notify가 02:00 이전이면 자정으로 클램프 (날짜 경계 단순화).
 */
export function isInGenerationWindow(localMinutes: number, notifyMinutes: number): boolean {
  const start = Math.max(notifyMinutes - SCORING.generationWindowMinutes, 0);
  return localMinutes >= start && localMinutes < notifyMinutes;
}

/** fallback 승격 자격 (PLAN #2): fallback 상태 + 카드 피드백(impression 포함) 0건. */
export function canPromote(status: string, feedbackCount: number): boolean {
  return status === 'fallback' && feedbackCount === 0;
}
