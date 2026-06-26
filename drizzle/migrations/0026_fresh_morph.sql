CREATE TYPE "public"."ps_config_audit_action" AS ENUM('draft_saved', 'test_generated', 'published', 'archived', 'migrated');--> statement-breakpoint
CREATE TYPE "public"."ps_config_entity_type" AS ENUM('system', 'option_category', 'option_value', 'system_option_rule', 'template_variant', 'field_mapping', 'description_template', 'config_version');--> statement-breakpoint
CREATE TYPE "public"."ps_config_state" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."ps_document_kind" AS ENUM('ps1', 'ps3');--> statement-breakpoint
CREATE TYPE "public"."ps_field_source_type" AS ENUM('project_value', 'selected_option', 'system_rule', 'description_template', 'date', 'fixed_value');--> statement-breakpoint
CREATE TYPE "public"."ps_field_type" AS ENUM('text', 'checkbox');--> statement-breakpoint
CREATE TYPE "public"."ps_generation_mode" AS ENUM('ps1_only', 'ps3_only', 'both');--> statement-breakpoint
CREATE TYPE "public"."ps_template_variant_kind" AS ENUM('standard_ps1', 'pool_ps1', 'gate_ps1', 'ps3', 'other');--> statement-breakpoint
CREATE TABLE "ps_config_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_label" text NOT NULL,
	"state" "ps_config_state" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ps_configuration_audit_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"entity_type" "ps_config_entity_type" NOT NULL,
	"entity_id" uuid,
	"action" "ps_config_audit_action" NOT NULL,
	"config_version_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ps_description_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_version_id" uuid,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"pattern" text NOT NULL,
	"state" "ps_config_state" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ps_field_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_variant_id" uuid NOT NULL,
	"field_name" text NOT NULL,
	"field_type" "ps_field_type" NOT NULL,
	"source_type" "ps_field_source_type" NOT NULL,
	"source_key" text,
	"fixed_value" text,
	"checkbox_value" boolean,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ps_generated_pdf_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"generation_event_id" uuid NOT NULL,
	"document_kind" "ps_document_kind" NOT NULL,
	"r2_object_key" text NOT NULL,
	"filename" text NOT NULL,
	"retained_until" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ps_generation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_label" text NOT NULL,
	"config_version_id" uuid,
	"generation_mode" "ps_generation_mode" NOT NULL,
	"job_number" text,
	"client_name" text NOT NULL,
	"job_address" text NOT NULL,
	"bc_number" text,
	"lot_description" text,
	"selections_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"description_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ps_migration_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_system" text NOT NULL,
	"source_record_id" text NOT NULL,
	"generation_event_id" uuid,
	"actor_label" text DEFAULT 'migrated' NOT NULL,
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"migrated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ps_option_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ps_option_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ps_option_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ps_system_option_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"system_id" uuid NOT NULL,
	"option_value_id" uuid NOT NULL,
	"is_allowed" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ps_systems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_version_id" uuid,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"state" "ps_config_state" DEFAULT 'draft' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"height_rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ps_template_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"system_id" uuid,
	"config_version_id" uuid,
	"document_kind" "ps_document_kind" NOT NULL,
	"variant_kind" "ps_template_variant_kind" NOT NULL,
	"label" text NOT NULL,
	"r2_object_key" text NOT NULL,
	"original_filename" text,
	"field_discovery" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"state" "ps_config_state" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ps_config_versions" ADD CONSTRAINT "ps_config_versions_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ps_config_versions" ADD CONSTRAINT "ps_config_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ps_configuration_audit_entries" ADD CONSTRAINT "ps_configuration_audit_entries_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ps_configuration_audit_entries" ADD CONSTRAINT "ps_configuration_audit_entries_config_version_id_ps_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."ps_config_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ps_description_templates" ADD CONSTRAINT "ps_description_templates_config_version_id_ps_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."ps_config_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ps_field_mappings" ADD CONSTRAINT "ps_field_mappings_template_variant_id_ps_template_variants_id_fk" FOREIGN KEY ("template_variant_id") REFERENCES "public"."ps_template_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ps_generated_pdf_objects" ADD CONSTRAINT "ps_generated_pdf_objects_generation_event_id_ps_generation_events_id_fk" FOREIGN KEY ("generation_event_id") REFERENCES "public"."ps_generation_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ps_generation_events" ADD CONSTRAINT "ps_generation_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ps_generation_events" ADD CONSTRAINT "ps_generation_events_config_version_id_ps_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."ps_config_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ps_migration_records" ADD CONSTRAINT "ps_migration_records_generation_event_id_ps_generation_events_id_fk" FOREIGN KEY ("generation_event_id") REFERENCES "public"."ps_generation_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ps_option_values" ADD CONSTRAINT "ps_option_values_category_id_ps_option_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."ps_option_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ps_system_option_rules" ADD CONSTRAINT "ps_system_option_rules_system_id_ps_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."ps_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ps_system_option_rules" ADD CONSTRAINT "ps_system_option_rules_option_value_id_ps_option_values_id_fk" FOREIGN KEY ("option_value_id") REFERENCES "public"."ps_option_values"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ps_systems" ADD CONSTRAINT "ps_systems_config_version_id_ps_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."ps_config_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ps_template_variants" ADD CONSTRAINT "ps_template_variants_system_id_ps_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."ps_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ps_template_variants" ADD CONSTRAINT "ps_template_variants_config_version_id_ps_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."ps_config_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ps_config_versions_label_uq" ON "ps_config_versions" USING btree ("version_label");--> statement-breakpoint
