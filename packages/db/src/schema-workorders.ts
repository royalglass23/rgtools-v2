import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { users, quotes } from './schema'
import { clients, leads } from './schema-leads'

export const workOrderLevelEnum = pgEnum('work_order_level', ['low', 'medium', 'high'])

export const workOrderInstallers = pgTable('work_order_installers', {
  id: uuid('id').primaryKey().defaultRandom(),
  displayName: text('display_name').notNull(),
  normalizedName: text('normalized_name').notNull(),
  servicem8StaffUuid: text('servicem8_staff_uuid'),
  isActive: boolean('is_active').default(true).notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('work_order_installers_normalized_name_uq').on(table.normalizedName),
  index('work_order_installers_active_idx').on(table.isActive),
])

export const workOrderStageOptions = pgTable('work_order_stage_options', {
  id: uuid('id').primaryKey().defaultRandom(),
  displayName: text('display_name').notNull(),
  normalizedName: text('normalized_name').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('work_order_stage_options_normalized_name_uq').on(table.normalizedName),
  index('work_order_stage_options_active_idx').on(table.isActive),
])

export const workOrderHardwareStatusOptions = pgTable('work_order_hardware_status_options', {
  id: uuid('id').primaryKey().defaultRandom(),
  displayName: text('display_name').notNull(),
  normalizedName: text('normalized_name').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('work_order_hardware_status_options_normalized_name_uq').on(table.normalizedName),
  index('work_order_hardware_status_options_active_idx').on(table.isActive),
])

export const workOrders = pgTable('work_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  servicem8JobUuid: text('servicem8_job_uuid').notNull(),
  servicem8CompanyUuid: text('servicem8_company_uuid'),
  servicem8Status: text('servicem8_status').notNull(),
  servicem8Active: boolean('servicem8_active').default(true).notNull(),
  jobNumber: text('job_number'),
  jobAddress: text('job_address'),
  jobDescription: text('job_description'),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
  quoteId: uuid('quote_id').references(() => quotes.id, { onDelete: 'set null' }),
  clientName: text('client_name').notNull(),
  companyName: text('company_name'),
  leadScore: integer('lead_score'),
  installerId: uuid('installer_id').references(() => workOrderInstallers.id, { onDelete: 'set null' }),
  stageOptionId: uuid('stage_option_id').references(() => workOrderStageOptions.id, { onDelete: 'set null' }),
  hardwareStatusOptionId: uuid('hardware_status_option_id').references(() => workOrderHardwareStatusOptions.id, { onDelete: 'set null' }),
  installDate: date('install_date'),
  dateCompleted: date('date_completed'),
  aiRiskLevel: workOrderLevelEnum('ai_risk_level'),
  riskLevelOverride: workOrderLevelEnum('risk_level_override'),
  aiImportance: workOrderLevelEnum('ai_importance'),
  importanceOverride: workOrderLevelEnum('importance_override'),
  aiSuggestion: text('ai_suggestion'),
  clientContextSummary: text('client_context_summary'),
  clientContextSummaryAt: timestamp('client_context_summary_at', { withTimezone: true }),
  clientApproachNote: text('client_approach_note'),
  lastServiceM8SyncedAt: timestamp('last_servicem8_synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('work_orders_servicem8_job_uuid_uq').on(table.servicem8JobUuid),
  index('work_orders_status_idx').on(table.servicem8Status, table.servicem8Active),
  index('work_orders_job_number_idx').on(table.jobNumber),
  index('work_orders_client_idx').on(table.clientId),
  index('work_orders_lead_idx').on(table.leadId),
  index('work_orders_quote_idx').on(table.quoteId),
])

export const workOrderEvents = pgTable('work_order_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  workOrderId: uuid('work_order_id').notNull().references(() => workOrders.id, { onDelete: 'cascade' }),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  fieldName: text('field_name').notNull(),
  previousValue: jsonb('previous_value'),
  newValue: jsonb('new_value'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('work_order_events_work_order_idx').on(table.workOrderId),
  index('work_order_events_actor_idx').on(table.actorId),
  index('work_order_events_created_at_idx').on(table.createdAt),
])
