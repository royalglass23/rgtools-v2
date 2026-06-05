CREATE TYPE "public"."lead_client_type" AS ENUM('homeowner', 'builder', 'developer', 'investor', 'repeat_exclusive');--> statement-breakpoint
CREATE TYPE "public"."lead_outcome" AS ENUM('won', 'lost_outside_rubric', 'lost_score_wrong', 'lost_served_late', 'lost_silence', 'disqualified');--> statement-breakpoint
CREATE TYPE "public"."lead_source" AS ENUM('phone', 'email', 'wechat', 'calculator', 'contact_form', 'other');--> statement-breakpoint
CREATE TYPE "public"."lead_sync_status" AS ENUM('pending_sync', 'synced', 'sync_failed');--> statement-breakpoint
CREATE TYPE "public"."lead_tier" AS ENUM('A', 'B', 'C', 'D');--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"company_name" text,
	"email" text,
	"phone" text,
	"phone_normalized" text,
	"client_type" "lead_client_type",
	"is_repeat_client" boolean DEFAULT false NOT NULL,
	"lifetime_jobs" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_category_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"category" integer NOT NULL,
	"answer_key" text,
	"points" integer NOT NULL,
	"config_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"outcome" "lead_outcome" NOT NULL,
	"reason_detail" text,
	"final_value" numeric(10, 2),
	"closed_by" uuid,
	"closed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_outcomes_lead_id_unique" UNIQUE("lead_id")
);
--> statement-breakpoint
CREATE TABLE "lead_status_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"changed_by" uuid NOT NULL,
	"previous_tier" "lead_tier",
	"new_tier" "lead_tier",
	"reason" text NOT NULL,
	"was_system_suggested" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"source" "lead_source" NOT NULL,
	"sync_status" "lead_sync_status" DEFAULT 'pending_sync' NOT NULL,
	"servicem8_job_uuid" text,
	"sync_error" text,
	"project_type" text,
	"location" text,
	"suburb" text,
	"budget_band" text,
	"timeline" text,
	"consent_status" text,
	"decision_makers" text,
	"price_sensitivity_read" text,
	"has_other_quotes" boolean,
	"free_text" text,
	"config_version_id" uuid,
	"seed_score" integer,
	"tier" "lead_tier",
	"score_reason" text,
	"scored_at" timestamp with time zone,
	"completeness" integer,
	"archived_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scoring_config_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_label" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"config" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "lead_category_scores" ADD CONSTRAINT "lead_category_scores_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_category_scores" ADD CONSTRAINT "lead_category_scores_config_version_id_scoring_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."scoring_config_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_outcomes" ADD CONSTRAINT "lead_outcomes_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_outcomes" ADD CONSTRAINT "lead_outcomes_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_status_changes" ADD CONSTRAINT "lead_status_changes_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_status_changes" ADD CONSTRAINT "lead_status_changes_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_config_version_id_scoring_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."scoring_config_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_config_versions" ADD CONSTRAINT "scoring_config_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clients_phone_norm_idx" ON "clients" USING btree ("phone_normalized");--> statement-breakpoint
CREATE INDEX "clients_email_idx" ON "clients" USING btree ("email");--> statement-breakpoint
CREATE INDEX "lead_cat_scores_lead_idx" ON "lead_category_scores" USING btree ("lead_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_cat_uq" ON "lead_category_scores" USING btree ("lead_id","category");--> statement-breakpoint
CREATE INDEX "lead_status_changes_lead_idx" ON "lead_status_changes" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "leads_client_idx" ON "leads" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "leads_tier_idx" ON "leads" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "leads_sync_status_idx" ON "leads" USING btree ("sync_status");--> statement-breakpoint
CREATE INDEX "leads_servicem8_idx" ON "leads" USING btree ("servicem8_job_uuid");--> statement-breakpoint
CREATE UNIQUE INDEX "scoring_config_label_uq" ON "scoring_config_versions" USING btree ("version_label");--> statement-breakpoint
CREATE UNIQUE INDEX scoring_config_one_active
  ON scoring_config_versions (is_active)
  WHERE is_active = true;
