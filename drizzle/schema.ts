import {
  pgTable, pgEnum, uuid, text, timestamp, boolean,
  integer, bigint, numeric, jsonb, primaryKey, index,
} from 'drizzle-orm/pg-core'

export const roleEnum = pgEnum('role', ['admin', 'staff'])
export const pipelineStageEnum = pgEnum('pipeline_stage', [
  'estimate', 'pending_quote', 'quote_sent', 'intent_scoring', 'closed',
])
export const outcomeEnum = pgEnum('outcome', ['won', 'lost'])
export const statusTagEnum = pgEnum('status_tag', ['hot', 'warm', 'cold', 'dead'])
export const clientTypeEnum = pgEnum('client_type', ['builder', 'homeowner', 'architect'])
export const aiComplexityEnum = pgEnum('ai_complexity', ['low', 'medium', 'high'])
export const eventTypeEnum = pgEnum('event_type', ['open', 'scroll', 'close'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').notNull().default('staff'),
  isProtected: boolean('is_protected').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const quotes = pgTable('quotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  servicem8Uuid: text('servicem8_uuid').notNull(),
  token: uuid('token').unique().notNull().defaultRandom(),
  clientName: text('client_name').notNull(),
  companyName: text('company_name'),
  jobDescription: text('job_description'),
  quoteValue: numeric('quote_value', { precision: 10, scale: 2 }),
  pipelineStage: pipelineStageEnum('pipeline_stage').notNull().default('pending_quote'),
  outcome: outcomeEnum('outcome'),
  workOrderId: text('work_order_id'),
  convertedAt: timestamp('converted_at', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  statusTag: statusTagEnum('status_tag'),
  clientType: clientTypeEnum('client_type'),
  aiScore: integer('ai_score'),
  aiConfidence: numeric('ai_confidence', { precision: 4, scale: 3 }),
  aiComplexity: aiComplexityEnum('ai_complexity'),
  internalNotes: text('internal_notes'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const quoteEvents = pgTable('quote_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  quoteId: uuid('quote_id').notNull().references(() => quotes.id, { onDelete: 'cascade' }),
  eventType: eventTypeEnum('event_type').notNull(),
  deviceType: text('device_type'),
  sessionId: uuid('session_id').notNull(),
  scrollDepth: integer('scroll_depth'),
  durationMs: integer('duration_ms'),
  ipHash: text('ip_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const quoteEngagement = pgTable('quote_engagement', {
  id: uuid('id').primaryKey().defaultRandom(),
  quoteId: uuid('quote_id').unique().notNull().references(() => quotes.id, { onDelete: 'cascade' }),
  totalOpens: integer('total_opens').default(0).notNull(),
  totalTimeMs: bigint('total_time_ms', { mode: 'number' }).default(0).notNull(),
  maxScrollDepth: integer('max_scroll_depth').default(0).notNull(),
  uniqueSessions: integer('unique_sessions').default(0).notNull(),
  uniqueDevices: integer('unique_devices').default(0).notNull(),
  forwardingSuspected: boolean('forwarding_suspected').default(false).notNull(),
  lastOpenedAt: timestamp('last_opened_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const tagOverrides = pgTable('tag_overrides', {
  id: uuid('id').primaryKey().defaultRandom(),
  quoteId: uuid('quote_id').notNull().references(() => quotes.id, { onDelete: 'cascade' }),
  overriddenBy: uuid('overridden_by').notNull().references(() => users.id),
  previousTag: statusTagEnum('previous_tag').notNull(),
  newTag: statusTagEnum('new_tag').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const settings = pgTable('settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').unique().notNull(),
  value: text('value').notNull(),
  updatedBy: uuid('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const modules = pgTable('modules', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').unique().notNull(),
  name: text('name').notNull(),
  description: text('description'),
  adminOnly: boolean('admin_only').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const userModuleAccess = pgTable('user_module_access', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  moduleId: uuid('module_id').notNull().references(() => modules.id, { onDelete: 'cascade' }),
  grantedBy: uuid('granted_by').references(() => users.id),
  grantedAt: timestamp('granted_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.moduleId] }),
])

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id').notNull().references(() => users.id),
  action: text('action').notNull(),
  targetId: uuid('target_id'),
  detail: jsonb('detail'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('audit_log_created_at_idx').on(table.createdAt).desc(),
  index('audit_log_actor_id_idx').on(table.actorId),
])
