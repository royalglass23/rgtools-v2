import {
  pgTable, pgEnum, uuid, text, timestamp, boolean, integer, jsonb, index, uniqueIndex,
} from 'drizzle-orm/pg-core'
import { users } from './schema'

export const psDocumentKindEnum = pgEnum('ps_document_kind', ['ps1', 'ps3'])
export const psGenerationModeEnum = pgEnum('ps_generation_mode', ['ps1_only', 'ps3_only', 'both'])
export const psTemplateVariantKindEnum = pgEnum('ps_template_variant_kind', [
  'standard_ps1', 'pool_ps1', 'gate_ps1', 'ps3', 'other',
])
export const psFieldTypeEnum = pgEnum('ps_field_type', ['text', 'checkbox'])
export const psFieldSourceTypeEnum = pgEnum('ps_field_source_type', [
  'project_value', 'selected_option', 'system_rule', 'description_template', 'date', 'fixed_value',
])
export const psConfigStateEnum = pgEnum('ps_config_state', ['draft', 'published', 'archived'])
export const psConfigEntityTypeEnum = pgEnum('ps_config_entity_type', [
  'system', 'option_category', 'option_value', 'system_option_rule', 'template_variant',
  'field_mapping', 'description_template', 'config_version',
])
export const psConfigAuditActionEnum = pgEnum('ps_config_audit_action', [
  'draft_saved', 'test_generated', 'published', 'archived', 'migrated',
])

export const psConfigVersions = pgTable('ps_config_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  versionLabel: text('version_label').notNull(),
  state: psConfigStateEnum('state').notNull().default('draft'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  publishedBy: uuid('published_by').references(() => users.id, { onDelete: 'set null' }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('ps_config_versions_label_uq').on(table.versionLabel),
  index('ps_config_versions_state_idx').on(table.state),
])

export const psSystems = pgTable('ps_systems', {
  id: uuid('id').primaryKey().defaultRandom(),
  configVersionId: uuid('config_version_id').references(() => psConfigVersions.id, { onDelete: 'set null' }),
  slug: text('slug').notNull(),
  displayName: text('display_name').notNull(),
  state: psConfigStateEnum('state').notNull().default('draft'),
  sortOrder: integer('sort_order').default(0).notNull(),
  heightRules: jsonb('height_rules').notNull().default({}),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('ps_systems_slug_version_uq').on(table.slug, table.configVersionId),
  index('ps_systems_state_idx').on(table.state),
])

export const psOptionCategories = pgTable('ps_option_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').unique().notNull(),
  label: text('label').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const psOptionValues = pgTable('ps_option_values', {
  id: uuid('id').primaryKey().defaultRandom(),
  categoryId: uuid('category_id').notNull().references(() => psOptionCategories.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull(),
  label: text('label').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('ps_option_values_category_slug_uq').on(table.categoryId, table.slug),
  index('ps_option_values_category_idx').on(table.categoryId),
])

export const psSystemOptionRules = pgTable('ps_system_option_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  systemId: uuid('system_id').notNull().references(() => psSystems.id, { onDelete: 'cascade' }),
  optionValueId: uuid('option_value_id').notNull().references(() => psOptionValues.id, { onDelete: 'cascade' }),
  isAllowed: boolean('is_allowed').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('ps_system_option_rules_system_value_uq').on(table.systemId, table.optionValueId),
  index('ps_system_option_rules_system_idx').on(table.systemId),
])

export const psTemplateVariants = pgTable('ps_template_variants', {
  id: uuid('id').primaryKey().defaultRandom(),
  systemId: uuid('system_id').references(() => psSystems.id, { onDelete: 'cascade' }),
  configVersionId: uuid('config_version_id').references(() => psConfigVersions.id, { onDelete: 'set null' }),
  documentKind: psDocumentKindEnum('document_kind').notNull(),
  variantKind: psTemplateVariantKindEnum('variant_kind').notNull(),
  label: text('label').notNull(),
  r2ObjectKey: text('r2_object_key').notNull(),
  originalFilename: text('original_filename'),
  fieldDiscovery: jsonb('field_discovery').notNull().default({}),
  state: psConfigStateEnum('state').notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
}, (table) => [
  index('ps_template_variants_system_idx').on(table.systemId),
  index('ps_template_variants_state_idx').on(table.state),
])

export const psFieldMappings = pgTable('ps_field_mappings', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateVariantId: uuid('template_variant_id').notNull().references(() => psTemplateVariants.id, { onDelete: 'cascade' }),
  fieldName: text('field_name').notNull(),
  fieldType: psFieldTypeEnum('field_type').notNull(),
  sourceType: psFieldSourceTypeEnum('source_type').notNull(),
  sourceKey: text('source_key'),
  fixedValue: text('fixed_value'),
  checkboxValue: boolean('checkbox_value'),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('ps_field_mappings_variant_field_uq').on(table.templateVariantId, table.fieldName),
  index('ps_field_mappings_variant_idx').on(table.templateVariantId),
])

