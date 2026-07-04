import {
  CreateMemoryBodySchema,
  ListMemoriesQuerySchema,
  SearchBodySchema,
  UpdateMemoryBodySchema,
  decodeCursor,
  encodeCursor,
  normalizeUrl,
} from '@rudy/shared';
import { memories, memoryLinks } from '@rudy/db';
import { and, cosineDistance, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import type { AppType } from '../lib/appType';
import { toMemoryDto } from '../lib/dto';
import { notFound, serviceUnavailable } from '../lib/errors';

const IdParamSchema = z.object({ id: z.string().uuid() });

export function registerMemoryRoutes(app: AppType): void {
  const auth = { preHandler: app.authenticate };

  // 저장 — DB insert 후 ingest 큐 enqueue. AI 호출 없음 (p95 300ms).
  app.post('/v1/memories', { ...auth, schema: { body: CreateMemoryBodySchema } }, async (req, reply) => {
    const body = req.body;
    const userId = req.userId;
    const normalized = body.source_url ? normalizeUrl(body.source_url) : null;
    const note = body.type === 'thought' ? body.raw_text : body.user_note;

    // 동일 URL 재저장 → 기존 memory 반환 (F4).
    if (body.type === 'link' && normalized) {
      const dup = await findLiveLink(app, userId, normalized);
      if (dup) return replyExisting(app, reply, dup.id, note);
    }

    try {
      const inserted = await app.db
        .insert(memories)
        .values({
          userId,
          type: body.type,
          sourceUrl: body.source_url ?? null,
          sourceUrlNormalized: normalized,
          rawText: note ?? null,
        })
        .returning();
      const mem = inserted[0];
      if (!mem) throw new Error('insert returned no row');

      await app.ingestQueue.add(
        'ingest',
        { memoryId: mem.id },
        { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: true, removeOnFail: 500 },
      );
      return reply.status(201).send({ id: mem.id, analysis_status: 'pending' });
    } catch (err) {
      // partial unique 경합 → 기존 반환.
      if ((err as { code?: string }).code === '23505' && normalized) {
        const dup = await findLiveLink(app, userId, normalized);
        if (dup) return replyExisting(app, reply, dup.id, note);
      }
      throw err;
    }
  });

  app.get('/v1/memories', { ...auth, schema: { querystring: ListMemoriesQuerySchema } }, async (req) => {
    const { cursor, limit } = req.query;
    const decoded = cursor ? decodeCursor(cursor) : null;
    const keyset = decoded
      ? or(
          lt(memories.createdAt, new Date(decoded.createdAt)),
          and(eq(memories.createdAt, new Date(decoded.createdAt)), lt(memories.id, decoded.id)),
        )
      : undefined;

    const rows = await app.db
      .select()
      .from(memories)
      .where(and(eq(memories.userId, req.userId), isNull(memories.deletedAt), keyset))
      .orderBy(desc(memories.createdAt), desc(memories.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      items: page.map(toMemoryDto),
      next_cursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  });

  app.get('/v1/memories/:id', { ...auth, schema: { params: IdParamSchema } }, async (req) => {
    const mem = await getOwnedMemory(app, req.userId, req.params.id);
    const linked = await getLinkedMemories(app, req.userId, mem.id);
    return { ...toMemoryDto(mem), linked_memories: linked.map(toMemoryDto) };
  });

  app.patch(
    '/v1/memories/:id',
    { ...auth, schema: { params: IdParamSchema, body: UpdateMemoryBodySchema } },
    async (req) => {
      const mem = await getOwnedMemory(app, req.userId, req.params.id);
      const text = req.body.raw_text ?? req.body.user_note;
      if (text === undefined) return toMemoryDto(mem);
      const updated = await app.db
        .update(memories)
        .set({ rawText: text, updatedAt: new Date() })
        .where(eq(memories.id, mem.id))
        .returning();
      return toMemoryDto(updated[0] ?? mem);
    },
  );

  app.delete('/v1/memories/:id', { ...auth, schema: { params: IdParamSchema } }, async (req, reply) => {
    const mem = await getOwnedMemory(app, req.userId, req.params.id);
    await app.db.update(memories).set({ deletedAt: new Date() }).where(eq(memories.id, mem.id));
    return reply.status(204).send();
  });

  // 시맨틱 검색 — 쿼리 임베딩 → cosine top 20.
  app.post('/v1/memories/search', { ...auth, schema: { body: SearchBodySchema } }, async (req) => {
    if (!app.embedding) throw serviceUnavailable('Search is unavailable (no embedding provider)');
    const vector = await app.embedding.embed(req.body.query);
    const distance = cosineDistance(memories.embedding, vector);
    const rows = await app.db
      .select()
      .from(memories)
      .where(
        and(
          eq(memories.userId, req.userId),
          isNull(memories.deletedAt),
          eq(memories.analysisStatus, 'ready'),
        ),
      )
      .orderBy(distance)
      .limit(20);
    return { items: rows.map(toMemoryDto) };
  });
}

async function findLiveLink(app: AppType, userId: string, normalized: string) {
  const rows = await app.db
    .select()
    .from(memories)
    .where(
      and(
        eq(memories.userId, userId),
        eq(memories.sourceUrlNormalized, normalized),
        eq(memories.type, 'link'),
        isNull(memories.deletedAt),
      ),
    )
    .limit(1);
  return rows[0];
}

async function replyExisting(app: AppType, reply: FastifyReply, id: string, note: string | undefined) {
  if (note) {
    await app.db
      .update(memories)
      .set({ rawText: sql`coalesce(${memories.rawText} || E'\n', '') || ${note}`, updatedAt: new Date() })
      .where(eq(memories.id, id));
  } else {
    await app.db.update(memories).set({ updatedAt: new Date() }).where(eq(memories.id, id));
  }
  const rows = await app.db.select().from(memories).where(eq(memories.id, id)).limit(1);
  return reply.status(200).send({ id, analysis_status: rows[0]?.analysisStatus ?? 'pending' });
}

async function getOwnedMemory(app: AppType, userId: string, id: string) {
  const rows = await app.db
    .select()
    .from(memories)
    .where(and(eq(memories.id, id), eq(memories.userId, userId), isNull(memories.deletedAt)))
    .limit(1);
  const mem = rows[0];
  if (!mem) throw notFound('Memory not found');
  return mem;
}

async function getLinkedMemories(app: AppType, userId: string, memoryId: string) {
  const links = await app.db
    .select()
    .from(memoryLinks)
    .where(or(eq(memoryLinks.memoryA, memoryId), eq(memoryLinks.memoryB, memoryId)))
    .orderBy(desc(memoryLinks.similarity))
    .limit(3);
  const otherIds = links.map((l) => (l.memoryA === memoryId ? l.memoryB : l.memoryA));
  if (otherIds.length === 0) return [];
  return app.db
    .select()
    .from(memories)
    .where(and(inArray(memories.id, otherIds), eq(memories.userId, userId), isNull(memories.deletedAt)));
}
