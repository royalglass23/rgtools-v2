ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "identity_kind" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "identity_value" text;--> statement-breakpoint
UPDATE "work_orders"
SET "identity_kind" = 'servicem8_uuid',
    "identity_value" = "servicem8_job_uuid"
WHERE "identity_kind" IS NULL
  AND "servicem8_job_uuid" IS NOT NULL;--> statement-breakpoint
UPDATE "work_orders"
SET "identity_kind" = 'job_number',
    "identity_value" = "job_number"
WHERE "identity_kind" IS NULL
  AND "job_number" IS NOT NULL;--> statement-breakpoint
UPDATE "work_orders"
SET "identity_kind" = 'legacy_id',
    "identity_value" = "id"::text
WHERE "identity_kind" IS NULL
  OR "identity_value" IS NULL;--> statement-breakpoint
ALTER TABLE "work_orders" ALTER COLUMN "identity_kind" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "work_orders" ALTER COLUMN "identity_value" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "work_orders" ALTER COLUMN "servicem8_job_uuid" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "is_current" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "approximate_description" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "system_name" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "length" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "color" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "items_services" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "glass_status" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "design_status" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "site_condition" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "remarks" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "raw_servicem8_snapshot" jsonb;--> statement-breakpoint
DROP INDEX IF EXISTS "work_orders_servicem8_job_uuid_uq";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "work_orders_identity_uq" ON "work_orders" USING btree ("identity_kind","identity_value");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_orders_servicem8_job_uuid_idx" ON "work_orders" USING btree ("servicem8_job_uuid");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "work_order_refresh_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "status" text NOT NULL,
  "synced_count" integer DEFAULT 0 NOT NULL,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_order_refresh_runs_created_at_idx" ON "work_order_refresh_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_order_refresh_runs_status_idx" ON "work_order_refresh_runs" USING btree ("status");
