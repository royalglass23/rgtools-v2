ALTER TABLE "quote_ai_generation_failures" ADD COLUMN "model" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_ai_generation_failures" ADD COLUMN "prompt_version" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_ai_generation_failures" ADD COLUMN "input_snapshot_version" text;
