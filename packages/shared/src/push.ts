/**
 * 푸시 예약 헬퍼 (PLAN #3): Expo Push에는 서버측 예약이 없다 —
 * brief 생성 시 BullMQ delayed job으로 예약한다. jobId로 멱등.
 */
import { DateTime } from 'luxon';

export interface PushJobData {
  userId: string;
  briefDate: string;
}

/** jobId = push:{userId}:{briefDate} — 같은 날 이중 발송 방지 (멱등). */
export function pushJobId(userId: string, briefDate: string): string {
  return `push:${userId}:${briefDate}`;
}

/**
 * 발송까지 남은 ms. notify 시각이 이미 지났으면 0(즉시), 브리핑 날짜가
 * 아니게 됐으면 null(예약 안 함).
 */
export function pushDelayMs(
  now: Date,
  briefDate: string,
  notifyTime: string,
  timezone: string,
): number | null {
  const zone = timezone || 'UTC';
  const m = notifyTime.match(/^(\d{1,2}):(\d{2})/);
  const hour = m ? Number(m[1]) : 8;
  const minute = m ? Number(m[2]) : 0;
  let target = DateTime.fromISO(briefDate, { zone }).set({ hour, minute, second: 0, millisecond: 0 });
  if (!target.isValid) target = DateTime.fromISO(briefDate, { zone: 'UTC' }).set({ hour, minute });
  if (!target.isValid) return null;
  const delay = target.toMillis() - now.getTime();
  // 브리핑 날짜가 하루 이상 지났으면 보내지 않는다 (어제 브리핑 푸시 금지).
  if (delay < -24 * 60 * 60 * 1000) return null;
  return Math.max(delay, 0);
}
