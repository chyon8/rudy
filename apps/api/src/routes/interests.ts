import { interests, memories, memoryInterests } from '@rudy/db';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { AppType } from '../lib/appType';
import { toMemoryDto } from '../lib/dto';
import { notFound } from '../lib/errors';

const IdParamSchema = z.object({ id: z.string().uuid() });
const PatchBodySchema = z.object({ is_hidden: z.boolean() });

function toInterestDto(i: typeof interests.$inferSelect) {
  return {
    id: i.id,
    name: i.name,
    memory_count: i.memoryCount,
    strength: i.strength,
    momentum: i.momentum,
    status: i.status,
  };
}

export function registerInterestRoutes(app: AppType): void {
  const auth = { preHandler: app.authenticate };

  app.get('/v1/interests', auth, async (req) => {
    const rows = await app.db
      .select()
      .from(interests)
      .where(and(eq(interests.userId, req.userId), eq(interests.isHidden, false)))
      .orderBy(desc(interests.strength));
    return { items: rows.map(toInterestDto) };
  });

  app.get(
    '/v1/interests/:id/memories',
    { ...auth, schema: { params: IdParamSchema } },
    async (req) => {
      const owned = await app.db
        .select({ id: interests.id })
        .from(interests)
        .where(and(eq(interests.id, req.params.id), eq(interests.userId, req.userId)))
        .limit(1);
      if (!owned[0]) throw notFound('Interest not found');

      const rows = await app.db
        .select({ memory: memories })
        .from(memoryInterests)
        .innerJoin(memories, eq(memoryInterests.memoryId, memories.id))
        .where(and(eq(memoryInterests.interestId, req.params.id), isNull(memories.deletedAt)))
        .orderBy(desc(memories.createdAt));
      return { items: rows.map((r) => toMemoryDto(r.memory)) };
    },
  );

  app.patch(
    '/v1/interests/:id',
    { ...auth, schema: { params: IdParamSchema, body: PatchBodySchema } },
    async (req) => {
      const updated = await app.db
        .update(interests)
        .set({ isHidden: req.body.is_hidden, updatedAt: new Date() })
        .where(and(eq(interests.id, req.params.id), eq(interests.userId, req.userId)))
        .returning();
      if (!updated[0]) throw notFound('Interest not found');
      return toInterestDto(updated[0]);
    },
  );
}
