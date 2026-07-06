import {
  pgTable, pgEnum, uuid, text, timestamp, boolean,
  integer, numeric, jsonb, date, index, uniqueIndex,
} from 'drizzle-orm/pg-core'
import { users } from './schema'

export const leadClientTypeEnum = pgEnum('lead_client_type', [
  'homeowner', 'builder', 'developer', 'investor', 'repeat_exclusive',
])
export const leadChannelEnum = pgEnum('lead_channel', [
  'phone', 'email', 'wechat', 'calculator', 'contact_form', 'other',
])
export const leadMatrixClientTypeEnum = pgEnum('lead_matrix_client_type', [
  'builder_developer_pool_builder_landscaper', 'homeowner',
])
export const leadBudgetBandEnum = pgEnum('lead_budget_band', [
  '50k_plus', '20k_50k', '5k_20k', 'lt_5k',
])
export const leadConsentStatusEnum = pgEnum('lead_consent_status', [
  'approved_not_required', 'submitted_pending', 'not_available',
])
export const leadBuildingStageEnum = pgEnum('lead_building_stage', [
  'ready_for_glazing', 'interior_finish', 'gib_plastering_framing_complete',
  'foundation_early_construction', 'planning',
])
export const leadProjectTypeEnum = pgEnum('lead_project_type', [
  'new_build_commercial_fit_out', 'high_end_residential_multi_unit_residential',
  'renovation_replacement',
])
export const leadPriceSensitivityEnum = pgEnum('lead_price_sensitivity', [
  'not_price_sensitive', 'value_focused', 'normal', 'price_sensitive', 'cheapest_only',
])
export const leadDecisionMakersEnum = pgEnum('lead_decision_makers', [
  'decision_maker_confirmed_owner_director', 'project_manager_site_manager',
  'multiple_decision_makers_unknown',
])
export const leadWarmthSourceEnum = pgEnum('lead_warmth_source', [
  'existing_client_referral_repeat_builder_architect', 'website_google_walk_in_cold_lead',
])
export const leadDistanceBandEnum = pgEnum('lead_distance_band', [
  'lt_15km', '15_50km', 'gt_50km',
])
export const leadPaymentHistoryEnum = pgEnum('lead_payment_history', [
  'always_on_time_good', 'new_client', 'slow_payment_poor_history',
])
export const leadSiteAccessEnum = pgEnum('lead_site_access', [
  'easy', 'normal', 'tight', 'very_difficult',
])
export const leadInstallationHeightEnum = pgEnum('lead_installation_height', [
  'ground_floor_ladder', 'scaffold_ewp_crane',
])
export const leadSyncStatusEnum = pgEnum('lead_sync_status', [
  'pending_sync', 'synced', 'sync_failed',
])
export const leadTierEnum = pgEnum('lead_tier', ['A', 'B', 'C', 'D', 'E'])
export const clientIdentityTypeEnum = pgEnum('client_identity_type', [
  'company', 'individual_homeowner', 'household', 'contractor', 'sole_trader', 'other',
])
export const clientReviewStatusEnum = pgEnum('client_review_status', [
  'pending_review', 'reviewed', 'dismissed',
])
export const clientCanonicalSourceEnum = pgEnum('client_canonical_source', [
  'import', 'manual', 'system',
])
export const clientAliasSourceEnum = pgEnum('client_alias_source', [
  'servicem8_import', 'manual', 'merge',
])
export const leadOutcomeEnum = pgEnum('lead_outcome', [
  'won', 'lost_outside_rubric', 'lost_score_wrong', 'lost_served_late',
  'lost_silence', 'disqualified',
])

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  servicem8CompanyUuid: text('servicem8_company_uuid'),
  name: text('name').notNull(),
  companyName: text('company_name'),
  email: text('email'),
  phone: text('phone'),
  phoneNormalized: text('phone_normalized'),
  clientType: leadClientTypeEnum('client_type'),
  identityType: clientIdentityTypeEnum('identity_type'),
  canonicalSource: clientCanonicalSourceEnum('canonical_source').default('import').notNull(),
  canonicalUpdatedBy: uuid('canonical_updated_by').references(() => users.id),
  canonicalUpdatedAt: timestamp('canonical_updated_at', { withTimezone: true }).defaultNow().notNull(),
  servicem8Name: text('servicem8_name'),
  servicem8CompanyName: text('servicem8_company_name'),
  servicem8Email: text('servicem8_email'),
  servicem8Phone: text('servicem8_phone'),
  servicem8PhoneNormalized: text('servicem8_phone_normalized'),
  servicem8SourceSnapshot: jsonb('servicem8_source_snapshot'),
  servicem8LastSyncedAt: timestamp('servicem8_last_synced_at', { withTimezone: true }),
  reviewStatus: clientReviewStatusEnum('review_status').default('pending_review').notNull(),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewNote: text('review_note'),
  isRepeatClient: boolean('is_repeat_client').default(false).notNull(),
  lifetimeJobs: integer('lifetime_jobs').default(0).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('clients_phone_norm_idx').on(t.phoneNormalized),
  index('clients_email_idx').on(t.email),
  index('clients_identity_type_idx').on(t.identityType),
  index('clients_review_status_idx').on(t.reviewStatus),
  // Canonical identity for a "linked" client. The partial UNIQUE index
  // (WHERE servicem8_company_uuid IS NOT NULL) is added by hand in the
  // migration — Drizzle cannot express the partial WHERE clause.
  index('clients_servicem8_company_uuid_idx').on(t.servicem8CompanyUuid),
])

