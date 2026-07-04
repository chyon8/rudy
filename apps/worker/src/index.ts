import { createOpenAiAdapters } from '@rudy/ai';
import { createDb } from '@rudy/db';
import { QUEUE_INGEST, loadEnv } from '@rudy/shared';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { ingestMemory, markDegraded } from './ingest/pipeline';

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
const { llm, embedding } = createOpenAiAdapters(env);
const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

interface IngestJobData {
  memoryId: string;
}

const worker = new Worker<IngestJobData>(
  QUEUE_INGEST,
  async (job) => {
    await ingestMemory(job.data.memoryId, { db, llm, embedding });
  },
  { connection, concurrency: 4 },
);

worker.on('ready', () => {
  console.log(`[worker] booted — listening on queue "${QUEUE_INGEST}"`);
});

worker.on('completed', (job) => {
  console.log(`[worker] ingested memory ${job.data.memoryId}`);
});

worker.on('failed', async (job, err) => {
  console.error(`[worker] job ${job?.id} failed:`, err.message);
  // 최종 시도까지 실패하면 degraded로 표시 (Memory 자체는 유지).
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    await markDegraded(db, job.data.memoryId).catch((e) => console.error('[worker] markDegraded failed', e));
  }
});

console.log('[worker] starting…');
