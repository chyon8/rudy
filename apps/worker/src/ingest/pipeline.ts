import type { EmbeddingPort, LlmPort, Locale } from '@rudy/ai';
import { type Db, interests, memories, memoryInterests, memoryLinks, users } from '@rudy/db';
import { storageKeyFromUrl, type StoragePort } from '@rudy/shared';
import { and, cosineDistance, eq, isNull, ne, sql } from 'drizzle-orm';
import { extractContent, type Extracted } from './extract';

export interface IngestDeps {
  db: Db;
  llm: LlmPort;
  embedding: EmbeddingPort;
  storage: StoragePort;
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
};

/** 이미지 memory: 저장된 파일 → vision 한 줄 설명 → 이후 일반 분석 흐름에 합류 (M4). */
async function extractImage(
  mem: { thumbnailUrl: string | null },
  llm: LlmPort,
  storage: StoragePort,
  locale: Locale,
): Promise<Extracted> {
  if (!mem.thumbnailUrl) return {};
  const key = storageKeyFromUrl(mem.thumbnailUrl);
  if (!key) return {};
  const bytes = await storage.getBytes(key);
  const ext = key.split('.').pop() ?? 'jpg';
  const description = await llm.describeImage({
    imageBase64: bytes.toString('base64'),
    mimeType: MIME_BY_EXT[ext] ?? 'image/jpeg',
    locale,
  });
  const title = description.length > 60 ? `${description.slice(0, 57)}…` : description;
  return { title, body: description };
}

const LINK_THRESHOLD = 0.82;
const INTEREST_THRESHOLD = 0.75;

function domainOf(sourceUrl: string | null): string {
  if (!sourceUrl) return 'Untitled';
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, '');
  } catch {
    return 'Untitled';
  }
}

/** thought는 URL이 없어 도메인 폴백이 불가 — 본문 첫 줄을 제목으로 쓴다. */
function fallbackTitle(mem: { type: string; rawText: string | null; sourceUrl: string | null }): string {
  if (mem.type === 'thought' && mem.rawText) {
    const firstLine = mem.rawText.trim().split('\n')[0] ?? '';
    return firstLine.length > 60 ? `${firstLine.slice(0, 57)}…` : firstLine;
  }
  return domainOf(mem.sourceUrl);
}

async function userLocale(db: Db, userId: string): Promise<Locale> {
  const rows = await db.select({ locale: users.locale }).from(users).where(eq(users.id, userId)).limit(1);
  return rows[0]?.locale ?? 'en';
}

export async function ingestMemory(memoryId: string, deps: IngestDeps): Promise<void> {
  const { db, llm, embedding, storage } = deps;
  const rows = await db.select().from(memories).where(eq(memories.id, memoryId)).limit(1);
  const mem = rows[0];
  if (!mem || mem.deletedAt) return;

  const locale = await userLocale(db, mem.userId);

  // 1. 추출 (실패해도 Memory는 유지 — 분석 단계로 진행). 이미지는 vision 경유 (M4).
  let extracted: Extracted;
  try {
    extracted =
      mem.type === 'image'
        ? await extractImage(mem, llm, storage, locale)
        : await extractContent({ type: mem.type, sourceUrl: mem.sourceUrl, rawText: mem.rawText });
  } catch {
    extracted = {};
  }

  // 2. LLM 분석 (실패 시 throw → BullMQ 재시도).
  const analysis = await llm.analyzeMemory({
    title: extracted.title ?? mem.title ?? undefined,
    body: extracted.body,
    userNote: mem.rawText ?? undefined,
    savedAt: mem.createdAt.toISOString(),
    locale,
  });

  // 3. 임베딩 (title + summary + topics).
  const titleForEmbed = extracted.title ?? mem.title ?? '';
  const vector = await embedding.embed(
    `${titleForEmbed}\n${[analysis.summary, ...analysis.topics].join(' · ')}`,
  );

  await db
    .update(memories)
    .set({
      title: extracted.title ?? mem.title ?? fallbackTitle(mem),
      thumbnailUrl: extracted.thumbnailUrl ?? mem.thumbnailUrl,
      summary: analysis.summary,
      contentType: analysis.contentType,
      topics: analysis.topics,
      inferredIntent: analysis.inferredIntent,
      timeSensitivity: analysis.timeSensitivity,
      expiresAt: analysis.expiresAt ? new Date(analysis.expiresAt) : null,
      embedding: vector,
      analysisStatus: 'ready',
      updatedAt: new Date(),
    })
    .where(eq(memories.id, mem.id));

  // 4. 연결 생성 (cosine ≥ 0.82, top 3).
  await createLinks(db, mem.id, mem.userId, vector);
  // 5. 관심사 배정 (centroid cosine ≥ 0.75).
  await assignInterests(db, mem.id, mem.userId, vector);
}

async function createLinks(db: Db, memoryId: string, userId: string, vector: number[]): Promise<void> {
  const distance = cosineDistance(memories.embedding, vector);
  const candidates = await db
    .select({ id: memories.id, similarity: sql<number>`1 - (${distance})` })
    .from(memories)
    .where(
      and(
        eq(memories.userId, userId),
        ne(memories.id, memoryId),
        isNull(memories.deletedAt),
        eq(memories.analysisStatus, 'ready'),
        sql`${memories.embedding} is not null`,
      ),
    )
    .orderBy(distance)
    .limit(3);

  for (const c of candidates) {
    if (c.similarity < LINK_THRESHOLD) continue;
    const [a, b] = memoryId < c.id ? [memoryId, c.id] : [c.id, memoryId];
    await db
      .insert(memoryLinks)
      .values({ memoryA: a, memoryB: b, linkType: 'same_topic', similarity: c.similarity })
      .onConflictDoNothing();
  }
}

async function assignInterests(db: Db, memoryId: string, userId: string, vector: number[]): Promise<void> {
  const distance = cosineDistance(interests.centroid, vector);
  const candidates = await db
    .select({ id: interests.id, similarity: sql<number>`1 - (${distance})` })
    .from(interests)
    .where(and(eq(interests.userId, userId), sql`${interests.centroid} is not null`))
    .orderBy(distance);

  for (const c of candidates) {
    if (c.similarity < INTEREST_THRESHOLD) continue;
    const inserted = await db
      .insert(memoryInterests)
      .values({ memoryId, interestId: c.id, similarity: c.similarity })
      .onConflictDoNothing()
      .returning();
    if (inserted.length > 0) {
      await db
        .update(interests)
        .set({ memoryCount: sql`${interests.memoryCount} + 1`, lastEngagedAt: new Date() })
        .where(eq(interests.id, c.id));
    }
  }
}

export async function markDegraded(db: Db, memoryId: string): Promise<void> {
  const rows = await db.select().from(memories).where(eq(memories.id, memoryId)).limit(1);
  const mem = rows[0];
  if (!mem) return;
  await db
    .update(memories)
    .set({
      analysisStatus: 'degraded',
      title: mem.title ?? fallbackTitle(mem),
      updatedAt: new Date(),
    })
    .where(eq(memories.id, memoryId));
}
