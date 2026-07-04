import {
  briefCards,
  cardFeedbacks,
  dailyBriefs,
  insertBriefWithCards,
  memories,
  users,
  type Db,
} from '@rudy/db';
import {
  FeedbackBodySchema,
  SCORING,
  getTone,
  pickColdstartCards,
  pickFallbackCards,
  type Locale,
} from '@rudy/shared';
import type { InferSelectModel } from 'drizzle-orm';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { z } from 'zod';
import type { AppType } from '../lib/appType';
import { toBriefDto } from '../lib/dto';
import { notFound } from '../lib/errors';

type UserRow = InferSelectModel<typeof users>;

const CardIdParamSchema = z.object({ cardId: z.string().uuid() });

export function registerBriefRoutes(app: AppType): void {
  const auth = { preHandler: app.authenticate };

  // 오늘 brief 반환 — 없으면 동기 coldstart/fallback 생성. 빈 응답 금지 (Product Rule 1).
  app.get('/v1/briefs/today', auth, async (req) => {
    const user = await getUser(app.db, req.userId);
    let local = DateTime.now().setZone(user.timezone || 'UTC');
    if (!local.isValid) local = DateTime.now().setZone('UTC');
    const briefDate = local.toISODate() ?? DateTime.utc().toISODate()!;

    let brief = await findBrief(app.db, user.id, briefDate);
    if (!brief) {
      await createSyncBrief(app.db, user, briefDate);
      // ON CONFLICT DO NOTHING 후 재조회 — 동시 요청 경합 안전 (PLAN #2).
      brief = await findBrief(app.db, user.id, briefDate);
    }
    if (!brief) throw notFound('Brief could not be created');

    const cards = await app.db
      .select()
      .from(briefCards)
      .where(eq(briefCards.briefId, brief.id))
      .orderBy(asc(briefCards.position));
    const memoryIds = cards.map((c) => c.memoryId).filter((id): id is string => id !== null);
    const memRows = memoryIds.length
      ? await app.db.select().from(memories).where(inArray(memories.id, memoryIds))
      : [];
    return toBriefDto(brief, cards, new Map(memRows.map((m) => [m.id, m])));
  });

  app.post(
    '/v1/briefs/cards/:cardId/feedback',
    { ...auth, schema: { params: CardIdParamSchema, body: FeedbackBodySchema } },
    async (req, reply) => {
      const rows = await app.db
        .select({ card: briefCards, userId: dailyBriefs.userId })
        .from(briefCards)
        .innerJoin(dailyBriefs, eq(briefCards.briefId, dailyBriefs.id))
        .where(eq(briefCards.id, req.params.cardId))
        .limit(1);
      const found = rows[0];
      if (!found || found.userId !== req.userId) throw notFound('Card not found');

      const { action } = req.body;
      const inserted = await app.db
        .insert(cardFeedbacks)
        .values({ cardId: found.card.id, userId: req.userId, action })
        .onConflictDoNothing() // impression 재전송 내성 (F8)
        .returning();

      // memory_id NULL 카드(discovery/reflection)는 기록만 (PLAN #8).
      const memoryId = found.card.memoryId;
      if (inserted.length > 0 && memoryId) {
        if (action === 'impression') {
          // 실제로 노출된 시점에 resurface 상태 갱신 — 21일 쿨다운·novelty의 기준.
          await app.db
            .update(memories)
            .set({ lastSurfacedAt: new Date(), surfaceCount: sql`${memories.surfaceCount} + 1` })
            .where(eq(memories.id, memoryId));
        } else if (action === 'not_today') {
          const until = new Date(Date.now() + SCORING.suppressDays * 24 * 60 * 60 * 1000);
          await app.db
            .update(memories)
            .set({ suppressedUntil: until, updatedAt: new Date() })
            .where(eq(memories.id, memoryId));
        } else if (action === 'never') {
          await app.db
            .update(memories)
            .set({ isExcluded: true, updatedAt: new Date() })
            .where(eq(memories.id, memoryId));
        }
      }
      return reply.status(204).send();
    },
  );
}

async function getUser(db: Db, id: string): Promise<UserRow> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const user = rows[0];
  if (!user) throw notFound('User not found');
  return user;
}

async function findBrief(db: Db, userId: string, briefDate: string) {
  const rows = await db
    .select()
    .from(dailyBriefs)
    .where(and(eq(dailyBriefs.userId, userId), eq(dailyBriefs.briefDate, briefDate)))
    .limit(1);
  return rows[0];
}

/**
 * 동기 생성 (§4.5): memory < 15 → coldstart (정식 Day 0 구성, status='generated'),
 * 그 외 → fallback (최근 3건, status='fallback' — 배치가 이후 승격 가능).
 */
async function createSyncBrief(db: Db, user: UserRow, briefDate: string): Promise<void> {
  const locale = user.locale as Locale;
  const tone = getTone(locale);
  const recent = await db
    .select({ id: memories.id, createdAt: memories.createdAt })
    .from(memories)
    .where(and(eq(memories.userId, user.id), isNull(memories.deletedAt)))
    .orderBy(desc(memories.createdAt))
    .limit(SCORING.coldstartMemoryThreshold + 1);

  const coldstart = recent.length < SCORING.coldstartMemoryThreshold;
  const seeds = coldstart
    ? pickColdstartCards(recent, user.onboardingInterests, locale)
    : pickFallbackCards(recent, locale);

  await insertBriefWithCards(
    db,
    {
      userId: user.id,
      briefDate,
      greeting: coldstart ? tone.templates.greeting(user.displayName) : tone.templates.fallbackGreeting,
      closing: tone.templates.closing,
      status: coldstart ? 'generated' : 'fallback',
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
