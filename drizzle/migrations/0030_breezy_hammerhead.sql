ALTER TABLE "quote_ai_suggestions" ADD COLUMN "recommended_move" text DEFAULT 'wait' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_ai_suggestions" ADD COLUMN "suggested_timing" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_ai_suggestions" ADD COLUMN "timing_reason" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_ai_suggestions" ADD COLUMN "confidence" text DEFAULT 'Medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_ai_suggestions" ADD COLUMN "confidence_reason" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_ai_suggestions" ADD COLUMN "likely_customer_state" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_ai_suggestions" ADD COLUMN "reasoning" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_ai_suggestions" ADD COLUMN "email_draft_subject" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_ai_suggestions" ADD COLUMN "email_draft_body" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_ai_suggestions" ADD COLUMN "phone_talking_points" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_ai_suggestions" ADD COLUMN "use_care_guidance" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_ai_suggestions" ADD COLUMN "include_quote_link" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_ai_suggestions" ADD COLUMN "partial_context_note" text;--> statement-breakpoint
ALTER TABLE "quote_ai_suggestions" ADD COLUMN "wait_reason" text;--> statement-breakpoint
ALTER TABLE "quote_ai_suggestions" ADD COLUMN "wait_revisit_window" text;--> statement-breakpoint
ALTER TABLE "quote_ai_suggestions" ADD COLUMN "model" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_ai_suggestions" ADD COLUMN "prompt_version" text DEFAULT 'quote-ai-guidance-v1' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_ai_suggestions" ADD COLUMN "input_snapshot_version" text DEFAULT 'quote-ai-guidance-input-v1' NOT NULL;