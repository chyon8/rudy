import { eq } from 'drizzle-orm';
import type { Db } from './client';
import { briefCards, dailyBriefs } from './schema';

export type BriefInsert = Omit<typeof dailyBriefs.$inferInsert, 'id' | 'generatedAt'>;
export type BriefCardInsert = Omit<typeof briefCards.$inferInsert, 'id' | 'briefId'>;

/**
 * 브리핑 + 카드 삽입 — api(동기 fallback/coldstart)와 worker(배치)가 공유하는
 * 동시성 안전 경로: INSERT ... ON CONFLICT DO NOTHING + 트랜잭션 (PLAN #2).
 * 카드 없는 brief가 남지 않도록 한 트랜잭션으로 묶는다 (빈 Home 금지).
 * UNIQUE(user_id, brief_date) 충돌(= 이미 존재)이면 null 반환.
 */
export async function insertBriefWithCards(
  db: Db,
  brief: BriefInsert,
  cards: BriefCardInsert[],
): Promise<string | null> {
  return db.transaction(async (tx) => {
    const inserted = await tx.insert(dailyBriefs).values(brief).onConflictDoNothing().returning();
    const row = inserted[0];
    if (!row) return null;
    if (cards.length > 0) {
      await tx.insert(briefCards).values(cards.map((c) => ({ ...c, briefId: row.id })));
    }
    return row.id;
  });
}

/** fallback 승격 (PLAN #2): 기존 카드 전부 교체 + 문구/상태 갱신. */
export async function replaceBriefContent(
  db: Db,
  briefId: string,
  patch: { greeting: string; closing: string; status: 'generated' | 'fallback' },
  cards: BriefCardInsert[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(briefCards).where(eq(briefCards.briefId, briefId));
    await tx
      .update(dailyBriefs)
      .set({ ...patch, generatedAt: new Date() })
      .where(eq(dailyBriefs.id, briefId));
    if (cards.length > 0) {
      await tx.insert(briefCards).values(cards.map((c) => ({ ...c, briefId })));
    }
  });
}
