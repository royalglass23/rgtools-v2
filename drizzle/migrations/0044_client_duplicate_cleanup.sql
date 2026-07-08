ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "is_merged" boolean DEFAULT false NOT NULL;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "merged_into_client_id" uuid;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "merged_at" timestamp with time zone;

DO $$ BEGIN
  ALTER TABLE "clients" ADD CONSTRAINT "clients_merged_into_client_id_clients_id_fk"
    FOREIGN KEY ("merged_into_client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "clients_is_merged_idx" ON "clients" USING btree ("is_merged");
CREATE INDEX IF NOT EXISTS "clients_merged_into_idx" ON "clients" USING btree ("merged_into_client_id");

CREATE TABLE IF NOT EXISTS "client_merged_references" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "survivor_client_id" uuid NOT NULL,
  "merged_client_id" uuid NOT NULL,
  "servicem8_company_uuid" text,
  "name" text NOT NULL,
  "company_name" text,
  "email" text,
  "phone_normalized" text,
  "merged_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "client_merged_references" ADD CONSTRAINT "client_merged_refs_survivor_client_id_clients_id_fk"
    FOREIGN KEY ("survivor_client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "client_merged_references" ADD CONSTRAINT "client_merged_refs_merged_client_id_clients_id_fk"
    FOREIGN KEY ("merged_client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "client_merged_refs_survivor_idx" ON "client_merged_references" USING btree ("survivor_client_id");
CREATE UNIQUE INDEX IF NOT EXISTS "client_merged_refs_merged_client_uq" ON "client_merged_references" USING btree ("merged_client_id");
CREATE INDEX IF NOT EXISTS "client_merged_refs_servicem8_idx" ON "client_merged_references" USING btree ("servicem8_company_uuid");
CREATE INDEX IF NOT EXISTS "client_merged_refs_email_idx" ON "client_merged_references" USING btree ("email");
CREATE INDEX IF NOT EXISTS "client_merged_refs_phone_idx" ON "client_merged_references" USING btree ("phone_normalized");

CREATE TABLE IF NOT EXISTS "client_duplicate_dismissals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "suggestion_key" text NOT NULL,
  "reason" text,
  "dismissed_by" uuid NOT NULL,
  "dismissed_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "client_duplicate_dismissals" ADD CONSTRAINT "client_duplicate_dismissals_dismissed_by_users_id_fk"
    FOREIGN KEY ("dismissed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "client_duplicate_dismissals_key_uq" ON "client_duplicate_dismissals" USING btree ("suggestion_key");
CREATE INDEX IF NOT EXISTS "client_duplicate_dismissals_by_idx" ON "client_duplicate_dismissals" USING btree ("dismissed_by");
