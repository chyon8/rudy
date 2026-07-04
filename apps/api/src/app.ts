import rateLimit from '@fastify/rate-limit';
import { createOpenAiAdapters } from '@rudy/ai';
import { createDb } from '@rudy/db';
import { QUEUE_INGEST, loadEnv, type Env } from '@rudy/shared';
import { Queue } from 'bullmq';
import Fastify, { type FastifyError } from 'fastify';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import IORedis from 'ioredis';
import { AppError, unauthorized } from './lib/errors';
import { verifyToken } from './lib/jwt';
import { registerAuthRoutes } from './routes/auth';
import { registerBriefRoutes } from './routes/briefs';
import { registerInterestRoutes } from './routes/interests';
import { registerMeRoutes } from './routes/me';
import { registerMemoryRoutes } from './routes/memories';
import type { AppType } from './lib/appType';
import './types';

export async function buildApp(env: Env = loadEnv()): Promise<AppType> {
  const app = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const ingestQueue = new Queue(QUEUE_INGEST, { connection });
  const ai = env.OPENAI_API_KEY ? createOpenAiAdapters(env) : null;

  app.decorate('db', createDb(env.DATABASE_URL));
  app.decorate('env', env);
  app.decorate('ingestQueue', ingestQueue);
  app.decorate('embedding', ai?.embedding ?? null);
  app.decorateRequest('userId', '');

  app.decorate('authenticate', async (req: Parameters<AppType['authenticate']>[0]) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw unauthorized('Missing bearer token');
    try {
      req.userId = verifyToken(header.slice(7), env.JWT_SECRET);
    } catch {
      throw unauthorized('Invalid or expired token');
    }
  });

  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (err instanceof AppError) {
      return reply.status(err.statusCode).send({ error: { code: err.code, message: err.message } });
    }
    if (err.validation || err.statusCode === 400) {
      return reply.status(400).send({ error: { code: 'validation_error', message: err.message } });
    }
    if (err.statusCode === 429) {
      return reply.status(429).send({ error: { code: 'rate_limited', message: 'Too many requests' } });
    }
    req.log.error(err);
    return reply.status(500).send({ error: { code: 'internal_error', message: 'Internal server error' } });
  });

  app.addHook('onClose', async () => {
    await ingestQueue.close();
    connection.disconnect();
  });

  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });

  app.get('/health', async () => ({ status: 'ok' }));
  registerAuthRoutes(app, env);
  registerMemoryRoutes(app);
  registerMeRoutes(app);
  registerInterestRoutes(app);
  registerBriefRoutes(app);

  return app;
}
