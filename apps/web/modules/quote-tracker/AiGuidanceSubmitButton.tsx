'use client'

import { useFormStatus } from 'react-dom'

const DEFAULT_PENDING_LABELS = [
  'Reading ServiceM8 history',
  'Summarising notes and emails',
  'Reading quote engagement',
  'Generating next viable move',
  'Saving AI Guidance',
]

export function AiGuidanceSubmitButton({
  label,
  pendingLabels = DEFAULT_PENDING_LABELS,
}: {
  label: string
  pendingLabels?: string[]
}) {
  const { pending } = useFormStatus()

  return (
    <div className="space-y-1">
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-green-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        {pending ? 'Generating' : label}
      </button>
      {pending && (
        <ul aria-live="polite" className="space-y-0.5 text-xs text-gray-600">
          {pendingLabels.map((pendingLabel) => (
            <li key={pendingLabel}>{pendingLabel}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
