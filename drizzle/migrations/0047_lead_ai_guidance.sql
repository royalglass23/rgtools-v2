CREATE TABLE IF NOT EXISTS "lead_conversation_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lead_id" uuid NOT NULL REFERENCES "leads"("id") ON DELETE cascade,
  "triggered_by_user_id" uuid REFERENCES "users"("id"),
  "summary" text NOT NULL,
  "structured_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "snapshot_cursor" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "source_status" text DEFAULT 'complete' NOT NULL,
  "source_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "safe_error" text,
  "captured_at" timestamp with time zone DEFAULT now() NOT NULL,
  "model" text DEFAULT '' NOT NULL,
  "prompt_version" text DEFAULT 'lead-conversation-snapshot-v1' NOT NULL,
  "input_snapshot_version" text DEFAULT 'lead-conversation-snapshot-input-v1' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "lead_conversation_snapshots_lead_created_idx"
  ON "lead_conversation_snapshots" ("lead_id", "created_at");

CREATE INDEX IF NOT EXISTS "lead_conversation_snapshots_triggered_by_idx"
  ON "lead_conversation_snapshots" ("triggered_by_user_id");

CREATE TABLE IF NOT EXISTS "lead_ai_suggestions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lead_id" uuid NOT NULL REFERENCES "leads"("id") ON DELETE cascade,
  "conversation_snapshot_id" uuid NOT NULL REFERENCES "lead_conversation_snapshots"("id") ON DELETE cascade,
  "triggered_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "recommended_move" text NOT NULL,
  "suggested_timing" text DEFAULT '' NOT NULL,
  "confidence" text DEFAULT 'Medium' NOT NULL,
  "confidence_reason" text DEFAULT '' NOT NULL,
  "reasoning" text DEFAULT '' NOT NULL,
  "email_draft_subject" text DEFAULT '' NOT NULL,
  "email_draft_body" text DEFAULT '' NOT NULL,
  "phone_talking_points" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "handoff_notes" text DEFAULT '' NOT NULL,
  "partial_context_note" text,
  "model" text DEFAULT '' NOT NULL,
  "prompt_version" text DEFAULT 'lead-ai-guidance-v1' NOT NULL,
  "input_snapshot_version" text DEFAULT 'lead-ai-guidance-input-v1' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "lead_ai_suggestions_lead_created_idx"
  ON "lead_ai_suggestions" ("lead_id", "created_at");

CREATE INDEX IF NOT EXISTS "lead_ai_suggestions_snapshot_idx"
  ON "lead_ai_suggestions" ("conversation_snapshot_id");

CREATE INDEX IF NOT EXISTS "lead_ai_suggestions_triggered_by_idx"
  ON "lead_ai_suggestions" ("triggered_by_user_id");

CREATE TABLE IF NOT EXISTS "lead_ai_generation_failures" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lead_id" uuid NOT NULL REFERENCES "leads"("id") ON DELETE cascade,
  "conversation_snapshot_id" uuid REFERENCES "lead_conversation_snapshots"("id") ON DELETE set null,
  "triggered_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "failure_stage" text NOT NULL,
  "error_type" text DEFAULT 'generation_error' NOT NULL,
  "error_message" text NOT NULL,
  "attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "retry_after" timestamp with time zone,
  "model" text DEFAULT '' NOT NULL,
  "prompt_version" text DEFAULT '' NOT NULL,
  "input_snapshot_version" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "lead_ai_generation_failures_lead_created_idx"
  ON "lead_ai_generation_failures" ("lead_id", "created_at");

CREATE INDEX IF NOT EXISTS "lead_ai_generation_failures_retry_after_idx"
  ON "lead_ai_generation_failures" ("retry_after");

CREATE INDEX IF NOT EXISTS "lead_ai_generation_failures_triggered_by_idx"
  ON "lead_ai_generation_failures" ("triggered_by_user_id");
