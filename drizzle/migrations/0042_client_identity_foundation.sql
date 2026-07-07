DO $$ BEGIN CREATE TYPE "client_identity_type" AS ENUM ('company', 'individual_homeowner', 'household', 'contractor', 'sole_trader', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "client_review_status" AS ENUM ('pending_review', 'reviewed', 'dismissed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "client_canonical_source" AS ENUM ('import', 'manual', 'system'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "identity_type" "client_identity_type";
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "canonical_source" "client_canonical_source" DEFAULT 'import' NOT NULL;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "canonical_updated_by" uuid;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "canonical_updated_at" timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "servicem8_name" text;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "servicem8_company_name" text;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "servicem8_email" text;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "servicem8_phone" text;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "servicem8_phone_normalized" text;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "servicem8_source_snapshot" jsonb;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "servicem8_last_synced_at" timestamp with time zone;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "review_status" "client_review_status" DEFAULT 'pending_review' NOT NULL;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "reviewed_by" uuid;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp with time zone;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "review_note" text;

UPDATE "clients"
SET
  "servicem8_name" = COALESCE("servicem8_name", "name"),
  "servicem8_company_name" = COALESCE("servicem8_company_name", "company_name"),
  "servicem8_email" = COALESCE("servicem8_email", "email"),
  "servicem8_phone" = COALESCE("servicem8_phone", "phone"),
  "servicem8_phone_normalized" = COALESCE("servicem8_phone_normalized", "phone_normalized"),
  "servicem8_last_synced_at" = COALESCE("servicem8_last_synced_at", "updated_at")
WHERE "servicem8_company_uuid" IS NOT NULL;

DO $$ BEGIN
  ALTER TABLE "clients" ADD CONSTRAINT "clients_canonical_updated_by_users_id_fk"
    FOREIGN KEY ("canonical_updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "clients" ADD CONSTRAINT "clients_reviewed_by_users_id_fk"
    FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "clients_identity_type_idx" ON "clients" USING btree ("identity_type");
CREATE INDEX IF NOT EXISTS "clients_review_status_idx" ON "clients" USING btree ("review_status");
