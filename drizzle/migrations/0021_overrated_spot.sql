CREATE TABLE "client_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"name" text,
	"phone" text,
	"phone_normalized" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "servicem8_company_uuid" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "contact_id" uuid;--> statement-breakpoint
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_contacts_client_idx" ON "client_contacts" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "client_contacts_phone_norm_idx" ON "client_contacts" USING btree ("phone_normalized");--> statement-breakpoint
CREATE INDEX "client_contacts_email_idx" ON "client_contacts" USING btree ("email");--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_contact_id_client_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."client_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clients_servicem8_company_uuid_idx" ON "clients" USING btree ("servicem8_company_uuid");--> statement-breakpoint
-- Canonical identity guard for LINKED clients. Partial so provisional clients
-- (servicem8_company_uuid IS NULL) are exempt. Hand-written: Drizzle cannot
-- express the partial WHERE clause. See MT-46.
CREATE UNIQUE INDEX "clients_servicem8_company_uuid_uq" ON "clients" USING btree ("servicem8_company_uuid") WHERE "servicem8_company_uuid" IS NOT NULL;