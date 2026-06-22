ALTER TABLE "users" ADD COLUMN "servicem8_staff_uuid" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_servicem8_staff_uuid_unique" UNIQUE("servicem8_staff_uuid");