export const psDescriptionTemplates = pgTable('ps_description_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  configVersionId: uuid('config_version_id').references(() => psConfigVersions.id, { onDelete: 'set null' }),
  slug: text('slug').notNull(),
  label: text('label').notNull(),
  pattern: text('pattern').notNull(),
  state: psConfigStateEnum('state').notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('ps_description_templates_slug_version_uq').on(table.slug, table.configVersionId),
  index('ps_description_templates_state_idx').on(table.state),
])

export const psGenerationEvents = pgTable('ps_generation_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  actorLabel: text('actor_label').notNull(),
  configVersionId: uuid('config_version_id').references(() => psConfigVersions.id, { onDelete: 'set null' }),
  generationMode: psGenerationModeEnum('generation_mode').notNull(),
  jobNumber: text('job_number'),
  clientName: text('client_name').notNull(),
  jobAddress: text('job_address').notNull(),
  bcNumber: text('bc_number'),
  lotDescription: text('lot_description'),
  selectionsSnapshot: jsonb('selections_snapshot').notNull().default({}),
  descriptionSnapshot: jsonb('description_snapshot').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('ps_generation_events_created_at_idx').on(table.createdAt),
  index('ps_generation_events_job_number_idx').on(table.jobNumber),
  index('ps_generation_events_actor_idx').on(table.actorId),
])

export const psGeneratedPdfObjects = pgTable('ps_generated_pdf_objects', {
  id: uuid('id').primaryKey().defaultRandom(),
  generationEventId: uuid('generation_event_id').notNull().references(() => psGenerationEvents.id, { onDelete: 'cascade' }),
  documentKind: psDocumentKindEnum('document_kind').notNull(),
  r2ObjectKey: text('r2_object_key').notNull(),
  filename: text('filename').notNull(),
  retainedUntil: timestamp('retained_until', { withTimezone: true }).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('ps_generated_pdf_objects_key_uq').on(table.r2ObjectKey),
  index('ps_generated_pdf_objects_event_idx').on(table.generationEventId),
  index('ps_generated_pdf_objects_retention_idx').on(table.retainedUntil, table.deletedAt),
])

export const psConfigurationAuditEntries = pgTable('ps_configuration_audit_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  entityType: psConfigEntityTypeEnum('entity_type').notNull(),
  entityId: uuid('entity_id'),
  action: psConfigAuditActionEnum('action').notNull(),
  configVersionId: uuid('config_version_id').references(() => psConfigVersions.id, { onDelete: 'set null' }),
  before: jsonb('before'),
  after: jsonb('after'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('ps_config_audit_created_at_idx').on(table.createdAt),
  index('ps_config_audit_entity_idx').on(table.entityType, table.entityId),
  index('ps_config_audit_actor_idx').on(table.actorId),
])

export const psMigrationRecords = pgTable('ps_migration_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceSystem: text('source_system').notNull(),
  sourceRecordId: text('source_record_id').notNull(),
  generationEventId: uuid('generation_event_id').references(() => psGenerationEvents.id, { onDelete: 'set null' }),
  actorLabel: text('actor_label').notNull().default('migrated'),
  snapshot: jsonb('snapshot').notNull().default({}),
  migratedAt: timestamp('migrated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('ps_migration_records_source_uq').on(table.sourceSystem, table.sourceRecordId),
  index('ps_migration_records_generation_event_idx').on(table.generationEventId),
])
