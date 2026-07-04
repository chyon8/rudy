import { AuthDevBodySchema, type Env } from '@rudy/shared';
import { users } from '@rudy/db';
import { and, eq } from 'drizzle-orm';
import type { AppType } from '../lib/appType';
import { toUserDto } from '../lib/dto';
import { notFound } from '../lib/errors';
import { signToken } from '../lib/jwt';

export function registerAuthRoutes(app: AppType, env: Env): void {
  app.post('/v1/auth/dev', { schema: { body: AuthDevBodySchema } }, async (req, reply) => {
    if (!env.AUTH_DEV_MODE) throw notFound();
    const { email, timezone, locale } = req.body;

    const existing = await app.db
      .select()
      .from(users)
      .where(and(eq(users.authProvider, 'dev'), eq(users.authId, email)))
      .limit(1);

    let user = existing[0];
    if (!user) {
      const inserted = await app.db
        .insert(users)
        .values({
          authProvider: 'dev',
          authId: email,
          displayName: email.split('@')[0],
          timezone: timezone ?? 'UTC',
          locale: locale ?? 'en',
        })
        .returning();
      user = inserted[0];
    }
    if (!user) throw notFound('Failed to create user');

    return reply.status(200).send({ token: signToken(user.id, env.JWT_SECRET), user: toUserDto(user) });
  });
}
