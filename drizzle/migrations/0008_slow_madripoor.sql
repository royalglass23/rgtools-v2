CREATE TABLE "lead_email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid,
	"recipient" text NOT NULL,
	"status" text NOT NULL,
	"provider_message_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_submit_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_submit_failures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"correlation_id" text NOT NULL,
	"ip" text NOT NULL,
	"stage" text NOT NULL,
	"error" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead_email_log" ADD CONSTRAINT "lead_email_log_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_email_log_lead_idx" ON "lead_email_log" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_email_log_created_at_idx" ON "lead_email_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "lead_submit_attempts_ip_created_at_idx" ON "lead_submit_attempts" USING btree ("ip","created_at");--> statement-breakpoint
CREATE INDEX "lead_submit_failures_created_at_idx" ON "lead_submit_failures" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "lead_submit_failures_correlation_idx" ON "lead_submit_failures" USING btree ("correlation_id");