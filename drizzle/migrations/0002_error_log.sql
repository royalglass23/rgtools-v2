CREATE TABLE "error_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level" text DEFAULT 'error' NOT NULL,
	"source" text NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"user_id" uuid,
	"request_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "error_log" ADD CONSTRAINT "error_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "error_log_created_at_idx" ON "error_log" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "error_log_source_idx" ON "error_log" USING btree ("source");
--> statement-breakpoint
CREATE INDEX "error_log_user_id_idx" ON "error_log" USING btree ("user_id");
