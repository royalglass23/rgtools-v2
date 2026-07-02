'use client'

import { useFormStatus } from 'react-dom'

const DEFAULT_PENDING_LABELS = [
  'Reading ServiceM8 history',
  'Summarising notes and emails',
  'Reading quote engagement',
  'Generating next viable move',
  'Saving AI Guidance',
]
const PENDING_NOTICE = 'This can take a few minutes. If AI takes longer than 5 minutes, we will stop it and show a retry message.'

export function AiGuidanceSubmitButton({
  label,
  pendingLabels = DEFAULT_PENDING_LABELS,
}: {
  label: string
  pendingLabels?: string[]
}) {
  const { pending } = useFormStatus()

  return (
    <div className="space-y-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-green-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-green-800 disabled:cursor-wait disabled:bg-green-900 disabled:text-white"
      >
        {pending ? 'Generating AI Guidance' : label}
      </button>
      {pending && (
        <div
          aria-live="polite"
          className="max-w-md rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
        >
          <p className="font-medium">AI Guidance is working in the background.</p>
          <p className="mt-1">{PENDING_NOTICE}</p>
          <ul className="mt-2 space-y-0.5 text-amber-800">
            {pendingLabels.map((pendingLabel) => (
              <li key={pendingLabel}>{pendingLabel}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
