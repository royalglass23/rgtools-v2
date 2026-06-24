CREATE TABLE "quote_notified_viewers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"ip_hash" text NOT NULL,
	"user_agent_hash" text NOT NULL,
	"notified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quote_events" ADD COLUMN "user_agent_hash" text;--> statement-breakpoint
ALTER TABLE "quote_notified_viewers" ADD CONSTRAINT "quote_notified_viewers_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "quote_notified_viewers_unique_idx" ON "quote_notified_viewers" USING btree ("quote_id","ip_hash","user_agent_hash");