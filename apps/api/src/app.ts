import fs from 'node:fs';
import path from 'node:path';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { createOpenAiAdapters } from '@rudy/ai';
import { createDb } from '@rudy/db';
import { QUEUE_INGEST, QUEUE_PUSH, createStorage, loadEnv, type Env, type PushJobData } from '@rudy/shared';
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
import { registerUploadRoutes } from './routes/uploads';
import type { AppType } from './lib/appType';
import './types';

export async function buildApp(env: Env = loadEnv()): Promise<AppType> {
  const app = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const ingestQueue = new Queue(QUEUE_INGEST, { connection });
  const pushQueue = new Queue<PushJobData>(QUEUE_PUSH, { connection });
  const ai = env.OPENAI_API_KEY ? createOpenAiAdapters(env) : null;

  app.decorate('db', createDb(env.DATABASE_URL));
  app.decorate('env', env);
  app.decorate('ingestQueue', ingestQueue);
  app.decorate('pushQueue', pushQueue);
  app.decorate('embedding', ai?.embedding ?? null);
  app.decorate('storage', createStorage(env));
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
    await pushQueue.close();
    connection.disconnect();
  });

  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
  // dev 스토리지(local) 서빙 — 업로드 이미지 공개 URL (M4).
  const uploadsRoot = path.resolve(process.cwd(), env.UPLOADS_DIR);
  fs.mkdirSync(uploadsRoot, { recursive: true });
  await app.register(fastifyStatic, { root: uploadsRoot, prefix: '/uploads/' });

  app.get('/health', async () => ({ status: 'ok' }));
  registerAuthRoutes(app, env);
  registerMemoryRoutes(app);
  registerMeRoutes(app);
  registerInterestRoutes(app);
  registerBriefRoutes(app);
  registerUploadRoutes(app);

  return app;
}
