CREATE TABLE "user_table_prefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"table_key" text NOT NULL,
	"prefs" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "rc_status" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "bc_status" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "building_stage" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "follow_up_date" date;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "ai_suggestion" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "ai_suggestion_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_table_prefs" ADD CONSTRAINT "user_table_prefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_table_prefs_user_table_key_uq" ON "user_table_prefs" USING btree ("user_id","table_key");