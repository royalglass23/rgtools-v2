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
import { fetchLeadFromServiceM8, type ServiceM8FetchRequest } from '@/modules/leads/servicem8-fetch'
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
        rcStatus: 'approved',
        bcStatus: 'not_required',
        buildingStage: 'fitout_complete',
      }),
      phoneNormalized: '+6421333444',
    })).toEqual([
      { category: 1, answerKey: 'owner_occupier' },
      { category: 2, answerKey: '10k_50k' },
      { category: 4, answerKey: undefined },
      { category: 5, answerKey: undefined },
      { category: 6, answerKey: undefined },
      { category: 7, answerKey: undefined },
      { category: 8, answerKey: 'approved' },
      { category: 9, answerKey: 'not_required' },
      { category: 10, answerKey: 'fitout_complete' },
    ])
  })
})

// Live-Neon integration tests (require DATABASE_URL reachable + seeded rgadmin user).
// Opt in with RUN_DB_TESTS=1 — the default suite stays hermetic for sandboxes/CI.
describe.skipIf(!process.env.RUN_DB_TESTS)('submitLeadIntakeForUser integration', () => {
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

  it('requires an edit reason before updating an existing lead', async () => {
    const [actor] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, 'rgadmin'))
      .limit(1)

    const created = await submitLeadIntakeForUser(minimumInput(), actor.id)
    expect('success' in created).toBe(true)
    if (!('success' in created)) throw new Error(created.error)

    createdLeadIds.push(created.leadId)
    createdClientIds.push(created.clientId)

    const result = await submitLeadIntakeForUser(
      minimumInput({
        leadId: created.leadId,
        clientName: 'Edited Without Reason',
        editReason: '',
      }),
      actor.id,
    )

    expect(result).toEqual({ error: 'Reason for edit is required.' })
  }, 30000)

  it('audits edits with the mandatory edit reason', async () => {
    const [actor] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, 'rgadmin'))
      .limit(1)

    const created = await submitLeadIntakeForUser(minimumInput(), actor.id)
    expect('success' in created).toBe(true)
    if (!('success' in created)) throw new Error(created.error)

    createdLeadIds.push(created.leadId)
    createdClientIds.push(created.clientId)

    const edited = await submitLeadIntakeForUser(
      minimumInput({
        leadId: created.leadId,
        clientName: 'Edited With Reason',
        editReason: 'Customer corrected the project address.',
      }),
      actor.id,
    )

    expect('success' in edited).toBe(true)
    if (!('success' in edited)) throw new Error(edited.error)

    const auditRows = await db
      .select({ action: auditLog.action, detail: auditLog.detail })
      .from(auditLog)
      .where(eq(auditLog.targetId, created.leadId))

    const editAudit = auditRows.find((row) => row.action === 'lead.edited')
    expect(editAudit?.detail).toMatchObject({
      reason: 'Customer corrected the project address.',
    })
  }, 30000)

  it('returns a not-found result when no ServiceM8 job contains the lead reference', async () => {
    const [actor] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, 'rgadmin'))
      .limit(1)

    const created = await submitLeadIntakeForUser(minimumInput(), actor.id)
    expect('success' in created).toBe(true)
    if (!('success' in created)) throw new Error(created.error)

    createdLeadIds.push(created.leadId)
    createdClientIds.push(created.clientId)

    const request = vi.fn<ServiceM8FetchRequest>(async () => ({
      ok: true,
      status: 200,
      json: async () => [{ uuid: 'job-1', job_description: 'Other job', status: 'Work Order' }],
    }))

    const result = await fetchLeadFromServiceM8(created.leadId, actor.id, { request })

    expect(result).toEqual({
      ok: false,
      reason: 'not_found',
      message: 'No matching job found in ServiceM8 yet',
    })
    expect(request).toHaveBeenCalledTimes(2)
    expect(request.mock.calls[0]?.[0]).toMatch(/^\/job\.json\?/)
    expect(request).toHaveBeenNthCalledWith(2, '/inboxmessage.json?limit=500&offset=0&filter=all')
  }, 30000)

  it('links a matching ServiceM8 job, stores status, and sets Leads Quality only for a new link', async () => {
    process.env.SERVICEM8_LEAD_QUALITY_FIELD = 'quality-field-uuid'

    const [actor] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, 'rgadmin'))
      .limit(1)

    const created = await submitLeadIntakeForUser(minimumInput(), actor.id)
    expect('success' in created).toBe(true)
    if (!('success' in created)) throw new Error(created.error)

    createdLeadIds.push(created.leadId)
    createdClientIds.push(created.clientId)

    await db
      .update(leads)
      .set({ tier: 'B', seedScore: 72, completeness: 80, servicem8JobUuid: null })
      .where(eq(leads.id, created.leadId))

    const request = vi.fn<ServiceM8FetchRequest>(async (path, init) => {
      if (path.startsWith('/job.json')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              uuid: 'job-uuid-1',
              job_description: `Install pool fence\nRGTools Lead ${created.leadId}`,
              status: 'Work Order',
            },
          ],
        }
      }

      expect(path).toBe('/job/job-uuid-1.json')
      expect(init?.method).toBe('POST')
      expect(JSON.parse(String(init?.body))).toMatchObject({
        'quality-field-uuid': 'Leads Quality B',
      })

      return {
        ok: true,
        status: 200,
        json: async () => ({ uuid: 'field-data-1' }),
      }
    })

    const firstResult = await fetchLeadFromServiceM8(created.leadId, actor.id, { request })
    const secondResult = await fetchLeadFromServiceM8(created.leadId, actor.id, { request })

    expect(firstResult).toMatchObject({
      ok: true,
      jobUuid: 'job-uuid-1',
      jobStatus: 'Work Order',
      leadsQuality: 'Leads Quality B',
      customFieldUpdated: true,
    })
    expect(secondResult).toMatchObject({
      ok: true,
      jobUuid: 'job-uuid-1',
      jobStatus: 'Work Order',
      leadsQuality: 'Leads Quality B',
      customFieldUpdated: false,
    })
    expect(request).toHaveBeenCalledTimes(3)

    const [lead] = await db
      .select({
        servicem8JobUuid: leads.servicem8JobUuid,
        servicem8Status: leads.servicem8Status,
      })
      .from(leads)
      .where(eq(leads.id, created.leadId))
      .limit(1)

    expect(lead).toEqual({
      servicem8JobUuid: 'job-uuid-1',
      servicem8Status: 'Work Order',
    })
  }, 30000)

  it('links a ServiceM8 job converted from an inbox message containing the lead reference', async () => {
    process.env.SERVICEM8_LEAD_QUALITY_FIELD = 'quality-field-uuid'

    const [actor] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, 'rgadmin'))
      .limit(1)

    const created = await submitLeadIntakeForUser(minimumInput(), actor.id)
    expect('success' in created).toBe(true)
    if (!('success' in created)) throw new Error(created.error)

    createdLeadIds.push(created.leadId)
    createdClientIds.push(created.clientId)

    await db
      .update(leads)
      .set({ tier: 'B', seedScore: 72, completeness: 80, servicem8JobUuid: null })
      .where(eq(leads.id, created.leadId))

    const request = vi.fn<ServiceM8FetchRequest>(async (path, init) => {
      if (path.startsWith('/job.json')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              uuid: 'wrong-job-uuid',
              job_description: 'No RGTools reference here',
              status: 'Quote',
            },
          ],
        }
      }

      if (path === '/inboxmessage.json?limit=500&offset=0&filter=all') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            messages: [
              {
                uuid: 'message-uuid-1',
                subject: 'RGTools Lead - Leads Quality B - Customer - shower',
                message_text: `--- Reference ---\nRGTools Lead ${created.leadId}`,
                converted_to_job_uuid: 'converted-job-uuid',
              },
            ],
          }),
        }
      }

      if (path === '/job/converted-job-uuid.json') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            uuid: 'converted-job-uuid',
            status: 'Quote',
            job_description: 'RGTools Lead - Leads Quality B - Customer - shower',
          }),
        }
      }

      expect(path).toBe('/job/converted-job-uuid.json')
      expect(init?.method).toBe('POST')
      expect(JSON.parse(String(init?.body))).toMatchObject({
        'quality-field-uuid': 'Leads Quality B',
      })

      return {
        ok: true,
        status: 200,
        json: async () => ({ uuid: 'field-data-1' }),
      }
    })

    const result = await fetchLeadFromServiceM8(created.leadId, actor.id, { request })

    expect(result).toMatchObject({
      ok: true,
      jobUuid: 'converted-job-uuid',
      jobStatus: 'Quote',
      leadsQuality: 'Leads Quality B',
      customFieldUpdated: true,
    })
  }, 30000)

  it('still links the ServiceM8 job when Leads Quality custom field update is forbidden', async () => {
    process.env.SERVICEM8_LEAD_QUALITY_FIELD = 'quality-field-uuid'

    const [actor] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, 'rgadmin'))
      .limit(1)

    const created = await submitLeadIntakeForUser(minimumInput(), actor.id)
    expect('success' in created).toBe(true)
    if (!('success' in created)) throw new Error(created.error)

    createdLeadIds.push(created.leadId)
    createdClientIds.push(created.clientId)

    await db
      .update(leads)
      .set({ tier: 'B', seedScore: 72, completeness: 80, servicem8JobUuid: null })
      .where(eq(leads.id, created.leadId))

    const request = vi.fn<ServiceM8FetchRequest>(async (path) => {
      if (path.startsWith('/job.json')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              uuid: 'job-uuid-403',
              job_description: `RGTools Lead ${created.leadId}`,
              status: 'Quote',
            },
          ],
        }
      }

      if (path === '/job/job-uuid-403.json') {
        return {
          ok: false,
          status: 403,
          json: async () => ({ message: 'Forbidden' }),
        }
      }

      throw new Error(`Unexpected ServiceM8 request path: ${path}`)
    })

    const result = await fetchLeadFromServiceM8(created.leadId, actor.id, { request })

    expect(result).toMatchObject({
      ok: true,
      jobUuid: 'job-uuid-403',
      jobStatus: 'Quote',
      leadsQuality: 'Leads Quality B',
      customFieldUpdated: false,
      customFieldError: 'ServiceM8 custom field update failed with HTTP 403',
    })

    const [lead] = await db
      .select({
        servicem8JobUuid: leads.servicem8JobUuid,
        servicem8Status: leads.servicem8Status,
      })
      .from(leads)
      .where(eq(leads.id, created.leadId))
      .limit(1)

    expect(lead).toEqual({
      servicem8JobUuid: 'job-uuid-403',
      servicem8Status: 'Quote',
    })
  }, 30000)
})
