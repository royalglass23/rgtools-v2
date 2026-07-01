ALTER TABLE "work_orders"
  ADD COLUMN IF NOT EXISTS "ai_suggestion_at" timestamp with time zone;
