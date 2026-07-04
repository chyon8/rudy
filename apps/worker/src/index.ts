import { createOpenAiAdapters } from '@rudy/ai';
import { createDb } from '@rudy/db';
import {
  QUEUE_BATCH,
  QUEUE_BRIEF,
  QUEUE_INGEST,
  QUEUE_PUSH,
  createStorage,
  loadEnv,
  type PushJobData,
} from '@rudy/shared';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { runBriefTick } from './brief/scheduler';
import { ingestMemory, markDegraded } from './ingest/pipeline';
import { runInterestBatch } from './interest/engine';
import { processPushJob } from './push/send';
import { runUserModelWeekly } from './userModel/weekly';

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
const { llm, embedding } = createOpenAiAdapters(env);
const storage = createStorage(env);
const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

interface IngestJobData {
  memoryId: string;
}

const worker = new Worker<IngestJobData>(
  QUEUE_INGEST,
  async (job) => {
    await ingestMemory(job.data.memoryId, { db, llm, embedding, storage });
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

// Brief 스케줄러 — 15분 repeatable tick (docs/spec.md §4).
const briefQueue = new Queue(QUEUE_BRIEF, { connection });
const pushQueue = new Queue<PushJobData>(QUEUE_PUSH, { connection });
await briefQueue.upsertJobScheduler('brief-tick', { every: 15 * 60 * 1000 }, { name: 'tick' });

const briefWorker = new Worker(
  QUEUE_BRIEF,
  async () => {
    await runBriefTick({ db, llm, pushQueue });
  },
  { connection, concurrency: 1 },
);

briefWorker.on('ready', () => {
  console.log(`[worker] brief scheduler ready — 15m tick on queue "${QUEUE_BRIEF}"`);
});

briefWorker.on('failed', (_job, err) => {
  console.error('[worker] brief tick failed:', err.message);
});

// 푸시 발송 — brief 완료 시 예약된 delayed job (§4.6).
const pushWorker = new Worker<PushJobData>(
  QUEUE_PUSH,
  async (job) => {
    await processPushJob(db, env, job.data);
  },
  { connection, concurrency: 2 },
);

pushWorker.on('completed', (job) => {
  console.log(`[worker] push sent: ${job.id}`);
});

pushWorker.on('failed', (job, err) => {
  console.error(`[worker] push ${job?.id} failed:`, err.message);
});

// M5 배치 — interest engine 일 1회 새벽(서버 로컬 03:00), user_model 주 1회 스텁 (docs/spec.md §5).
const batchQueue = new Queue(QUEUE_BATCH, { connection });
await batchQueue.upsertJobScheduler('interest-daily', { pattern: '0 3 * * *' }, { name: 'interest' });
await batchQueue.upsertJobScheduler('user-model-weekly', { pattern: '0 4 * * 1' }, { name: 'user_model' });

const batchWorker = new Worker(
  QUEUE_BATCH,
  async (job) => {
    if (job.name === 'interest') await runInterestBatch({ db, llm });
    else if (job.name === 'user_model') await runUserModelWeekly();
  },
  { connection, concurrency: 1 },
);

batchWorker.on('completed', (job) => {
  console.log(`[worker] batch "${job.name}" done`);
});

batchWorker.on('failed', (job, err) => {
  console.error(`[worker] batch ${job?.name} failed:`, err.message);
});

console.log('[worker] starting…');
