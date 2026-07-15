WITH system_height_defaults AS (
  SELECT
    "id",
    CASE
      WHEN lower("slug") = 'double-disc'
        OR regexp_replace(lower("display_name"), '[^a-z0-9]', '', 'g') = 'doubledisc'
        OR "height_rules" ->> 'maxHeightMm' = '1000'
      THEN '1.00'
      ELSE '1.00'
    END AS default_height,
    CASE
      WHEN lower("slug") = 'double-disc'
        OR regexp_replace(lower("display_name"), '[^a-z0-9]', '', 'g') = 'doubledisc'
        OR "height_rules" ->> 'maxHeightMm' = '1000'
      THEN '1.05'
      ELSE '1.00'
    END AS default_height_above_fix,
    '1.20' AS pool_height,
    CASE
      WHEN lower("slug") = 'double-disc'
        OR regexp_replace(lower("display_name"), '[^a-z0-9]', '', 'g') = 'doubledisc'
        OR "height_rules" ->> 'maxHeightMm' = '1000'
      THEN '1.25'
      ELSE '1.20'
    END AS pool_height_above_fix
  FROM "ps_systems"
  WHERE "archived_at" IS NULL
    AND "state" IN ('published', 'draft')
)
UPDATE "ps_systems" systems
SET
  "height_rules" = systems."height_rules" || jsonb_build_object(
    'default',
    jsonb_build_object(
      'height',
      COALESCE(NULLIF(systems."height_rules" #>> '{default,height}', ''), defaults.default_height),
      'heightAboveFix',
      COALESCE(NULLIF(systems."height_rules" #>> '{default,heightAboveFix}', ''), defaults.default_height_above_fix)
    ),
    'pool',
    jsonb_build_object(
      'height',
      COALESCE(NULLIF(systems."height_rules" #>> '{pool,height}', ''), defaults.pool_height),
      'heightAboveFix',
      COALESCE(NULLIF(systems."height_rules" #>> '{pool,heightAboveFix}', ''), defaults.pool_height_above_fix)
    )
  ),
  "updated_at" = now()
FROM system_height_defaults defaults
WHERE systems."id" = defaults."id"
  AND (
    NULLIF(systems."height_rules" #>> '{default,height}', '') IS NULL
    OR NULLIF(systems."height_rules" #>> '{default,heightAboveFix}', '') IS NULL
    OR NULLIF(systems."height_rules" #>> '{pool,height}', '') IS NULL
    OR NULLIF(systems."height_rules" #>> '{pool,heightAboveFix}', '') IS NULL
  );
