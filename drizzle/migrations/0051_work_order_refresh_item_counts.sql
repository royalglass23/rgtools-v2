ALTER TABLE "work_order_refresh_runs"
  ADD COLUMN IF NOT EXISTS "item_synced_count" integer DEFAULT 0 NOT NULL;

ALTER TABLE "work_order_refresh_runs"
  ADD COLUMN IF NOT EXISTS "excluded_line_count" integer DEFAULT 0 NOT NULL;
