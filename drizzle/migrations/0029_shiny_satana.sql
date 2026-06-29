ALTER TABLE "quote_ai_suggestions" ADD COLUMN "signal_bucket" text DEFAULT 'low_signal' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_ai_suggestions" ADD COLUMN "signal_label" text DEFAULT 'Low signal' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_ai_suggestions" ADD COLUMN "analytics_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_ai_suggestions" ADD COLUMN "recommendation_kind" text DEFAULT 'act_now' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_ai_suggestions" ADD COLUMN "revisit_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quote_ai_suggestions" ADD COLUMN "watch_for_signals" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_ai_suggestions" ADD COLUMN "stale_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quote_ai_suggestions" ADD COLUMN "stale_reason" text;--> statement-breakpoint
CREATE INDEX "quote_ai_suggestions_signal_bucket_idx" ON "quote_ai_suggestions" USING btree ("signal_bucket");--> statement-breakpoint
CREATE INDEX "quote_ai_suggestions_stale_at_idx" ON "quote_ai_suggestions" USING btree ("stale_at");