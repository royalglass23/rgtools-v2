ALTER TABLE "ps_option_values" ADD COLUMN "config_version_id" uuid;
--> statement-breakpoint
UPDATE "ps_option_values"
SET "config_version_id" = (
  SELECT "id"
  FROM "ps_config_versions"
  WHERE "state" = 'published' AND "archived_at" IS NULL
  ORDER BY "published_at" DESC NULLS LAST, "created_at" DESC
  LIMIT 1
)
WHERE "config_version_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "ps_option_values" ADD CONSTRAINT "ps_option_values_config_version_id_ps_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."ps_config_versions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
DROP INDEX IF EXISTS "ps_option_values_category_slug_uq";
--> statement-breakpoint
CREATE UNIQUE INDEX "ps_option_values_category_slug_version_uq" ON "ps_option_values" USING btree ("category_id","slug","config_version_id");
--> statement-breakpoint
CREATE INDEX "ps_option_values_config_version_idx" ON "ps_option_values" USING btree ("config_version_id");
