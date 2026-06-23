ALTER TYPE "public"."client_type" ADD VALUE IF NOT EXISTS 'developer';--> statement-breakpoint
ALTER TYPE "public"."client_type" ADD VALUE IF NOT EXISTS 'investor';--> statement-breakpoint
ALTER TYPE "public"."client_type" ADD VALUE IF NOT EXISTS 'repeat_exclusive';--> statement-breakpoint
UPDATE "quotes" SET "client_type" = 'homeowner' WHERE "client_type" = 'architect';--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "servicem8_company_uuid" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "client_id" uuid;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quotes_client_id_idx" ON "quotes" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "quotes_servicem8_company_uuid_idx" ON "quotes" USING btree ("servicem8_company_uuid");
