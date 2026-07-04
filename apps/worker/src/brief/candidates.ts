import {
  briefCards,
  cardFeedbacks,
  interests,
  memories,
  memoryLinks,
  type Db,
} from '@rudy/db';
import { SCORING } from '@rudy/shared';
import type { InferSelectModel } from 'drizzle-orm';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { isEligibleRediscovery } from './eligibility';

export type MemoryRow = InferSelectModel<typeof memories>;
export type InterestRow = InferSelectModel<typeof interests>;

export interface CandidateBundle {
  /** 삭제 제외 전체 memory 수 — coldstart 판정용. */
  memoryCount: number;
  eligibleMemories: MemoryRow[];
  /** centroid 있는 활성(비숨김·비휴면) interest. */
  activeInterests: InterestRow[];
  /** reflection 후보가 되는 rising interest (momentum ≥ 0.5). */
  risingInterests: InterestRow[];
  /** topic → 과거 피드백 집계 (like/open = pos, impression = imp). */
  topicStats: Map<string, { pos: number; imp: number }>;
  /** memory_links가 있는 memory id — reason_code 'connection' 판정용. */
  linkedMemoryIds: Set<string>;
}

const POSITIVE_ACTIONS = new Set(['like', 'open_external', 'open_detail']);

export async function collectCandidates(db: Db, userId: string, now: Date): Promise<CandidateBundle> {
  const memRows = await db
    .select()
    .from(memories)
    .where(and(eq(memories.userId, userId), isNull(memories.deletedAt)));
  const eligibleMemories = memRows.filter((m) => isEligibleRediscovery(m, now));

  const interestRows = await db.select().from(interests).where(eq(interests.userId, userId));
  const activeInterests = interestRows.filter(
    (i) => !i.isHidden && i.status !== 'dormant' && i.centroid !== null,
  );
  const risingInterests = activeInterests.filter(
    (i) => i.status === 'rising' && i.momentum >= SCORING.reflectionMomentumThreshold,
  );

  const feedbackRows = await db
    .select({ action: cardFeedbacks.action, topics: memories.topics })
    .from(cardFeedbacks)
    .innerJoin(briefCards, eq(cardFeedbacks.cardId, briefCards.id))
    .innerJoin(memories, eq(briefCards.memoryId, memories.id))
    .where(eq(cardFeedbacks.userId, userId));
  const topicStats = new Map<string, { pos: number; imp: number }>();
  for (const row of feedbackRows) {
    for (const topic of row.topics) {
      const s = topicStats.get(topic) ?? { pos: 0, imp: 0 };
      if (row.action === 'impression') s.imp++;
      else if (POSITIVE_ACTIONS.has(row.action)) s.pos++;
      topicStats.set(topic, s);
    }
  }

  const linkedMemoryIds = new Set<string>();
  const eligibleIds = eligibleMemories.map((m) => m.id);
  if (eligibleIds.length > 0) {
    const links = await db
      .select({ a: memoryLinks.memoryA, b: memoryLinks.memoryB })
      .from(memoryLinks)
      .where(or(inArray(memoryLinks.memoryA, eligibleIds), inArray(memoryLinks.memoryB, eligibleIds)));
    for (const l of links) {
      linkedMemoryIds.add(l.a);
      linkedMemoryIds.add(l.b);
    }
  }

  return {
    memoryCount: memRows.length,
    eligibleMemories,
    activeInterests,
    risingInterests,
    topicStats,
    linkedMemoryIds,
  };
}
