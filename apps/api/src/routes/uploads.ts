import type { AppType } from '../lib/appType';
import { AppError } from '../lib/errors';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic']);

/** 이미지 업로드 (M4) — multipart 1파일 → StoragePort 저장 → 공개 URL 반환. */
export function registerUploadRoutes(app: AppType): void {
  app.post('/v1/uploads', { preHandler: app.authenticate }, async (req, reply) => {
    const file = await req.file();
    if (!file) throw new AppError('validation_error', 400, 'A file field is required');
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      throw new AppError('validation_error', 400, `Unsupported image type: ${file.mimetype}`);
    }
    const buffer = await file.toBuffer();
    const key = await app.storage.put(buffer, file.mimetype);
    return reply.status(201).send({ key, url: app.storage.getPublicUrl(key) });
  });
}
