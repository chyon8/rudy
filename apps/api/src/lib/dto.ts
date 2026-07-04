import type { InferSelectModel } from 'drizzle-orm';
import type { briefCards, dailyBriefs, memories, users } from '@rudy/db';
import { extractYouTubeVideoId, type ExternalContent } from '@rudy/shared';

type UserRow = InferSelectModel<typeof users>;
type MemoryRow = InferSelectModel<typeof memories>;
type BriefRow = InferSelectModel<typeof dailyBriefs>;
type BriefCardRow = InferSelectModel<typeof briefCards>;

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

/** YouTube는 youtube:// 딥링크, 그 외 링크/discovery는 URL, 나머지는 상세 화면 (spec §2). */
function primaryAction(card: BriefCardRow, mem: MemoryRow | undefined) {
  if (mem?.type === 'link' && mem.sourceUrl) {
    const ytId = extractYouTubeVideoId(mem.sourceUrl);
    return {
      type: 'deeplink' as const,
      url: ytId ? `youtube://www.youtube.com/watch?v=${ytId}` : mem.sourceUrl,
    };
  }
  const external = card.externalContent as ExternalContent | null;
  if (external?.url) return { type: 'deeplink' as const, url: external.url };
  return { type: 'detail' as const };
}

export function toBriefDto(brief: BriefRow, cards: BriefCardRow[], memMap: Map<string, MemoryRow>) {
  return {
    id: brief.id,
    brief_date: brief.briefDate,
    status: brief.status,
    greeting: brief.greeting,
    closing: brief.closing,
    generated_at: brief.generatedAt.toISOString(),
    cards: [...cards]
      .sort((a, b) => a.position - b.position)
      .map((c) => {
        const mem = c.memoryId ? memMap.get(c.memoryId) : undefined;
        return {
          id: c.id,
          card_type: c.cardType,
          reason_code: c.reasonCode,
          curation_reason: c.curationReason,
          position: c.position,
          memory: mem ? toMemoryDto(mem) : null,
          external_content: (c.externalContent as ExternalContent | null) ?? null,
          primary_action: primaryAction(c, mem),
        };
      }),
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
    link_alive: m.linkAlive,
    created_at: m.createdAt.toISOString(),
    updated_at: m.updatedAt.toISOString(),
  };
}
