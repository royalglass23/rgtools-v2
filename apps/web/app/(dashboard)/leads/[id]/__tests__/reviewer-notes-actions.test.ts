// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => vi.fn())
const userCanAccessSlugMock = vi.hoisted(() => vi.fn())
const getLeadDetailMock = vi.hoisted(() => vi.fn())
const getLeadReviewerNotesMock = vi.hoisted(() => vi.fn())
const createLeadReviewerNoteMock = vi.hoisted(() => vi.fn())
const logAuditMock = vi.hoisted(() => vi.fn())
const revalidatePathMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/access-db', () => ({ userCanAccessSlug: userCanAccessSlugMock }))
vi.mock('@/lib/audit-db', () => ({ logAudit: logAuditMock }))
vi.mock('@/modules/leads/queries', () => ({ getLeadDetail: getLeadDetailMock }))
vi.mock('@/modules/leads/reviewer-notes', () => ({
  createLeadReviewerNote: createLeadReviewerNoteMock,
  getLeadReviewerNotes: getLeadReviewerNotesMock,
}))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))

import { addReviewerNoteAction, getReviewerNotesAction } from '../reviewer-notes-actions'

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue({ user: { id: 'user-1' } })
  userCanAccessSlugMock.mockResolvedValue(true)
  getLeadDetailMock.mockResolvedValue({ id: 'lead-1' })
})

describe('reviewer note actions', () => {
  it('rejects users without leads access before listing or writing notes', async () => {
    userCanAccessSlugMock.mockResolvedValue(false)

    await expect(getReviewerNotesAction('lead-1')).resolves.toEqual({ error: 'Forbidden' })
    await expect(addReviewerNoteAction('lead-1', 'Do this next.')).resolves.toEqual({ error: 'Forbidden' })

    expect(getLeadReviewerNotesMock).not.toHaveBeenCalled()
    expect(createLeadReviewerNoteMock).not.toHaveBeenCalled()
  })

  it('lists reviewer notes for authorized users', async () => {
    getLeadReviewerNotesMock.mockResolvedValue([
      { id: 'note-1', authorName: 'rgadmin', text: 'Call tomorrow.', createdAt: '2026-07-03T01:00:00.000Z' },
    ])

    const result = await getReviewerNotesAction('lead-1')

    expect(result).toEqual({
      success: true,
      notes: [
        { id: 'note-1', authorName: 'rgadmin', text: 'Call tomorrow.', createdAt: '2026-07-03T01:00:00.000Z' },
      ],
    })
    expect(getLeadReviewerNotesMock).toHaveBeenCalledWith('lead-1')
  })

  it('rejects empty reviewer notes', async () => {
    const result = await addReviewerNoteAction('lead-1', '   ')

    expect(result).toEqual({ error: 'Reviewer note is required.' })
    expect(createLeadReviewerNoteMock).not.toHaveBeenCalled()
  })

  it('creates an attributed note, audit-logs it, and revalidates the lead detail page', async () => {
    createLeadReviewerNoteMock.mockResolvedValue({
      id: 'note-1',
      authorName: 'rgadmin',
      text: 'Call tomorrow.',
      createdAt: '2026-07-03T01:00:00.000Z',
    })

    const result = await addReviewerNoteAction('lead-1', '  Call tomorrow.  ')

    expect(result).toMatchObject({
      success: true,
      note: { id: 'note-1', authorName: 'rgadmin', text: 'Call tomorrow.' },
    })
    expect(createLeadReviewerNoteMock).toHaveBeenCalledWith({
      leadId: 'lead-1',
      authorId: 'user-1',
      text: 'Call tomorrow.',
    })
    expect(logAuditMock).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'user-1',
      entityType: 'lead',
      action: 'lead.reviewer_note_added',
      targetId: 'lead-1',
    }))
    expect(revalidatePathMock).toHaveBeenCalledWith('/leads/lead-1')
  })
})
