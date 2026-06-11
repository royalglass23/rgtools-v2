UPDATE "modules"
SET "name" = 'Administration',
    "admin_only" = true,
    "is_active" = true,
    "sort_order" = 99
WHERE "slug" = 'admin';
--> statement-breakpoint
INSERT INTO "modules" ("slug", "name", "description", "admin_only", "is_active", "sort_order")
VALUES
  ('admin/lead-scoring', 'Lead Scoring', 'Admin controls for lead scoring configuration.', true, true, 100),
  ('admin/calculator-pricing', 'Cost Calculator Price', 'Admin controls for cost calculator pricing.', true, true, 101)
ON CONFLICT ("slug") DO UPDATE
SET "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "admin_only" = EXCLUDED."admin_only",
    "is_active" = EXCLUDED."is_active",
    "sort_order" = EXCLUDED."sort_order";
