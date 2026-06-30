ALTER TABLE "quote_conversation_snapshots" ADD COLUMN "triggered_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "quote_conversation_snapshots" ADD COLUMN "structured_summary" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_conversation_snapshots" ADD COLUMN "source_status" text DEFAULT 'complete' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_conversation_snapshots" ADD COLUMN "source_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_conversation_snapshots" ADD COLUMN "safe_error" text;--> statement-breakpoint
ALTER TABLE "quote_conversation_snapshots" ADD CONSTRAINT "quote_conversation_snapshots_triggered_by_user_id_users_id_fk" FOREIGN KEY ("triggered_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quote_conversation_snapshots_triggered_by_idx" ON "quote_conversation_snapshots" USING btree ("triggered_by_user_id");