CREATE INDEX "ps_config_versions_state_idx" ON "ps_config_versions" USING btree ("state");--> statement-breakpoint
CREATE INDEX "ps_config_audit_created_at_idx" ON "ps_configuration_audit_entries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ps_config_audit_entity_idx" ON "ps_configuration_audit_entries" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "ps_config_audit_actor_idx" ON "ps_configuration_audit_entries" USING btree ("actor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ps_description_templates_slug_version_uq" ON "ps_description_templates" USING btree ("slug","config_version_id");--> statement-breakpoint
CREATE INDEX "ps_description_templates_state_idx" ON "ps_description_templates" USING btree ("state");--> statement-breakpoint
CREATE UNIQUE INDEX "ps_field_mappings_variant_field_uq" ON "ps_field_mappings" USING btree ("template_variant_id","field_name");--> statement-breakpoint
CREATE INDEX "ps_field_mappings_variant_idx" ON "ps_field_mappings" USING btree ("template_variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ps_generated_pdf_objects_key_uq" ON "ps_generated_pdf_objects" USING btree ("r2_object_key");--> statement-breakpoint
CREATE INDEX "ps_generated_pdf_objects_event_idx" ON "ps_generated_pdf_objects" USING btree ("generation_event_id");--> statement-breakpoint
CREATE INDEX "ps_generated_pdf_objects_retention_idx" ON "ps_generated_pdf_objects" USING btree ("retained_until","deleted_at");--> statement-breakpoint
CREATE INDEX "ps_generation_events_created_at_idx" ON "ps_generation_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ps_generation_events_job_number_idx" ON "ps_generation_events" USING btree ("job_number");--> statement-breakpoint
CREATE INDEX "ps_generation_events_actor_idx" ON "ps_generation_events" USING btree ("actor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ps_migration_records_source_uq" ON "ps_migration_records" USING btree ("source_system","source_record_id");--> statement-breakpoint
CREATE INDEX "ps_migration_records_generation_event_idx" ON "ps_migration_records" USING btree ("generation_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ps_option_values_category_slug_uq" ON "ps_option_values" USING btree ("category_id","slug");--> statement-breakpoint
CREATE INDEX "ps_option_values_category_idx" ON "ps_option_values" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ps_system_option_rules_system_value_uq" ON "ps_system_option_rules" USING btree ("system_id","option_value_id");--> statement-breakpoint
CREATE INDEX "ps_system_option_rules_system_idx" ON "ps_system_option_rules" USING btree ("system_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ps_systems_slug_version_uq" ON "ps_systems" USING btree ("slug","config_version_id");--> statement-breakpoint
CREATE INDEX "ps_systems_state_idx" ON "ps_systems" USING btree ("state");--> statement-breakpoint
CREATE INDEX "ps_template_variants_system_idx" ON "ps_template_variants" USING btree ("system_id");--> statement-breakpoint
CREATE INDEX "ps_template_variants_state_idx" ON "ps_template_variants" USING btree ("state");