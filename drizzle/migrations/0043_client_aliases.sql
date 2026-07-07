DO $$ BEGIN CREATE TYPE "client_alias_source" AS ENUM ('servicem8_import', 'manual', 'merge'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "client_aliases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL,
  "alias" text NOT NULL,
  "source" "client_alias_source" DEFAULT 'manual' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "client_aliases" ADD CONSTRAINT "client_aliases_client_id_clients_id_fk"
    FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "client_aliases_client_idx" ON "client_aliases" USING btree ("client_id");
CREATE INDEX IF NOT EXISTS "client_aliases_alias_idx" ON "client_aliases" USING btree ("alias");
CREATE UNIQUE INDEX IF NOT EXISTS "client_aliases_client_alias_uq" ON "client_aliases" USING btree ("client_id", "alias");
