import { briefCards, cardFeedbacks, dailyBriefs, users, type Db } from '@rudy/db';
import { pushDelayMs, pushJobId, type PushJobData } from '@rudy/shared';
import type { Queue } from 'bullmq';
import { and, count, eq, isNull } from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  canPromote,
  createFallbackBrief,
  generateBriefForUser,
  isInGenerationWindow,
  timeToMinutes,
  type BriefDeps,
  type UserRow,
} from '@rudy/brief';

export interface TickDeps extends BriefDeps {
  pushQueue: Queue<PushJobData>;
}

/** 브리핑 완료 → notify_time에 맞춘 delayed 푸시 예약 (jobId 멱등, PLAN #3). */
async function schedulePush(deps: TickDeps, user: UserRow, briefDate: string, now: Date): Promise<void> {
  if (!user.expoPushToken) return;
  const delay = pushDelayMs(now, briefDate, user.notifyTime, user.timezone);
  if (delay === null) return;
  await deps.pushQueue.add(
    'send',
    { userId: user.id, briefDate },
    { jobId: pushJobId(user.id, briefDate), delay, attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true, removeOnFail: 100 },
  );
}

/**
 * 15분 tick (docs/spec.md §4, PLAN #9): 사용자별 로컬 시간으로 생성 창
 * [notify−2h, notify) 판정. 존재 체크 + DB UNIQUE로 이중 생성 방어,
 * fallback 브리핑은 피드백 0건일 때만 정식 생성으로 승격.
 */
export async function runBriefTick(deps: TickDeps, now: Date = new Date()): Promise<void> {
  const userRows = await deps.db.select().from(users).where(isNull(users.deletedAt));
  for (const user of userRows) {
    try {
      await processUser(deps, user, now);
    } catch (err) {
      console.error(`[brief] user ${user.id} tick failed:`, err);
    }
  }
}

async function processUser(deps: TickDeps, user: UserRow, now: Date): Promise<void> {
  let local = DateTime.fromJSDate(now, { zone: user.timezone || 'UTC' });
  if (!local.isValid) local = DateTime.fromJSDate(now, { zone: 'UTC' });

  const minutes = local.hour * 60 + local.minute;
  if (!isInGenerationWindow(minutes, timeToMinutes(user.notifyTime))) return;

  const briefDate = local.toISODate();
  if (!briefDate) return;

  const existing = await deps.db
    .select()
    .from(dailyBriefs)
    .where(and(eq(dailyBriefs.userId, user.id), eq(dailyBriefs.briefDate, briefDate)))
    .limit(1);
  const brief = existing[0];

  if (!brief) {
    try {
      const result = await generateBriefForUser(deps, user, briefDate, local);
      if (result === 'no_candidates') await createFallbackBrief(deps.db, user, briefDate);
    } catch (err) {
      // 생성 실패 → fallback (저장 성공과 브리핑 생성은 분리, 빈 Home 금지).
      console.error(`[brief] generation failed for ${user.id}, falling back:`, err);
      await createFallbackBrief(deps.db, user, briefDate);
    }
    await schedulePush(deps, user, briefDate, now);
    return;
  }

  // fallback 승격 (PLAN #2): 피드백(impression 포함) 0건인 fallback만 교체.
  if (brief.status !== 'fallback') return;
  const feedbacks = await feedbackCountForBrief(deps.db, brief.id);
  if (!canPromote(brief.status, feedbacks)) return;
  try {
    await generateBriefForUser(deps, user, briefDate, local, brief.id);
    await schedulePush(deps, user, briefDate, now); // jobId 멱등 — 이미 예약돼 있으면 무시
  } catch (err) {
    console.error(`[brief] promotion failed for ${user.id} (fallback 유지):`, err);
  }
}

async function feedbackCountForBrief(db: Db, briefId: string): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(cardFeedbacks)
    .innerJoin(briefCards, eq(cardFeedbacks.cardId, briefCards.id))
    .where(eq(briefCards.briefId, briefId));
  return rows[0]?.n ?? 0;
}
