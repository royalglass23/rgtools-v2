DO $$
BEGIN
  CREATE TYPE "public"."work_order_item_label_status" AS ENUM(
    'pending',
    'generated',
    'manual',
    'failed',
    'source_changed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "work_order_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "work_order_id" uuid NOT NULL REFERENCES "work_orders"("id") ON DELETE cascade,
  "servicem8_item_uuid" text NOT NULL,
  "servicem8_job_uuid" text NOT NULL,
  "item_code" text,
  "quantity" numeric(12, 3) NOT NULL,
  "original_description" text NOT NULL,
  "line_total_excluding_gst" numeric(12, 2),
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "generated_label" text,
  "manual_label_override" text,
  "label_status" "work_order_item_label_status" DEFAULT 'pending' NOT NULL,
  "source_description_fingerprint" text,
  "installer_id" uuid REFERENCES "work_order_installers"("id") ON DELETE set null,
  "stage_option_id" uuid REFERENCES "work_order_stage_options"("id") ON DELETE set null,
  "hardware_status_option_id" uuid REFERENCES "work_order_hardware_status_options"("id") ON DELETE set null,
  "maintenance_program" boolean DEFAULT false NOT NULL,
  "install_date" date,
  "date_completed" date,
  "ai_risk_level" "work_order_level",
  "risk_level_override" "work_order_level",
  "ai_importance" "work_order_level",
  "importance_override" "work_order_level",
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "work_order_items_servicem8_item_uuid_uq"
  ON "work_order_items" ("servicem8_item_uuid");

CREATE INDEX IF NOT EXISTS "work_order_items_work_order_active_idx"
  ON "work_order_items" ("work_order_id", "is_active");

CREATE INDEX IF NOT EXISTS "work_order_items_servicem8_job_uuid_idx"
  ON "work_order_items" ("servicem8_job_uuid");
