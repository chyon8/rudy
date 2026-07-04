import type { LlmPort, Locale } from '@rudy/ai';
import { type Db, interests, memories, memoryInterests, users } from '@rudy/db';
import { and, eq, isNull, sql } from 'drizzle-orm';
import {
  type Cluster,
  clusterMemories,
  computeStats,
  cosineSimilarity,
  reconcile,
  statusOf,
} from './cluster';

export interface InterestEngineDeps {
  db: Db;
  llm: LlmPort;
}

/** 일 1회 새벽 배치 (docs/spec.md §5) — 전체 사용자 재클러스터링·보정. 사용자 단위 실패 격리. */
export async function runInterestBatch(deps: InterestEngineDeps, now = new Date()): Promise<void> {
  const rows = await deps.db
    .select({ id: users.id, locale: users.locale })
    .from(users)
    .where(isNull(users.deletedAt));
  for (const user of rows) {
    try {
      await runInterestEngineForUser(deps, user, now);
    } catch (err) {
      console.error(`[interest] user ${user.id} failed:`, err instanceof Error ? err.message : err);
    }
  }
}

export async function runInterestEngineForUser(
  deps: InterestEngineDeps,
  user: { id: string; locale: Locale },
  now = new Date(),
): Promise<void> {
  const { db, llm } = deps;

  const mems = await db
    .select({
      id: memories.id,
      embedding: memories.embedding,
      createdAt: memories.createdAt,
      title: memories.title,
      topics: memories.topics,
    })
    .from(memories)
    .where(
      and(
        eq(memories.userId, user.id),
        isNull(memories.deletedAt),
        eq(memories.analysisStatus, 'ready'),
        sql`${memories.embedding} is not null`,
      ),
    );
  const points = mems.filter((m): m is typeof m & { embedding: number[] } => m.embedding !== null);

  const clusters = clusterMemories(points);
  // 클러스터가 없으면(메모리 부족 등) 아무것도 건드리지 않는다 — 온보딩 interests를
  // 매 새벽 dormant로 리셋하는 사고 방지 (F6).
  if (clusters.length === 0) return;

  const existing = await db
    .select({ id: interests.id, centroid: interests.centroid })
    .from(interests)
    .where(eq(interests.userId, user.id));
  const { matched, created, orphanedIds } = reconcile(clusters, existing);
  const memById = new Map(points.map((m) => [m.id, m]));

  // 1. 매칭된 클러스터: 기존 레코드 in-place 갱신 — name·is_hidden 보존 (F6).
  const clusterByInterest = new Map<string, Cluster>();
  for (const m of matched) {
    await db
      .update(interests)
      .set({ centroid: m.cluster.centroid, updatedAt: now })
      .where(eq(interests.id, m.interestId));
    clusterByInterest.set(m.interestId, m.cluster);
  }

  // 2. 미매칭 클러스터: LLM 이름 생성 후 신규 interest.
  for (const cluster of created) {
    const name = await nameCluster(llm, user.locale, cluster, memById);
    const inserted = await db
      .insert(interests)
      .values({ userId: user.id, name, centroid: cluster.centroid })
      .returning({ id: interests.id });
    if (inserted[0]) clusterByInterest.set(inserted[0].id, cluster);
  }

  // 3. 클러스터 기반 interest의 멤버십 재구성. 고아 interest의 멤버십은 보존 —
  //    Library 관심사 연속성 (dormant여도 열람 가능).
  for (const [interestId, cluster] of clusterByInterest) {
    await db.delete(memoryInterests).where(eq(memoryInterests.interestId, interestId));
    const values = cluster.memberIds.map((memoryId) => ({
      memoryId,
      interestId,
      similarity: cosineSimilarity(memById.get(memoryId)!.embedding, cluster.centroid),
    }));
    if (values.length > 0) await db.insert(memoryInterests).values(values).onConflictDoNothing();
  }

  // 4. 전체 interest의 strength/momentum/status 갱신 (strength는 사용자 내 max로 정규화).
  const membership = await db
    .select({ interestId: memoryInterests.interestId, createdAt: memories.createdAt })
    .from(memoryInterests)
    .innerJoin(memories, eq(memoryInterests.memoryId, memories.id))
    .innerJoin(interests, eq(memoryInterests.interestId, interests.id))
    .where(and(eq(interests.userId, user.id), isNull(memories.deletedAt)));
  const datesByInterest = new Map<string, Date[]>();
  for (const row of membership) {
    const list = datesByInterest.get(row.interestId) ?? [];
    list.push(row.createdAt);
    datesByInterest.set(row.interestId, list);
  }

  const allIds = [...existing.map((e) => e.id), ...clusterByInterest.keys()];
  const statsById = new Map(
    [...new Set(allIds)].map((id) => [id, computeStats(datesByInterest.get(id) ?? [], now)]),
  );
  const maxRaw = Math.max(0, ...[...statsById.values()].map((s) => s.strengthRaw));
  const orphaned = new Set(orphanedIds);
  for (const [id, stats] of statsById) {
    const strength = maxRaw > 0 ? stats.strengthRaw / maxRaw : 0;
    const status = orphaned.has(id) ? 'dormant' : statusOf(stats.momentum, strength);
    await db
      .update(interests)
      .set({ memoryCount: stats.memoryCount, strength, momentum: stats.momentum, status, updatedAt: now })
      .where(eq(interests.id, id));
  }

  console.log(
    `[interest] user ${user.id}: clusters=${clusters.length} matched=${matched.length} created=${created.length} dormant=${orphanedIds.length}`,
  );
}

/** 클러스터 멤버 title·topics 샘플로 LLM 이름 생성. 실패 시 최빈 topic 폴백 (배치를 막지 않는다). */
export async function nameCluster(
  llm: LlmPort,
  locale: Locale,
  cluster: Cluster,
  memById: Map<string, { title: string | null; topics: string[] }>,
): Promise<string> {
  const samples = cluster.memberIds
    .slice(0, 10)
    .map((id) => {
      const m = memById.get(id);
      return { title: m?.title ?? '', topics: m?.topics ?? [] };
    })
    .filter((s) => s.title || s.topics.length > 0);
  try {
    return await llm.nameInterest({ locale, samples });
  } catch {
    const counts = new Map<string, number>();
    for (const s of samples) for (const t of s.topics) counts.set(t, (counts.get(t) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return top?.[0] ?? (locale === 'ko' ? '새 관심사' : 'New interest');
  }
}
