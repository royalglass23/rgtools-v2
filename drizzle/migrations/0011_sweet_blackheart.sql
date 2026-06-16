ALTER TABLE "quotes" ADD COLUMN "pdf_storage_key" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "short_code" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "email_gate_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "owner_user_id" uuid;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_servicem8_uuid_unique" UNIQUE("servicem8_uuid");--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_short_code_unique" UNIQUE("short_code");