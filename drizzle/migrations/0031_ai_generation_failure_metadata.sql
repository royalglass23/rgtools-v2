ALTER TABLE "quote_ai_generation_failures" ADD COLUMN "error_type" text DEFAULT 'generation_error' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_ai_generation_failures" ADD COLUMN "attempted_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_ai_generation_failures" ADD COLUMN "retry_after" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "quote_ai_generation_failures_retry_after_idx" ON "quote_ai_generation_failures" USING btree ("retry_after");
