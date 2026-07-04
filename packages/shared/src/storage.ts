/**
 * StoragePort (PLAN #4): dev = 로컬 디스크(API가 /uploads로 서빙), prod = S3 호환.
 * MVP는 local만 구현 — s3는 부팅 시 명시적 에러 (v1.x에서 구현).
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Env } from './env';

export interface StoragePort {
  /** 파일 저장 → key 반환. key는 경로 안전한 랜덤 이름으로 생성된다. */
  put(buffer: Buffer, contentType: string): Promise<string>;
  getPublicUrl(key: string): string;
  /** vision 분석용 바이트 읽기 (OpenAI에 base64로 전달 — 로컬 URL은 외부에서 접근 불가). */
  getBytes(key: string): Promise<Buffer>;
}

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

export function createStorage(env: Env): StoragePort {
  if (env.STORAGE_DRIVER !== 'local') {
    throw new Error('STORAGE_DRIVER=s3 is not implemented in MVP — use local');
  }
  const baseDir = path.resolve(process.cwd(), env.UPLOADS_DIR);

  return {
    async put(buffer, contentType) {
      const ext = EXT_BY_TYPE[contentType] ?? 'bin';
      const key = `${randomUUID()}.${ext}`;
      await fs.mkdir(baseDir, { recursive: true });
      await fs.writeFile(path.join(baseDir, key), buffer);
      return key;
    },
    getPublicUrl(key) {
      return `${env.PUBLIC_BASE_URL}/uploads/${key}`;
    },
    async getBytes(key) {
      // key는 put이 생성한 UUID 파일명만 허용 — 경로 탈출 방지.
      if (!/^[\w-]+\.\w+$/.test(key)) throw new Error(`Invalid storage key: ${key}`);
      return fs.readFile(path.join(baseDir, key));
    },
  };
}

/** 공개 URL에서 storage key 추출 (…/uploads/<key>). 아니면 null. */
export function storageKeyFromUrl(url: string): string | null {
  const m = url.match(/\/uploads\/([\w-]+\.\w+)$/);
  return m?.[1] ?? null;
}
