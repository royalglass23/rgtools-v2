DO $$ BEGIN CREATE TYPE "lead_channel" AS ENUM ('phone', 'email', 'wechat', 'calculator', 'contact_form', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "lead_matrix_client_type" AS ENUM ('builder_developer_pool_builder_landscaper', 'homeowner'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "lead_budget_band" AS ENUM ('50k_plus', '20k_50k', '5k_20k', 'lt_5k'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "lead_consent_status" AS ENUM ('approved_not_required', 'submitted_pending', 'not_available'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "lead_building_stage" AS ENUM ('ready_for_glazing', 'interior_finish', 'gib_plastering_framing_complete', 'foundation_early_construction', 'planning'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "lead_project_type" AS ENUM ('new_build_commercial_fit_out', 'high_end_residential_multi_unit_residential', 'renovation_replacement'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "lead_price_sensitivity" AS ENUM ('not_price_sensitive', 'value_focused', 'normal', 'price_sensitive', 'cheapest_only'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "lead_decision_makers" AS ENUM ('decision_maker_confirmed_owner_director', 'project_manager_site_manager', 'multiple_decision_makers_unknown'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "lead_warmth_source" AS ENUM ('existing_client_referral_repeat_builder_architect', 'website_google_walk_in_cold_lead'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "lead_distance_band" AS ENUM ('lt_15km', '15_50km', 'gt_50km'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "lead_payment_history" AS ENUM ('always_on_time_good', 'new_client', 'slow_payment_poor_history'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "lead_site_access" AS ENUM ('easy', 'normal', 'tight', 'very_difficult'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "lead_installation_height" AS ENUM ('ground_floor_ladder', 'scaffold_ewp_crane'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE "lead_tier" ADD VALUE IF NOT EXISTS 'E';

ALTER TABLE "lead_submit_failures" ADD COLUMN IF NOT EXISTS "submission_ref" text;
CREATE INDEX IF NOT EXISTS "lead_submit_failures_submission_ref_idx"
  ON "lead_submit_failures" ("submission_ref");

ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "channel" "lead_channel";
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'source'
      AND udt_name <> 'lead_warmth_source'
  ) THEN
    UPDATE "leads"
    SET "channel" = CASE
      WHEN "source"::text IN ('phone', 'email', 'wechat', 'calculator', 'contact_form', 'other')
        THEN "source"::text::"lead_channel"
      ELSE 'phone'::"lead_channel"
    END
    WHERE "channel" IS NULL;
  END IF;
  UPDATE "leads" SET "channel" = 'phone' WHERE "channel" IS NULL;
END $$;
ALTER TABLE "leads" ALTER COLUMN "channel" SET NOT NULL;

ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_config_version_id_scoring_config_versions_id_fk";

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'source'
      AND udt_name <> 'lead_warmth_source'
  ) THEN
    ALTER TABLE "leads" DROP COLUMN "source";
  END IF;
END $$;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "client_type_answer" "lead_matrix_client_type";
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "resource_consent" "lead_consent_status";
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "building_consent" "lead_consent_status";
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "price_sensitivity" "lead_price_sensitivity";
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "source" "lead_warmth_source";
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "distance_band" "lead_distance_band";
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "raw_driving_distance_km" numeric(8, 2);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "payment_history" "lead_payment_history";
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "site_access" "lead_site_access";
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "installation_height" "lead_installation_height";
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "job_description" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "product" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "legacy_budget_band" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "legacy_building_stage" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "legacy_project_type" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "legacy_decision_makers" text;

UPDATE "leads"
SET
  "legacy_budget_band" = COALESCE("legacy_budget_band", "budget_band"::text),
  "legacy_building_stage" = COALESCE("legacy_building_stage", "building_stage"::text),
  "legacy_project_type" = COALESCE("legacy_project_type", "project_type"::text),
  "legacy_decision_makers" = COALESCE("legacy_decision_makers", "decision_makers"::text),
  "product" = COALESCE("product", "project_type"::text);

ALTER TABLE "leads" ALTER COLUMN "budget_band" TYPE "lead_budget_band"
  USING CASE
    WHEN "budget_band"::text IN ('50k_plus', '20k_50k', '5k_20k', 'lt_5k')
      THEN "budget_band"::text::"lead_budget_band"
    ELSE NULL
  END;
ALTER TABLE "leads" ALTER COLUMN "building_stage" TYPE "lead_building_stage"
  USING CASE
    WHEN "building_stage"::text IN ('ready_for_glazing', 'interior_finish', 'gib_plastering_framing_complete', 'foundation_early_construction', 'planning')
      THEN "building_stage"::text::"lead_building_stage"
    ELSE NULL
  END;
ALTER TABLE "leads" ALTER COLUMN "project_type" TYPE "lead_project_type"
  USING CASE
    WHEN "project_type"::text IN ('new_build_commercial_fit_out', 'high_end_residential_multi_unit_residential', 'renovation_replacement')
      THEN "project_type"::text::"lead_project_type"
    ELSE NULL
  END;
ALTER TABLE "leads" ALTER COLUMN "decision_makers" TYPE "lead_decision_makers"
  USING CASE
    WHEN "decision_makers"::text IN ('decision_maker_confirmed_owner_director', 'project_manager_site_manager', 'multiple_decision_makers_unknown')
      THEN "decision_makers"::text::"lead_decision_makers"
    ELSE NULL
  END;

DO $$ BEGIN
  ALTER TABLE "leads" ADD CONSTRAINT "leads_config_version_id_scoring_config_versions_id_fk"
    FOREIGN KEY ("config_version_id") REFERENCES "public"."scoring_config_versions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "lead_reviewer_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lead_id" uuid NOT NULL,
  "author_id" uuid NOT NULL,
  "text" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "lead_reviewer_notes" ADD CONSTRAINT "lead_reviewer_notes_lead_id_leads_id_fk"
    FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "lead_reviewer_notes" ADD CONSTRAINT "lead_reviewer_notes_author_id_users_id_fk"
    FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "lead_reviewer_notes_lead_idx" ON "lead_reviewer_notes" USING btree ("lead_id");
CREATE INDEX IF NOT EXISTS "lead_reviewer_notes_author_idx" ON "lead_reviewer_notes" USING btree ("author_id");
