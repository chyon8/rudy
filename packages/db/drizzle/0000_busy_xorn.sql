CREATE TABLE "brief_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brief_id" uuid NOT NULL,
	"memory_id" uuid,
	"external_content" jsonb,
	"card_type" text NOT NULL,
	"reason_code" text NOT NULL,
	"curation_reason" text,
	"position" integer NOT NULL,
	"score" double precision,
	"score_breakdown" jsonb
);
--> statement-breakpoint
CREATE TABLE "card_feedbacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"brief_date" text NOT NULL,
	"greeting" text,
	"closing" text,
	"status" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"centroid" vector(1024),
	"memory_count" integer DEFAULT 0 NOT NULL,
	"strength" double precision DEFAULT 0 NOT NULL,
	"momentum" double precision DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'stable' NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"last_engaged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"source_url" text,
	"source_url_normalized" text,
	"raw_text" text,
	"title" text,
	"thumbnail_url" text,
	"summary" text,
	"content_type" text,
	"topics" text[] DEFAULT '{}' NOT NULL,
	"inferred_intent" text,
	"time_sensitivity" text,
	"expires_at" timestamp with time zone,
	"embedding" vector(1024),
	"analysis_status" text DEFAULT 'pending' NOT NULL,
	"last_surfaced_at" timestamp with time zone,
	"surface_count" integer DEFAULT 0 NOT NULL,
	"suppressed_until" timestamp with time zone,
	"is_excluded" boolean DEFAULT false NOT NULL,
	"link_alive" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "memory_interests" (
	"memory_id" uuid NOT NULL,
	"interest_id" uuid NOT NULL,
	"similarity" double precision NOT NULL,
	CONSTRAINT "memory_interests_memory_id_interest_id_pk" PRIMARY KEY("memory_id","interest_id")
);
--> statement-breakpoint
CREATE TABLE "memory_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"memory_a" uuid NOT NULL,
	"memory_b" uuid NOT NULL,
	"link_type" text NOT NULL,
	"similarity" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_model" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"format_preference" jsonb,
	"reason_type_affinity" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_provider" text NOT NULL,
	"auth_id" text NOT NULL,
	"display_name" text,
	"locale" text DEFAULT 'en' NOT NULL,
	"notify_time" time DEFAULT '08:00' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"expo_push_token" text,
	"hide_notification_content" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "brief_cards" ADD CONSTRAINT "brief_cards_brief_id_daily_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."daily_briefs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brief_cards" ADD CONSTRAINT "brief_cards_memory_id_memories_id_fk" FOREIGN KEY ("memory_id") REFERENCES "public"."memories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_feedbacks" ADD CONSTRAINT "card_feedbacks_card_id_brief_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."brief_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_feedbacks" ADD CONSTRAINT "card_feedbacks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_briefs" ADD CONSTRAINT "daily_briefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interests" ADD CONSTRAINT "interests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_interests" ADD CONSTRAINT "memory_interests_memory_id_memories_id_fk" FOREIGN KEY ("memory_id") REFERENCES "public"."memories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_interests" ADD CONSTRAINT "memory_interests_interest_id_interests_id_fk" FOREIGN KEY ("interest_id") REFERENCES "public"."interests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_links" ADD CONSTRAINT "memory_links_memory_a_memories_id_fk" FOREIGN KEY ("memory_a") REFERENCES "public"."memories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_links" ADD CONSTRAINT "memory_links_memory_b_memories_id_fk" FOREIGN KEY ("memory_b") REFERENCES "public"."memories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_model" ADD CONSTRAINT "user_model_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "card_feedbacks_impression_uniq" ON "card_feedbacks" USING btree ("card_id") WHERE "card_feedbacks"."action" = 'impression';--> statement-breakpoint
CREATE UNIQUE INDEX "daily_briefs_user_date_uniq" ON "daily_briefs" USING btree ("user_id","brief_date");--> statement-breakpoint
CREATE INDEX "memories_user_created_idx" ON "memories" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "memories_user_status_idx" ON "memories" USING btree ("user_id","analysis_status");--> statement-breakpoint
CREATE UNIQUE INDEX "memories_user_url_uniq" ON "memories" USING btree ("user_id","source_url_normalized") WHERE "memories"."deleted_at" is null and "memories"."type" = 'link';--> statement-breakpoint
CREATE UNIQUE INDEX "memory_links_pair_uniq" ON "memory_links" USING btree ("memory_a","memory_b");--> statement-breakpoint
CREATE UNIQUE INDEX "users_provider_id_uniq" ON "users" USING btree ("auth_provider","auth_id");