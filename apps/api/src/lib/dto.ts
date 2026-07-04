import type { InferSelectModel } from 'drizzle-orm';
import type { memories, users } from '@rudy/db';

type UserRow = InferSelectModel<typeof users>;
type MemoryRow = InferSelectModel<typeof memories>;

export function toUserDto(u: UserRow) {
  return {
    id: u.id,
    display_name: u.displayName,
    locale: u.locale,
    notify_time: u.notifyTime,
    timezone: u.timezone,
    hide_notification_content: u.hideNotificationContent,
  };
}

export function toMemoryDto(m: MemoryRow) {
  return {
    id: m.id,
    type: m.type,
    source_url: m.sourceUrl,
    title: m.title,
    thumbnail_url: m.thumbnailUrl,
    raw_text: m.rawText,
    summary: m.summary,
    content_type: m.contentType,
    topics: m.topics,
    inferred_intent: m.inferredIntent,
    time_sensitivity: m.timeSensitivity,
    analysis_status: m.analysisStatus,
    created_at: m.createdAt.toISOString(),
    updated_at: m.updatedAt.toISOString(),
  };
}
