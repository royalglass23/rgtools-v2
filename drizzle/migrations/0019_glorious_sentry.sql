ALTER TABLE "leads" ADD COLUMN "servicem8_job_number" text;--> statement-breakpoint
CREATE INDEX "leads_servicem8_job_number_idx" ON "leads" USING btree ("servicem8_job_number");