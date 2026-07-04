import { sql } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';

const createdAt = timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = timestamp('updated_at', { withTimezone: true }).defaultNow().notNull();

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authProvider: text('auth_provider').$type<'apple' | 'google' | 'dev'>().notNull(),
    authId: text('auth_id').notNull(),
    displayName: text('display_name'),
    // Rudy가 사용자에게 말하는 언어 — 모든 AI 산출물 언어 결정.
    locale: text('locale').$type<'en' | 'ko'>().notNull().default('en'),
    notifyTime: time('notify_time').notNull().default('08:00'),
    // 가입 시 디바이스 tz 전송, 폴백 'UTC'. 스케줄러가 널을 만나지 않도록 NOT NULL DEFAULT.
    timezone: text('timezone').notNull().default('UTC'),
    expoPushToken: text('expo_push_token'),
    hideNotificationContent: boolean('hide_notification_content').notNull().default(false),
    // 온보딩 프리셋 관심사 key — coldstart discovery 매칭에 사용 (자유 입력은 미포함).
    onboardingInterests: text('onboarding_interests').array().notNull().default(sql`'{}'`),
    createdAt,
    updatedAt,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('users_provider_id_uniq').on(t.authProvider, t.authId)],
);

export const memories = pgTable(
  'memories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<'link' | 'thought' | 'image'>().notNull(),
    sourceUrl: text('source_url'),
    sourceUrlNormalized: text('source_url_normalized'),
    rawText: text('raw_text'),
    title: text('title'),
    thumbnailUrl: text('thumbnail_url'),
    // understanding layer
    summary: text('summary'),
    contentType: text('content_type').$type<
      'video' | 'article' | 'product' | 'place' | 'idea' | 'other'
    >(),
    topics: text('topics').array().notNull().default(sql`'{}'`),
    inferredIntent: text('inferred_intent').$type<
      'learn' | 'do' | 'go' | 'buy' | 'remember' | 'inspire'
    >(),
    timeSensitivity: text('time_sensitivity').$type<
      'evergreen' | 'seasonal' | 'dated' | 'event_bound'
    >(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    embedding: vector('embedding', { dimensions: 1024 }),
    analysisStatus: text('analysis_status')
      .$type<'pending' | 'ready' | 'degraded' | 'failed'>()
      .notNull()
      .default('pending'),
    // resurface state
    lastSurfacedAt: timestamp('last_surfaced_at', { withTimezone: true }),
    surfaceCount: integer('surface_count').notNull().default(0),
    suppressedUntil: timestamp('suppressed_until', { withTimezone: true }),
    isExcluded: boolean('is_excluded').notNull().default(false),
    linkAlive: boolean('link_alive').notNull().default(true),
    createdAt,
    updatedAt,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('memories_user_created_idx').on(t.userId, t.createdAt.desc()),
    index('memories_user_status_idx').on(t.userId, t.analysisStatus),
    // 동일 URL 중복 저장 방지 (soft-deleted / link 타입만). F4.
    uniqueIndex('memories_user_url_uniq')
      .on(t.userId, t.sourceUrlNormalized)
      .where(sql`${t.deletedAt} is null and ${t.type} = 'link'`),
    // embedding HNSW 인덱스는 MVP에서 생성하지 않음 (정확 스캔). F7.
  ],
);

export const interests = pgTable('interests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  centroid: vector('centroid', { dimensions: 1024 }),
  memoryCount: integer('memory_count').notNull().default(0),
  strength: doublePrecision('strength').notNull().default(0),
  momentum: doublePrecision('momentum').notNull().default(0),
  status: text('status').$type<'rising' | 'stable' | 'dormant'>().notNull().default('stable'),
  isHidden: boolean('is_hidden').notNull().default(false),
  lastEngagedAt: timestamp('last_engaged_at', { withTimezone: true }),
  createdAt,
  updatedAt,
});

export const memoryInterests = pgTable(
  'memory_interests',
  {
    memoryId: uuid('memory_id')
      .notNull()
      .references(() => memories.id, { onDelete: 'cascade' }),
    interestId: uuid('interest_id')
      .notNull()
      .references(() => interests.id, { onDelete: 'cascade' }),
    similarity: doublePrecision('similarity').notNull(),
  },
  (t) => [primaryKey({ columns: [t.memoryId, t.interestId] })],
);

export const memoryLinks = pgTable(
  'memory_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // memory_a < memory_b 로 정규화해 저장.
    memoryA: uuid('memory_a')
      .notNull()
      .references(() => memories.id, { onDelete: 'cascade' }),
    memoryB: uuid('memory_b')
      .notNull()
      .references(() => memories.id, { onDelete: 'cascade' }),
    linkType: text('link_type').$type<'same_topic' | 'temporal'>().notNull(),
    similarity: doublePrecision('similarity').notNull(),
    createdAt,
  },
  (t) => [uniqueIndex('memory_links_pair_uniq').on(t.memoryA, t.memoryB)],
);

export const dailyBriefs = pgTable(
  'daily_briefs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    briefDate: text('brief_date').notNull(), // 사용자 로컬 날짜 (YYYY-MM-DD)
    greeting: text('greeting'),
    closing: text('closing'),
    status: text('status').$type<'generated' | 'fallback'>().notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('daily_briefs_user_date_uniq').on(t.userId, t.briefDate)],
);

export const briefCards = pgTable('brief_cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  briefId: uuid('brief_id')
    .notNull()
    .references(() => dailyBriefs.id, { onDelete: 'cascade' }),
  memoryId: uuid('memory_id').references(() => memories.id, { onDelete: 'cascade' }),
  externalContent: jsonb('external_content'),
  cardType: text('card_type').$type<'rediscovery' | 'discovery' | 'reflection'>().notNull(),
  reasonCode: text('reason_code')
    .$type<'timing' | 'rising_interest' | 'maturity' | 'connection' | 'surprise' | 'cold_start'>()
    .notNull(),
  curationReason: text('curation_reason'),
  position: integer('position').notNull(),
  score: doublePrecision('score'),
  scoreBreakdown: jsonb('score_breakdown'),
});

export const cardFeedbacks = pgTable(
  'card_feedbacks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cardId: uuid('card_id')
      .notNull()
      .references(() => briefCards.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    action: text('action')
      .$type<
        'open_external' | 'open_detail' | 'like' | 'not_today' | 'never' | 'impression'
      >()
      .notNull(),
    createdAt,
  },
  (t) => [
    // impression은 카드당 1건만 (클라이언트 재전송 내성). F8.
    uniqueIndex('card_feedbacks_impression_uniq')
      .on(t.cardId)
      .where(sql`${t.action} = 'impression'`),
  ],
);

export const userModel = pgTable('user_model', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  formatPreference: jsonb('format_preference'),
  reasonTypeAffinity: jsonb('reason_type_affinity'),
  updatedAt,
});
