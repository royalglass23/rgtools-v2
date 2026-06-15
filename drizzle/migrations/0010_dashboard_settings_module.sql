INSERT INTO "modules" ("slug", "name", "description", "admin_only", "is_active", "sort_order")
VALUES
  ('admin/dashboard-settings', 'Dashboard Settings', 'Admin controls for which tables appear on the dashboard.', true, true, 102)
ON CONFLICT ("slug") DO UPDATE
SET "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "admin_only" = EXCLUDED."admin_only",
    "is_active" = EXCLUDED."is_active",
    "sort_order" = EXCLUDED."sort_order";
