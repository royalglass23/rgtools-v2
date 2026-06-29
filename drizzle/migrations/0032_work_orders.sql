CREATE TYPE "public"."work_order_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TABLE "work_order_installers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"servicem8_staff_uuid" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "work_order_stage_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "work_order_hardware_status_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "work_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"servicem8_job_uuid" text NOT NULL,
	"servicem8_company_uuid" text,
	"servicem8_status" text NOT NULL,
	"servicem8_active" boolean DEFAULT true NOT NULL,
	"job_number" text,
	"job_address" text,
	"job_description" text,
	"client_id" uuid,
	"lead_id" uuid,
	"quote_id" uuid,
	"client_name" text NOT NULL,
	"company_name" text,
	"lead_score" integer,
	"installer_id" uuid,
	"stage_option_id" uuid,
	"hardware_status_option_id" uuid,
	"install_date" date,
	"date_completed" date,
	"ai_risk_level" "work_order_level",
	"risk_level_override" "work_order_level",
	"ai_importance" "work_order_level",
	"importance_override" "work_order_level",
	"ai_suggestion" text,
	"client_context_summary" text,
	"client_context_summary_at" timestamp with time zone,
	"client_approach_note" text,
	"last_servicem8_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_id" uuid NOT NULL,
	"actor_id" uuid,
	"field_name" text NOT NULL,
	"previous_value" jsonb,
	"new_value" jsonb,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "work_order_installers" ADD CONSTRAINT "work_order_installers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_stage_options" ADD CONSTRAINT "work_order_stage_options_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_hardware_status_options" ADD CONSTRAINT "work_order_hardware_status_options_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_installer_id_work_order_installers_id_fk" FOREIGN KEY ("installer_id") REFERENCES "public"."work_order_installers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_stage_option_id_work_order_stage_options_id_fk" FOREIGN KEY ("stage_option_id") REFERENCES "public"."work_order_stage_options"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_hardware_status_option_id_work_order_hardware_status_options_id_fk" FOREIGN KEY ("hardware_status_option_id") REFERENCES "public"."work_order_hardware_status_options"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_events" ADD CONSTRAINT "work_order_events_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_events" ADD CONSTRAINT "work_order_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "work_order_installers_normalized_name_uq" ON "work_order_installers" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "work_order_installers_active_idx" ON "work_order_installers" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "work_order_stage_options_normalized_name_uq" ON "work_order_stage_options" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "work_order_stage_options_active_idx" ON "work_order_stage_options" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "work_order_hardware_status_options_normalized_name_uq" ON "work_order_hardware_status_options" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "work_order_hardware_status_options_active_idx" ON "work_order_hardware_status_options" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "work_orders_servicem8_job_uuid_uq" ON "work_orders" USING btree ("servicem8_job_uuid");--> statement-breakpoint
CREATE INDEX "work_orders_status_idx" ON "work_orders" USING btree ("servicem8_status","servicem8_active");--> statement-breakpoint
CREATE INDEX "work_orders_job_number_idx" ON "work_orders" USING btree ("job_number");--> statement-breakpoint
CREATE INDEX "work_orders_client_idx" ON "work_orders" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "work_orders_lead_idx" ON "work_orders" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "work_orders_quote_idx" ON "work_orders" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "work_order_events_work_order_idx" ON "work_order_events" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "work_order_events_actor_idx" ON "work_order_events" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "work_order_events_created_at_idx" ON "work_order_events" USING btree ("created_at");--> statement-breakpoint
INSERT INTO "modules" ("slug", "name", "description", "admin_only", "is_active", "sort_order")
VALUES
  ('work-orders', 'Work Orders', 'Installation work order tracking from ServiceM8.', false, true, 5),
  ('admin/work-orders', 'Work Order Configuration', 'Admin controls for Work Order installers, stages, and hardware statuses.', true, true, 106)
ON CONFLICT ("slug") DO UPDATE
SET "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "admin_only" = EXCLUDED."admin_only",
    "is_active" = EXCLUDED."is_active",
    "sort_order" = EXCLUDED."sort_order";
