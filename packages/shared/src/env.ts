import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  JWT_SECRET: z.string().min(1),
  AUTH_DEV_MODE: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),

  // AI — optional at M0/boot; required once ingestion (M1) runs.
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_MODEL_REASON: z.string().default('gpt-4o-mini'),
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1024),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  /** local 드라이버 저장 경로 — api/worker가 같은 디렉터리를 봐야 한다 (기본: 레포 루트 /uploads). */
  UPLOADS_DIR: z.string().default('../../uploads'),
  /** 업로드 파일의 공개 URL 베이스 (기기에서 접근 가능한 API 주소). */
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:3000'),

  // M4 — 소셜 로그인·푸시
  APPLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  EXPO_ACCESS_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}
