/**
 * Interest Engine 수동 실행 (dev 전용) — 새벽 스케줄을 기다리지 않고 배치를 즉시 돌려본다.
 *
 * 사용법: pnpm -F @rudy/worker interest
 */
import { createOpenAiAdapters } from '@rudy/ai';
import { createDb } from '@rudy/db';
import { loadEnv } from '@rudy/shared';
import { runInterestBatch } from '../interest/engine';

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
const { llm } = createOpenAiAdapters(env);

runInterestBatch({ db, llm })
  .then(() => {
    console.log('[interest] batch done');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
