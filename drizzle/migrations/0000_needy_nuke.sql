CREATE TYPE "public"."ai_complexity" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."client_type" AS ENUM('builder', 'homeowner', 'architect');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('open', 'scroll', 'close');--> statement-breakpoint
CREATE TYPE "public"."outcome" AS ENUM('won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."pipeline_stage" AS ENUM('estimate', 'pending_quote', 'quote_sent', 'intent_scoring', 'closed');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'staff');--> statement-breakpoint
CREATE TYPE "public"."status_tag" AS ENUM('hot', 'warm', 'cold', 'dead');--> statement-breakpoint
CREATE TABLE "quote_engagement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"total_opens" integer DEFAULT 0 NOT NULL,
	"total_time_ms" bigint DEFAULT 0 NOT NULL,
	"max_scroll_depth" integer DEFAULT 0 NOT NULL,
	"unique_sessions" integer DEFAULT 0 NOT NULL,
	"unique_devices" integer DEFAULT 0 NOT NULL,
	"forwarding_suspected" boolean DEFAULT false NOT NULL,
	"last_opened_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_engagement_quote_id_unique" UNIQUE("quote_id")
);
--> statement-breakpoint
CREATE TABLE "quote_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"event_type" "event_type" NOT NULL,
	"device_type" text,
	"session_id" uuid NOT NULL,
	"scroll_depth" integer,
	"duration_ms" integer,
	"ip_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"servicem8_uuid" text NOT NULL,
	"token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"client_name" text NOT NULL,
	"company_name" text,
	"job_description" text,
	"quote_value" numeric(10, 2),
	"pipeline_stage" "pipeline_stage" DEFAULT 'pending_quote' NOT NULL,
	"outcome" "outcome",
	"work_order_id" text,
	"converted_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"status_tag" "status_tag",
	"client_type" "client_type",
	"ai_score" integer,
	"ai_confidence" numeric(4, 3),
	"ai_complexity" "ai_complexity",
	"internal_notes" text,
	"sent_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "tag_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"overridden_by" uuid NOT NULL,
	"previous_tag" "status_tag" NOT NULL,
	"new_tag" "status_tag" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" DEFAULT 'staff' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "quote_engagement" ADD CONSTRAINT "quote_engagement_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_events" ADD CONSTRAINT "quote_events_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_overrides" ADD CONSTRAINT "tag_overrides_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_overrides" ADD CONSTRAINT "tag_overrides_overridden_by_users_id_fk" FOREIGN KEY ("overridden_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;