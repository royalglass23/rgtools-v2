WITH canonical_options(category_slug, option_slug, label, sort_order) AS (
  VALUES
    ('structure_type', 'deck', 'Deck', 10),
    ('structure_type', 'balcony', 'Balcony', 20),
    ('structure_type', 'pool', 'Pool Area', 30),
    ('structure_type', 'stair', 'Stair Area', 40),
    ('structure_type', 'landing', 'Landing', 50),
    ('structure_type', 'stair-and-landing', 'Stair and Landing', 60),
    ('structure_type', 'stair-and-balcony', 'Stair and Balcony Area', 70),
    ('location', 'external', 'External', 10),
    ('location', 'internal', 'Internal', 20),
    ('location', 'both', 'External and Internal', 30)
)
INSERT INTO "ps_option_values" (
  "config_version_id",
  "category_id",
  "slug",
  "label",
  "sort_order",
  "is_active",
  "created_at",
  "updated_at",
  "archived_at"
)
SELECT
  versions."id",
  categories."id",
  canonical_options.option_slug,
  canonical_options.label,
  canonical_options.sort_order,
  true,
  now(),
  now(),
  NULL
FROM "ps_config_versions" versions
CROSS JOIN canonical_options
JOIN "ps_option_categories" categories
  ON categories."slug" = canonical_options.category_slug
WHERE versions."archived_at" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "ps_option_values" existing
    WHERE existing."config_version_id" = versions."id"
      AND existing."category_id" = categories."id"
      AND existing."slug" = canonical_options.option_slug
  );

WITH allowed_options AS (
  SELECT
    systems."id" AS system_id,
    option_values."id" AS option_value_id
  FROM "ps_systems" systems
  JOIN "ps_option_values" option_values
    ON option_values."config_version_id" = systems."config_version_id"
  JOIN "ps_option_categories" categories
    ON categories."id" = option_values."category_id"
  WHERE systems."archived_at" IS NULL
    AND systems."state" IN ('published', 'draft')
    AND categories."slug" IN ('structure_type', 'location')
    AND option_values."archived_at" IS NULL
)
INSERT INTO "ps_system_option_rules" (
  "system_id",
  "option_value_id",
  "is_allowed",
  "created_at",
  "updated_at"
)
SELECT
  allowed_options.system_id,
  allowed_options.option_value_id,
  true,
  now(),
  now()
FROM allowed_options
WHERE NOT EXISTS (
  SELECT 1
  FROM "ps_system_option_rules" existing
  WHERE existing."system_id" = allowed_options.system_id
    AND existing."option_value_id" = allowed_options.option_value_id
);
