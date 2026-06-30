CREATE TABLE "quote_ai_generation_failures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"conversation_snapshot_id" uuid,
	"triggered_by_user_id" uuid NOT NULL,
	"failure_stage" text NOT NULL,
	"error_message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_ai_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"conversation_snapshot_id" uuid,
	"triggered_by_user_id" uuid NOT NULL,
	"next_viable_move" text NOT NULL,
	"suggested_win_path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_conversation_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"snapshot_cursor" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quote_ai_generation_failures" ADD CONSTRAINT "quote_ai_generation_failures_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_ai_generation_failures" ADD CONSTRAINT "quote_ai_generation_failures_conversation_snapshot_id_quote_conversation_snapshots_id_fk" FOREIGN KEY ("conversation_snapshot_id") REFERENCES "public"."quote_conversation_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_ai_generation_failures" ADD CONSTRAINT "quote_ai_generation_failures_triggered_by_user_id_users_id_fk" FOREIGN KEY ("triggered_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_ai_suggestions" ADD CONSTRAINT "quote_ai_suggestions_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_ai_suggestions" ADD CONSTRAINT "quote_ai_suggestions_conversation_snapshot_id_quote_conversation_snapshots_id_fk" FOREIGN KEY ("conversation_snapshot_id") REFERENCES "public"."quote_conversation_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_ai_suggestions" ADD CONSTRAINT "quote_ai_suggestions_triggered_by_user_id_users_id_fk" FOREIGN KEY ("triggered_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_conversation_snapshots" ADD CONSTRAINT "quote_conversation_snapshots_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quote_ai_generation_failures_quote_created_idx" ON "quote_ai_generation_failures" USING btree ("quote_id","created_at");--> statement-breakpoint
CREATE INDEX "quote_ai_generation_failures_triggered_by_idx" ON "quote_ai_generation_failures" USING btree ("triggered_by_user_id");--> statement-breakpoint
CREATE INDEX "quote_ai_suggestions_quote_created_idx" ON "quote_ai_suggestions" USING btree ("quote_id","created_at");--> statement-breakpoint
CREATE INDEX "quote_ai_suggestions_snapshot_idx" ON "quote_ai_suggestions" USING btree ("conversation_snapshot_id");--> statement-breakpoint
CREATE INDEX "quote_ai_suggestions_triggered_by_idx" ON "quote_ai_suggestions" USING btree ("triggered_by_user_id");--> statement-breakpoint
CREATE INDEX "quote_conversation_snapshots_quote_created_idx" ON "quote_conversation_snapshots" USING btree ("quote_id","created_at");