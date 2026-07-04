import 'fastify';
import type { Queue } from 'bullmq';
import type { EmbeddingPort } from '@rudy/ai';
import type { Db } from '@rudy/db';
import type { Env, PushJobData, StoragePort } from '@rudy/shared';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    env: Env;
    ingestQueue: Queue;
    pushQueue: Queue<PushJobData>;
    embedding: EmbeddingPort | null;
    storage: StoragePort;
    authenticate: (req: import('fastify').FastifyRequest) => Promise<void>;
  }
  interface FastifyRequest {
    userId: string;
  }
}
