CREATE TABLE "quote_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quote_events" ADD COLUMN "recipient_id" uuid;--> statement-breakpoint
ALTER TABLE "quote_viewer_emails" ADD COLUMN "recipient_id" uuid;--> statement-breakpoint
ALTER TABLE "quote_recipients" ADD CONSTRAINT "quote_recipients_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quote_recipients_quote_id_idx" ON "quote_recipients" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "quote_recipients_email_idx" ON "quote_recipients" USING btree ("email");--> statement-breakpoint
INSERT INTO "quote_recipients" ("quote_id", "email", "name")
SELECT "id", lower(trim("email_gate_recipient_email")), nullif(trim("email_gate_recipient_name"), '')
FROM "quotes"
WHERE "email_gate_recipient_email" IS NOT NULL
  AND trim("email_gate_recipient_email") <> '';--> statement-breakpoint
UPDATE "quote_viewer_emails" AS qve
SET "recipient_id" = qr."id"
FROM "quote_recipients" AS qr
WHERE qve."quote_id" = qr."quote_id"
  AND lower(trim(qve."email")) = qr."email";--> statement-breakpoint
ALTER TABLE "quote_events" ADD CONSTRAINT "quote_events_recipient_id_quote_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."quote_recipients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_viewer_emails" ADD CONSTRAINT "quote_viewer_emails_recipient_id_quote_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."quote_recipients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" DROP COLUMN "email_gate_recipient_email";--> statement-breakpoint
ALTER TABLE "quotes" DROP COLUMN "email_gate_recipient_name";
