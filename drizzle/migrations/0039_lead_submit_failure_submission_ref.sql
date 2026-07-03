ALTER TABLE "lead_submit_failures"
  ADD COLUMN IF NOT EXISTS "submission_ref" text;

CREATE INDEX IF NOT EXISTS "lead_submit_failures_submission_ref_idx"
  ON "lead_submit_failures" ("submission_ref");
