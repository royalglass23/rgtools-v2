import {
  pgTable, pgEnum, uuid, text, timestamp, boolean,
  integer, numeric, jsonb, index, uniqueIndex,
} from 'drizzle-orm/pg-core'
import { users } from './schema'

export const leadClientTypeEnum = pgEnum('lead_client_type', [
  'homeowner', 'builder', 'developer', 'investor', 'repeat_exclusive',
])
export const leadSourceEnum = pgEnum('lead_source', [
  'phone', 'email', 'wechat', 'calculator', 'contact_form', 'other',
])
export const leadSyncStatusEnum = pgEnum('lead_sync_status', [
  'pending_sync', 'synced', 'sync_failed',
])
export const leadTierEnum = pgEnum('lead_tier', ['A', 'B', 'C', 'D'])
export const leadOutcomeEnum = pgEnum('lead_outcome', [
  'won', 'lost_outside_rubric', 'lost_score_wrong', 'lost_served_late',
  'lost_silence', 'disqualified',
])

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  companyName: text('company_name'),
  email: text('email'),
  phone: text('phone'),
  phoneNormalized: text('phone_normalized'),
  clientType: leadClientTypeEnum('client_type'),
  isRepeatClient: boolean('is_repeat_client').default(false).notNull(),
  lifetimeJobs: integer('lifetime_jobs').default(0).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('clients_phone_norm_idx').on(t.phoneNormalized),
  index('clients_email_idx').on(t.email),
])

export const scoringConfigVersions = pgTable('scoring_config_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  versionLabel: text('version_label').notNull(),
  isActive: boolean('is_active').default(false).notNull(),
  config: jsonb('config').notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('scoring_config_label_uq').on(t.versionLabel),
  // The "only one active version" partial unique index is added by HAND in Step 3.
  // Drizzle cannot express the WHERE clause cleanly - do NOT attempt it here.
])

export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  source: leadSourceEnum('source').notNull(),
  externalRef: text('external_ref'),
  syncStatus: leadSyncStatusEnum('sync_status').default('pending_sync').notNull(),
  servicem8JobUuid: text('servicem8_job_uuid'),
  servicem8Status: text('servicem8_status'),
  syncError: text('sync_error'),
  projectType: text('project_type'),
  location: text('location'),
  suburb: text('suburb'),
  budgetBand: text('budget_band'),
  timeline: text('timeline'),
  consentStatus: text('consent_status'),
  decisionMakers: text('decision_makers'),
  priceSensitivityRead: text('price_sensitivity_read'),
  hasOtherQuotes: boolean('has_other_quotes'),
  freeText: text('free_text'),
  configVersionId: uuid('config_version_id').references(() => scoringConfigVersions.id),
  seedScore: integer('seed_score'),
  tier: leadTierEnum('tier'),
  scoreReason: text('score_reason'),
  strikeFlag: text('strike_flag'),
  scoredAt: timestamp('scored_at', { withTimezone: true }),
  completeness: integer('completeness'),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('leads_client_idx').on(t.clientId),
  index('leads_tier_idx').on(t.tier),
  index('leads_sync_status_idx').on(t.syncStatus),
  index('leads_servicem8_idx').on(t.servicem8JobUuid),
  uniqueIndex('leads_external_ref_uq').on(t.externalRef),
])

export const leadCategoryScores = pgTable('lead_category_scores', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  category: integer('category').notNull(),
  answerKey: text('answer_key'),
  points: integer('points').notNull(),
  configVersionId: uuid('config_version_id').references(() => scoringConfigVersions.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('lead_cat_scores_lead_idx').on(t.leadId),
  uniqueIndex('lead_cat_uq').on(t.leadId, t.category),
])

export const leadOutcomes = pgTable('lead_outcomes', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }).unique(),
  outcome: leadOutcomeEnum('outcome').notNull(),
  reasonDetail: text('reason_detail'),
  finalValue: numeric('final_value', { precision: 10, scale: 2 }),
  closedBy: uuid('closed_by').references(() => users.id),
  closedAt: timestamp('closed_at', { withTimezone: true }).defaultNow().notNull(),
})

export const leadStatusChanges = pgTable('lead_status_changes', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  changedBy: uuid('changed_by').notNull().references(() => users.id),
  previousTier: leadTierEnum('previous_tier'),
  newTier: leadTierEnum('new_tier'),
  reason: text('reason').notNull(),
  wasSystemSuggested: boolean('was_system_suggested').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('lead_status_changes_lead_idx').on(t.leadId),
])

export const leadSubmitAttempts = pgTable('lead_submit_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  ip: text('ip').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('lead_submit_attempts_ip_created_at_idx').on(t.ip, t.createdAt),
])

export const leadSubmitFailures = pgTable('lead_submit_failures', {
  id: uuid('id').primaryKey().defaultRandom(),
  correlationId: text('correlation_id').notNull(),
  ip: text('ip').notNull(),
  stage: text('stage').notNull(),
  error: text('error').notNull(),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('lead_submit_failures_created_at_idx').on(t.createdAt),
  index('lead_submit_failures_correlation_idx').on(t.correlationId),
])

export const leadEmailLog = pgTable('lead_email_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
  recipient: text('recipient').notNull(),
  status: text('status').notNull(),
  providerMessageId: text('provider_message_id'),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('lead_email_log_lead_idx').on(t.leadId),
  index('lead_email_log_created_at_idx').on(t.createdAt),
])
