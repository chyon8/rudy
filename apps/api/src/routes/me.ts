import { OnboardingBodySchema, UpdateMeBodySchema } from '@rudy/shared';
import { interests, users } from '@rudy/db';
import { eq } from 'drizzle-orm';
import type { AppType } from '../lib/appType';
import { toUserDto } from '../lib/dto';
import { notFound, serviceUnavailable } from '../lib/errors';

export function registerMeRoutes(app: AppType): void {
  const auth = { preHandler: app.authenticate };

  app.get('/v1/me', auth, async (req) => toUserDto(await getUser(app, req.userId)));

  app.patch('/v1/me', { ...auth, schema: { body: UpdateMeBodySchema } }, async (req) => {
    const b = req.body;
    const patch: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
    if (b.notify_time !== undefined) patch.notifyTime = b.notify_time;
    if (b.timezone !== undefined) patch.timezone = b.timezone;
    if (b.display_name !== undefined) patch.displayName = b.display_name;
    if (b.locale !== undefined) patch.locale = b.locale;
    if (b.expo_push_token !== undefined) patch.expoPushToken = b.expo_push_token;
    if (b.hide_notification_content !== undefined) {
      patch.hideNotificationContent = b.hide_notification_content;
    }
    const updated = await app.db.update(users).set(patch).where(eq(users.id, req.userId)).returning();
    if (!updated[0]) throw notFound('User not found');
    return toUserDto(updated[0]);
  });

  // 온보딩 관심사 → interests 레코드 즉시 생성 (라벨 임베딩 → centroid, strength=0.5).
  app.post('/v1/me/onboarding', { ...auth, schema: { body: OnboardingBodySchema } }, async (req) => {
    if (!app.embedding) throw serviceUnavailable('Onboarding is unavailable (no embedding provider)');
    const centroids = await Promise.all(
      req.body.interests.map((i) => app.embedding!.embed(i.label)),
    );
    const values = req.body.interests.map((i, idx) => ({
      userId: req.userId,
      name: i.label,
      centroid: centroids[idx] ?? null,
      strength: 0.5,
      status: 'stable' as const,
    }));
    const created = await app.db.insert(interests).values(values).returning();
    // 프리셋 key만 저장 — coldstart discovery 매칭에 쓴다 (자유 입력은 미매칭 허용, H4).
    const keys = req.body.interests.map((i) => i.key).filter((k): k is string => Boolean(k));
    await app.db
      .update(users)
      .set({ onboardingInterests: keys, updatedAt: new Date() })
      .where(eq(users.id, req.userId));
    return { interests: created.map((c) => ({ id: c.id, name: c.name })) };
  });

  app.delete('/v1/me', auth, async (req, reply) => {
    await app.db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, req.userId));
    return reply.status(204).send();
  });
}

async function getUser(app: AppType, id: string) {
  const rows = await app.db.select().from(users).where(eq(users.id, id)).limit(1);
  const user = rows[0];
  if (!user) throw notFound('User not found');
  return user;
}
