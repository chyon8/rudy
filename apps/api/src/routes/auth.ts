import { AuthAppleBodySchema, AuthDevBodySchema, AuthGoogleBodySchema, type Env, type Locale } from '@rudy/shared';
import { users } from '@rudy/db';
import { and, eq } from 'drizzle-orm';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { AppType } from '../lib/appType';
import { toUserDto } from '../lib/dto';
import { AppError, notFound, serviceUnavailable, unauthorized } from '../lib/errors';
import { signToken } from '../lib/jwt';

const appleJwks = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

export function registerAuthRoutes(app: AppType, env: Env): void {
  app.post('/v1/auth/dev', { schema: { body: AuthDevBodySchema } }, async (req, reply) => {
    if (!env.AUTH_DEV_MODE) throw notFound();
    const { email, timezone, locale } = req.body;
    const user = await upsertUser(app, {
      provider: 'dev',
      authId: email,
      displayName: email.split('@')[0],
      timezone,
      locale,
    });
    return reply.status(200).send({ token: signToken(user.id, env.JWT_SECRET), user: toUserDto(user) });
  });

  // Sign in with Apple — identity token을 Apple JWKS로 검증 (M4).
  app.post('/v1/auth/apple', { schema: { body: AuthAppleBodySchema } }, async (req, reply) => {
    if (!env.APPLE_CLIENT_ID) throw serviceUnavailable('Apple login is not configured (APPLE_CLIENT_ID)');
    let payload;
    try {
      const verified = await jwtVerify(req.body.identity_token, appleJwks, {
        issuer: 'https://appleid.apple.com',
        audience: env.APPLE_CLIENT_ID.split(','),
      });
      payload = verified.payload;
    } catch {
      throw unauthorized('Invalid Apple identity token');
    }
    if (!payload.sub) throw unauthorized('Apple token has no subject');

    const user = await upsertUser(app, {
      provider: 'apple',
      authId: payload.sub,
      displayName: req.body.display_name ?? (typeof payload.email === 'string' ? payload.email.split('@')[0] : undefined),
      timezone: req.body.timezone,
      locale: req.body.locale,
    });
    return reply.status(200).send({ token: signToken(user.id, env.JWT_SECRET), user: toUserDto(user) });
  });

  // Google Sign-In — tokeninfo 엔드포인트로 ID 토큰 검증 (M4).
  app.post('/v1/auth/google', { schema: { body: AuthGoogleBodySchema } }, async (req, reply) => {
    if (!env.GOOGLE_CLIENT_ID) throw serviceUnavailable('Google login is not configured (GOOGLE_CLIENT_ID)');
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(req.body.id_token)}`,
    );
    if (!res.ok) throw unauthorized('Invalid Google id token');
    const info = (await res.json()) as { aud?: string; sub?: string; email?: string; name?: string };
    if (info.aud !== env.GOOGLE_CLIENT_ID || !info.sub) throw unauthorized('Google token audience mismatch');

    const user = await upsertUser(app, {
      provider: 'google',
      authId: info.sub,
      displayName: info.name ?? info.email?.split('@')[0],
      timezone: req.body.timezone,
      locale: req.body.locale,
    });
    return reply.status(200).send({ token: signToken(user.id, env.JWT_SECRET), user: toUserDto(user) });
  });
}

async function upsertUser(
  app: AppType,
  identity: { provider: 'apple' | 'google' | 'dev'; authId: string; displayName?: string; timezone?: string; locale?: Locale },
) {
  const existing = await app.db
    .select()
    .from(users)
    .where(and(eq(users.authProvider, identity.provider), eq(users.authId, identity.authId)))
    .limit(1);
  if (existing[0]) return existing[0];

  const inserted = await app.db
    .insert(users)
    .values({
      authProvider: identity.provider,
      authId: identity.authId,
      displayName: identity.displayName ?? null,
      timezone: identity.timezone ?? 'UTC',
      locale: identity.locale ?? 'en',
    })
    .returning();
  const user = inserted[0];
  if (!user) throw new AppError('internal_error', 500, 'Failed to create user');
  return user;
}
