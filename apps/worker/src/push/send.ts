import { briefCards, dailyBriefs, memories, users, type Db } from '@rudy/db';
import { getTone, type Env, type Locale, type PushJobData } from '@rudy/shared';
import { and, asc, eq } from 'drizzle-orm';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoPushTicket {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

/**
 * 아침 브리핑 푸시 발송 (§4.6): hero 카드 예고 1문장, locale 적용,
 * 잠금화면 숨김 토글 반영. DeviceNotRegistered → 토큰 제거 (H8).
 */
export async function processPushJob(db: Db, env: Env, data: PushJobData): Promise<void> {
  const userRows = await db.select().from(users).where(eq(users.id, data.userId)).limit(1);
  const user = userRows[0];
  if (!user || user.deletedAt || !user.expoPushToken) return;

  const briefRows = await db
    .select()
    .from(dailyBriefs)
    .where(and(eq(dailyBriefs.userId, user.id), eq(dailyBriefs.briefDate, data.briefDate)))
    .limit(1);
  const brief = briefRows[0];
  if (!brief) return;

  const tone = getTone(user.locale as Locale);
  let body = tone.templates.pushHidden;
  if (!user.hideNotificationContent) {
    const heroRows = await db
      .select({ card: briefCards, title: memories.title })
      .from(briefCards)
      .leftJoin(memories, eq(briefCards.memoryId, memories.id))
      .where(eq(briefCards.briefId, brief.id))
      .orderBy(asc(briefCards.position))
      .limit(1);
    const hero = heroRows[0];
    const heroTitle =
      hero?.title ?? (hero?.card.externalContent as { title?: string } | null)?.title ?? null;
    if (heroTitle) body = tone.templates.pushPreview(heroTitle);
  }

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(env.EXPO_ACCESS_TOKEN ? { authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}),
    },
    body: JSON.stringify({
      to: user.expoPushToken,
      title: 'Rudy',
      body,
      data: { brief_date: data.briefDate },
    }),
  });
  const json = (await res.json().catch(() => null)) as { data?: ExpoPushTicket | ExpoPushTicket[] } | null;
  const ticket = Array.isArray(json?.data) ? json.data[0] : json?.data;

  if (ticket?.status === 'error') {
    if (ticket.details?.error === 'DeviceNotRegistered') {
      // H8: 무효 토큰 제거 — 앱 실행 시 토큰 동기화로 자연 복구.
      await db.update(users).set({ expoPushToken: null, updatedAt: new Date() }).where(eq(users.id, user.id));
    } else {
      throw new Error(`Expo push error: ${ticket.details?.error ?? ticket.message ?? 'unknown'}`);
    }
  }
}
