ALTER TYPE "public"."event_type" ADD VALUE 'page_view';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE 'download';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE 'cta';--> statement-breakpoint
ALTER TABLE "quote_engagement" ADD COLUMN "max_page_number" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_events" ADD COLUMN "ip" text;--> statement-breakpoint
ALTER TABLE "quote_events" ADD COLUMN "geo_country" text;--> statement-breakpoint
ALTER TABLE "quote_events" ADD COLUMN "geo_city" text;--> statement-breakpoint
ALTER TABLE "quote_events" ADD COLUMN "geo_region" text;--> statement-breakpoint
ALTER TABLE "quote_events" ADD COLUMN "geo_isp" text;--> statement-breakpoint
ALTER TABLE "quote_events" ADD COLUMN "page_number" integer;