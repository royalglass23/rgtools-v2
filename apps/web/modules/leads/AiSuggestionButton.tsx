'use client'

import { useState, useTransition } from 'react'

type SuggestionResult = { text: string } | { error: string }

export function AiSuggestionButton({
  leadId,
  initialSuggestion,
  initialGeneratedAt,
  action,
  disabledReason,
}: {
  leadId: string
  initialSuggestion: string | null
  initialGeneratedAt: Date | string | null
  action: (leadId: string) => Promise<SuggestionResult>
  disabledReason?: string
}) {
  const [suggestion, setSuggestion] = useState(initialSuggestion)
  const [generatedAt, setGeneratedAt] = useState<Date | string | null>(initialGeneratedAt)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function generate() {
    setMessage(null)

    startTransition(async () => {
      const result = await action(leadId)
      if ('error' in result) {
        setMessage(result.error)
        return
      }

      setSuggestion(result.text)
      setGeneratedAt(new Date())
      setMessage('Suggestion generated.')
    })
  }

  return (
    <div className="space-y-4">
      {suggestion ? (
        <div className="rounded border border-gray-200 bg-gray-50 p-4">
          <p className="whitespace-pre-wrap text-sm leading-6 text-gray-950">{suggestion}</p>
          {generatedAt && <p className="mt-3 text-xs text-gray-500">Generated {formatDateTime(generatedAt)}</p>}
        </div>
      ) : (
        <p className="text-sm text-gray-600">No suggestion generated yet.</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={generate}
          disabled={isPending || Boolean(disabledReason)}
          className="rounded bg-[#142B3A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1d3d52] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? 'Generating...' : suggestion ? 'Refresh' : 'Get suggestion'}
        </button>
        {disabledReason && <span className="text-sm text-gray-600">{disabledReason}</span>}
        {message && (
          <span className={`text-sm ${message.includes('not configured') || message.includes('Could not') ? 'text-red-700' : 'text-gray-600'}`}>
            {message}
          </span>
        )}
      </div>
    </div>
  )
}

function formatDateTime(date: Date | string) {
  return new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date))
}
