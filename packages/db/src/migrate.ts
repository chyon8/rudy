import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { loadEnv } from '@rudy/shared';

const env = loadEnv();
const sql = postgres(env.DATABASE_URL, { max: 1 });

// pgvector 확장을 먼저 활성화한 뒤 마이그레이션 적용.
await sql`create extension if not exists vector`;
await migrate(drizzle(sql), {
  migrationsFolder: new URL('../drizzle', import.meta.url).pathname,
});
await sql.end();
console.log('[db] migrations applied');
