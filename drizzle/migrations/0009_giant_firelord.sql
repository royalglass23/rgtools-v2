CREATE TABLE "pricing_config_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_label" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"config" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "pricing_config_versions" ADD CONSTRAINT "pricing_config_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pricing_config_label_uq" ON "pricing_config_versions" USING btree ("version_label");--> statement-breakpoint
CREATE UNIQUE INDEX pricing_config_one_active
  ON pricing_config_versions (is_active)
  WHERE is_active = true;
