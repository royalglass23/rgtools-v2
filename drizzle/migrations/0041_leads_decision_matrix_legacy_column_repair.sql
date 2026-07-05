ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "legacy_budget_band" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "legacy_building_stage" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "legacy_project_type" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "legacy_decision_makers" text;

UPDATE "leads"
SET
  "legacy_budget_band" = COALESCE("legacy_budget_band", "budget_band"::text),
  "legacy_building_stage" = COALESCE("legacy_building_stage", "building_stage"::text),
  "legacy_project_type" = COALESCE("legacy_project_type", "project_type"::text),
  "legacy_decision_makers" = COALESCE("legacy_decision_makers", "decision_makers"::text);
