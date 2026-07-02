ALTER TABLE "work_order_events" ADD COLUMN IF NOT EXISTS "is_client_visible_candidate" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "work_order_events" ADD COLUMN IF NOT EXISTS "portal_title" text;--> statement-breakpoint
ALTER TABLE "work_order_events" ADD COLUMN IF NOT EXISTS "portal_message" text;--> statement-breakpoint
ALTER TABLE "work_order_events" ADD COLUMN IF NOT EXISTS "portal_marked_by" uuid;--> statement-breakpoint
ALTER TABLE "work_order_events" ADD COLUMN IF NOT EXISTS "portal_marked_at" timestamp with time zone;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "work_order_events" ADD CONSTRAINT "work_order_events_portal_marked_by_users_id_fk" FOREIGN KEY ("portal_marked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_order_events_client_visible_idx" ON "work_order_events" USING btree ("is_client_visible_candidate");
