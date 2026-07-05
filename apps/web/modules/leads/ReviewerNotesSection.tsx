'use client'

import { useState, useTransition, type FormEvent } from 'react'
import type { ReviewerNoteActionResult } from '@/app/(dashboard)/leads/[id]/reviewer-notes-actions'

export type ReviewerNoteView = {
  id: string
  authorName: string
  text: string
  createdAt: string | Date
}

type AddNoteAction = (leadId: string, text: string) => Promise<ReviewerNoteActionResult>

export function ReviewerNotesSection({
  leadId,
  initialNotes,
  addNoteAction,
}: {
  leadId: string
  initialNotes: ReviewerNoteView[]
  addNoteAction: AddNoteAction
}) {
  const [notes, setNotes] = useState<ReviewerNoteView[]>(initialNotes)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await addNoteAction(leadId, text)
      if ('error' in result) {
        setError(result.error)
        return
      }

      setNotes((current) => [...current, result.note])
      setText('')
      setError(null)
    })
  }

  return (
    <div className="space-y-4">
      {notes.length === 0 ? (
        <p className="rounded border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-sm text-gray-500">
          No reviewer notes yet.
        </p>
      ) : (
        <ol className="space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                <span className="font-semibold text-gray-800">{note.authorName}</span>
                <time dateTime={new Date(note.createdAt).toISOString()}>
                  {formatDateTime(note.createdAt)}
                </time>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-900">{note.text}</p>
            </li>
          ))}
        </ol>
      )}

      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        <label className="block text-sm font-medium text-gray-700">
          Add reviewer note
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            placeholder="What should the team do next?"
          />
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center justify-center rounded bg-gray-950 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isPending ? 'Adding...' : 'Add note'}
          </button>
          {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
        </div>
      </form>
    </div>
  )
}

function formatDateTime(date: string | Date) {
  return new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date))
}
