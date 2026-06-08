// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users, auditLog } from '@/drizzle/schema'
import { clients, leadCategoryScores, leads } from '@/drizzle/schema-leads'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

const sendLeadToServiceM8InboxMock = vi.hoisted(() => vi.fn())

vi.mock('@/modules/lead-intake/servicem8/client', () => ({
  createServiceM8ClientFromEnv: vi.fn(() => ({ sendLeadToInbox: sendLeadToServiceM8InboxMock })),
}))

import {
  submitLeadIntakeForUser,
  type LeadIntakeInput,
} from '../actions'
import {
  buildCategoryAnswers,
  normalizeNzPhone,
  validateMinimum,
} from '../intake-utils'

const createdLeadIds: string[] = []
const createdClientIds: string[] = []

afterEach(async () => {
  for (const leadId of createdLeadIds.splice(0)) {
    await db.delete(leadCategoryScores).where(eq(leadCategoryScores.leadId, leadId))
    await db.delete(auditLog).where(eq(auditLog.targetId, leadId))
    await db.delete(leads).where(eq(leads.id, leadId))
  }

  for (const clientId of createdClientIds.splice(0)) {
    await db.delete(clients).where(eq(clients.id, clientId))
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  process.env.SERVICEM8_INBOX_EMAIL = 'de9f86@inbox.servicem8.com'
  sendLeadToServiceM8InboxMock.mockResolvedValue({
    reference: `inbox-${crypto.randomUUID()}`,
    noteSignature: 'test-signature',
  })
})

function minimumInput(overrides: Partial<LeadIntakeInput> = {}): LeadIntakeInput {
  return {
    clientName: `Codex Intake Test ${crypto.randomUUID()}`,
    phone: '021 333 444',
    clientProfileKey: '',
    projectType: 'pool_fence',
    location: 'Albany',
    source: 'phone',
    ...overrides,
  }
}

describe('lead intake validation', () => {
  it('enforces the mandatory minimum', () => {
    expect(validateMinimum({
      ...minimumInput(),
      clientName: '',
      phoneNormalized: '+6421333444',
    })).toBe('Client name is required.')

    expect(validateMinimum({
      ...minimumInput({ phone: '', email: '' }),
      phoneNormalized: null,
    })).toBe('Phone or email is required.')

    expect(validateMinimum({
      ...minimumInput({ projectType: '' }),
      phoneNormalized: '+6421333444',
    })).toBe('Project type is required.')

    expect(validateMinimum({
      ...minimumInput({ location: '' }),
      phoneNormalized: '+6421333444',
    })).toBe('Location / suburb is required.')
  })

  it('allows the mandatory minimum without optional fields', () => {
    expect(validateMinimum({
      ...minimumInput({
        budgetBand: '',
        consentStatus: '',
        decisionMakers: '',
        priceSensitivityRead: '',
        freeText: '',
      }),
      phoneNormalized: '+6421333444',
    })).toBeNull()
  })

  it('normalises New Zealand phone numbers', () => {
    expect(normalizeNzPhone('021 333 444')).toBe('+6421333444')
    expect(normalizeNzPhone('+64 21 333 444')).toBe('+6421333444')
  })

  it('stores selected config option keys, not display labels', () => {
    expect(buildCategoryAnswers({
      ...minimumInput({
        clientProfileKey: 'owner_occupier',
        budgetBand: '10k_50k',
        consentStatus: 'under_review',
      }),
      phoneNormalized: '+6421333444',
    })).toEqual([
      { category: 1, answerKey: 'owner_occupier' },
      { category: 2, answerKey: '10k_50k' },
      { category: 3, answerKey: 'under_review' },
      { category: 4, answerKey: undefined },
      { category: 5, answerKey: undefined },
      { category: 6, answerKey: undefined },
      { category: 7, answerKey: undefined },
    ])
  })
})

describe('submitLeadIntakeForUser integration', () => {
  it('minimum submit creates client, lead, audit rows, category rows, and immediately syncs ServiceM8', async () => {
    const [actor] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, 'rgadmin'))
      .limit(1)

    expect(actor).toBeDefined()

    const result = await submitLeadIntakeForUser(minimumInput(), actor.id)
    expect('success' in result).toBe(true)
    if (!('success' in result)) throw new Error(result.error)

    createdLeadIds.push(result.leadId)
    createdClientIds.push(result.clientId)

    const [client] = await db
      .select({
        id: clients.id,
        phoneNormalized: clients.phoneNormalized,
      })
      .from(clients)
      .where(eq(clients.id, result.clientId))
      .limit(1)

    const [lead] = await db
      .select({
        id: leads.id,
        syncStatus: leads.syncStatus,
        tier: leads.tier,
        seedScore: leads.seedScore,
        configVersionId: leads.configVersionId,
      })
      .from(leads)
      .where(eq(leads.id, result.leadId))
      .limit(1)

    const categoryRows = await db
      .select({
        category: leadCategoryScores.category,
        answerKey: leadCategoryScores.answerKey,
      })
      .from(leadCategoryScores)
      .where(eq(leadCategoryScores.leadId, result.leadId))
      .orderBy(leadCategoryScores.category)

    const auditRows = await db
      .select({ action: auditLog.action })
      .from(auditLog)
      .where(eq(auditLog.targetId, result.leadId))

    expect(client.phoneNormalized).toBe('+6421333444')
    expect(lead.syncStatus).toBe('synced')
    expect(lead.tier).toBe(result.tier)
    expect(lead.seedScore).toBe(result.score)
    expect(result.servicem8Sync).toMatchObject({ ok: true })
    expect(sendLeadToServiceM8InboxMock).toHaveBeenCalledOnce()
    expect(lead.configVersionId).toBeTruthy()
    expect(categoryRows.length).toBeGreaterThanOrEqual(6)
    expect(categoryRows[0]).toMatchObject({ category: 1 })
    expect(auditRows.map((row) => row.action).sort()).toEqual([
      'lead.create',
      'lead.score',
      'lead.servicem8_sync',
    ])
  }, 30000)

  it('still saves the lead when immediate ServiceM8 sync fails', async () => {
    sendLeadToServiceM8InboxMock.mockRejectedValue(new Error('ServiceM8 inbox unavailable'))

    const [actor] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, 'rgadmin'))
      .limit(1)

    expect(actor).toBeDefined()

    const result = await submitLeadIntakeForUser(minimumInput(), actor.id)
    expect('success' in result).toBe(true)
    if (!('success' in result)) throw new Error(result.error)

    createdLeadIds.push(result.leadId)
    createdClientIds.push(result.clientId)

    const [lead] = await db
      .select({
        syncStatus: leads.syncStatus,
        syncError: leads.syncError,
      })
      .from(leads)
      .where(eq(leads.id, result.leadId))
      .limit(1)

    expect(result.servicem8Sync).toEqual({
      ok: false,
      leadId: result.leadId,
      error: 'ServiceM8 inbox unavailable',
    })
    expect(lead.syncStatus).toBe('sync_failed')
    expect(lead.syncError).toBe('ServiceM8 inbox unavailable')
  }, 30000)
})
