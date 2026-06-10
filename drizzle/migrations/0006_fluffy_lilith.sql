ALTER TABLE "leads" ADD COLUMN "external_ref" text;--> statement-breakpoint
CREATE UNIQUE INDEX "leads_external_ref_uq" ON "leads" USING btree ("external_ref");