export const clientContacts = pgTable('client_contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  name: text('name'),
  phone: text('phone'),
  phoneNormalized: text('phone_normalized'),
  email: text('email'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('client_contacts_client_idx').on(t.clientId),
  index('client_contacts_phone_norm_idx').on(t.phoneNormalized),
  index('client_contacts_email_idx').on(t.email),
])

export const clientAliases = pgTable('client_aliases', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  alias: text('alias').notNull(),
  source: clientAliasSourceEnum('source').default('manual').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('client_aliases_client_idx').on(t.clientId),
  index('client_aliases_alias_idx').on(t.alias),
  uniqueIndex('client_aliases_client_alias_uq').on(t.clientId, t.alias),
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

export const pricingConfigVersions = pgTable('pricing_config_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  versionLabel: text('version_label').notNull(),
  isActive: boolean('is_active').default(false).notNull(),
  config: jsonb('config').notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('pricing_config_label_uq').on(t.versionLabel),
  // The "only one active version" partial unique index is added by hand in the migration.
])

export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  contactId: uuid('contact_id').references(() => clientContacts.id, { onDelete: 'set null' }),
  channel: leadChannelEnum('channel').notNull(),
  externalRef: text('external_ref'),
  syncStatus: leadSyncStatusEnum('sync_status').default('pending_sync').notNull(),
  servicem8JobUuid: text('servicem8_job_uuid'),
  servicem8JobNumber: text('servicem8_job_number'),
  servicem8Status: text('servicem8_status'),
  syncError: text('sync_error'),
  clientTypeAnswer: leadMatrixClientTypeEnum('client_type_answer'),
  budgetBand: leadBudgetBandEnum('budget_band'),
  resourceConsent: leadConsentStatusEnum('resource_consent'),
  buildingConsent: leadConsentStatusEnum('building_consent'),
  buildingStage: leadBuildingStageEnum('building_stage'),
  projectType: leadProjectTypeEnum('project_type'),
  priceSensitivity: leadPriceSensitivityEnum('price_sensitivity'),
  decisionMakers: leadDecisionMakersEnum('decision_makers'),
  source: leadWarmthSourceEnum('source'),
  distanceBand: leadDistanceBandEnum('distance_band'),
  rawDrivingDistanceKm: numeric('raw_driving_distance_km', { precision: 8, scale: 2 }),
  paymentHistory: leadPaymentHistoryEnum('payment_history'),
  siteAccess: leadSiteAccessEnum('site_access'),
  installationHeight: leadInstallationHeightEnum('installation_height'),
  jobDescription: text('job_description'),
  product: text('product'),
  legacyBudgetBand: text('legacy_budget_band'),
  legacyBuildingStage: text('legacy_building_stage'),
  legacyProjectType: text('legacy_project_type'),
  legacyDecisionMakers: text('legacy_decision_makers'),
  location: text('location'),
  suburb: text('suburb'),
  timeline: text('timeline'),
  consentStatus: text('consent_status'),
  rcStatus: text('rc_status'),
  bcStatus: text('bc_status'),
  followUpDate: date('follow_up_date'),
  aiSuggestion: text('ai_suggestion'),
  aiSuggestionAt: timestamp('ai_suggestion_at', { withTimezone: true }),
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
  index('leads_servicem8_job_number_idx').on(t.servicem8JobNumber),
  uniqueIndex('leads_external_ref_uq').on(t.externalRef),
])

export const leadReviewerNotes = pgTable('lead_reviewer_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull().references(() => users.id),
  text: text('text').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('lead_reviewer_notes_lead_idx').on(t.leadId),
  index('lead_reviewer_notes_author_idx').on(t.authorId),
])

export const userTablePrefs = pgTable('user_table_prefs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  tableKey: text('table_key').notNull(),
  prefs: jsonb('prefs').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('user_table_prefs_user_table_key_uq').on(t.userId, t.tableKey),
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
  submissionRef: text('submission_ref'),
  ip: text('ip').notNull(),
  stage: text('stage').notNull(),
  error: text('error').notNull(),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('lead_submit_failures_created_at_idx').on(t.createdAt),
  index('lead_submit_failures_correlation_idx').on(t.correlationId),
  index('lead_submit_failures_submission_ref_idx').on(t.submissionRef),
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
