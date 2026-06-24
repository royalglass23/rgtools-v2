ALTER TABLE "audit_log" ADD COLUMN "entity_type" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "ip_address" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "audit_log_entity_type_idx" ON "audit_log" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "audit_log_archived_at_idx" ON "audit_log" USING btree ("archived_at");
