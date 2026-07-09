import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => vi.fn())
const getLeadDetailMock = vi.hoisted(() => vi.fn())
const userCanAccessSlugMock = vi.hoisted(() => vi.fn())
const getLeadReviewerNotesMock = vi.hoisted(() => vi.fn())
const getLatestLeadAiGuidanceMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/access-db', () => ({ userCanAccessSlug: userCanAccessSlugMock }))
vi.mock('@/modules/leads/queries', () => ({ getLeadDetail: getLeadDetailMock }))
vi.mock('@/modules/leads/reviewer-notes', () => ({ getLeadReviewerNotes: getLeadReviewerNotesMock }))
vi.mock('@/modules/leads/ServiceM8FetchButton', () => ({ ServiceM8FetchButton: () => <div data-testid="sm8-fetch" /> }))
vi.mock('@/modules/leads/DeleteLeadButton', () => ({ DeleteLeadButton: () => <button type="button">Delete</button> }))
vi.mock('@/modules/leads/LeadAiGuidancePanel', () => ({ LeadAiGuidancePanel: () => <div data-testid="ai-guidance" /> }))
vi.mock('@/modules/leads/ReviewerNotesSection', () => ({ ReviewerNotesSection: () => <div data-testid="reviewer-notes" /> }))
vi.mock('@/modules/leads/ai-guidance', () => ({ getLatestLeadAiGuidance: getLatestLeadAiGuidanceMock }))
vi.mock('../actions', () => ({
  deleteLeadAction: vi.fn(),
  generateLeadGuidanceAction: vi.fn(),
}))
vi.mock('../reviewer-notes-actions', () => ({
  addReviewerNoteAction: vi.fn(),
}))
vi.mock('next/navigation', () => ({ notFound: vi.fn() }))

import LeadDetailPage from '../page'

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue({ user: { id: 'user-1', role: 'staff' } })
  userCanAccessSlugMock.mockResolvedValue(true)
  getLeadReviewerNotesMock.mockResolvedValue([])
  getLatestLeadAiGuidanceMock.mockResolvedValue({
    conversationSnapshot: null,
    aiSuggestion: null,
    generationFailure: null,
  })
  getLeadDetailMock.mockResolvedValue({
    id: 'lead-1',
    clientName: 'Aroha Smith',
    companyName: null,
    servicem8JobNumber: null,
    tier: 'E',
    product: 'Pool fence',
    projectType: 'Pool fence',
    location: '12 Queen Street',
    email: 'aroha@example.com',
    phone: '021 333 444',
    channel: 'phone',
    source: 'existing_client_referral_repeat_builder_architect',
    freeText: 'Needs a pool fence before handover.',
    followUpDate: '2026-07-10',
    updatedAt: new Date('2026-07-03T00:00:00.000Z'),
    scoredFields: [
      { category: 1, label: 'Client Type', answer: 'Homeowner', points: 0 },
      { category: 10, label: 'Building Stage', answer: 'Ready for Glazing', points: 0 },
    ],
    seedScore: 12,
    completeness: 25,
    strikeFlag: null,
    scoreReason: 'Tier E (12): nurture',
    aiSuggestion: null,
    aiSuggestionAt: null,
    servicem8JobUuid: null,
    servicem8Status: null,
  })
})

describe('LeadDetailPage compatibility fields', () => {
  it('renders Tier E, Job Description, Channel, Source, matrix answers, completeness, and follow-up date', async () => {
    render(await LeadDetailPage({
      params: Promise.resolve({ id: 'lead-1' }),
      searchParams: Promise.resolve({}),
    }))

    expect(screen.getAllByText('E').length).toBeGreaterThan(0)
    expect(screen.getByText('Job Description')).toBeInTheDocument()
    expect(screen.getByText('Needs a pool fence before handover.')).toBeInTheDocument()
    expect(screen.getByText('Channel')).toBeInTheDocument()
    expect(screen.getAllByText('Phone').length).toBeGreaterThan(0)
    expect(screen.getByText('Source')).toBeInTheDocument()
    expect(screen.getByText('Existing Client Referral Repeat Builder Architect')).toBeInTheDocument()
    expect(screen.getByText('Building Stage')).toBeInTheDocument()
    expect(screen.getByText('Ready for Glazing')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
    expect(screen.getByText('10 Jul 2026')).toBeInTheDocument()
    expect(screen.getByTestId('ai-guidance')).toBeInTheDocument()
  })
})
