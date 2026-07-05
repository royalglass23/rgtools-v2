import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReviewerNotesSection, type ReviewerNoteView } from '../ReviewerNotesSection'

const addNoteMock = vi.hoisted(() => vi.fn())

const notes: ReviewerNoteView[] = [
  {
    id: 'note-1',
    authorName: 'rgadmin',
    text: 'Call first thing tomorrow.',
    createdAt: '2026-07-03T01:00:00.000Z',
  },
  {
    id: 'note-2',
    authorName: 'sales',
    text: 'Ask for consent drawings.',
    createdAt: '2026-07-03T02:00:00.000Z',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ReviewerNotesSection', () => {
  it('renders an empty state when no reviewer notes exist', () => {
    render(<ReviewerNotesSection leadId="lead-1" initialNotes={[]} addNoteAction={addNoteMock} />)

    expect(screen.getByText('No reviewer notes yet.')).toBeInTheDocument()
  })

  it('renders reviewer notes with author, timestamp, and text', () => {
    render(<ReviewerNotesSection leadId="lead-1" initialNotes={notes} addNoteAction={addNoteMock} />)

    expect(screen.getByText('rgadmin')).toBeInTheDocument()
    expect(screen.getByText('sales')).toBeInTheDocument()
    expect(screen.getByText('Call first thing tomorrow.')).toBeInTheDocument()
    expect(screen.getByText('Ask for consent drawings.')).toBeInTheDocument()
    expect(screen.getAllByText(/2026/)).toHaveLength(2)
  })

  it('adds a note to the list after a successful submit', async () => {
    addNoteMock.mockResolvedValue({
      success: true,
      note: {
        id: 'note-3',
        authorName: 'rgadmin',
        text: 'Prioritise this lead.',
        createdAt: '2026-07-03T03:00:00.000Z',
      },
    })

    render(<ReviewerNotesSection leadId="lead-1" initialNotes={[]} addNoteAction={addNoteMock} />)

    fireEvent.change(screen.getByLabelText(/Add reviewer note/), {
      target: { value: 'Prioritise this lead.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Add note/ }))

    await waitFor(() => {
      expect(addNoteMock).toHaveBeenCalledWith('lead-1', 'Prioritise this lead.')
    })
    expect(screen.getByText('Prioritise this lead.')).toBeInTheDocument()
    expect(screen.queryByText('No reviewer notes yet.')).not.toBeInTheDocument()
  })
})
