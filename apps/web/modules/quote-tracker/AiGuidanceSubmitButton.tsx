'use client'

import { useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'

export function AiGuidanceSubmitButton({
  label,
  disabledUntil,
}: {
  label: string
  disabledUntil?: Date | null
}) {
  const { pending } = useFormStatus()
  const [now, setNow] = useState(() => Date.now())
  const disabledUntilTime = disabledUntil?.getTime() ?? 0
  const coolingDown = disabledUntilTime > now
  const disabled = pending || coolingDown
  const remainingMinutes = Math.max(1, Math.ceil((disabledUntilTime - now) / 60_000))
  const buttonLabel = coolingDown ? `${label} in ${remainingMinutes} min` : label

  useEffect(() => {
    if (!coolingDown) return undefined
    const timeout = window.setTimeout(() => setNow(Date.now()), Math.min(Math.max(disabledUntilTime - now, 0), 60_000))
    return () => window.clearTimeout(timeout)
  }, [coolingDown, disabledUntilTime, now])

  return (
    <div className="space-y-2">
      <button
        type="submit"
        disabled={disabled}
        className="rounded bg-green-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-green-800 disabled:cursor-default disabled:bg-green-900 disabled:text-white"
      >
        {buttonLabel}
      </button>
      {pending && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
        >
          <div className="flex items-center gap-3 rounded bg-white px-5 py-4 text-sm font-medium text-gray-950 shadow-lg">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-green-700" />
            <span>Generating information</span>
          </div>
        </div>
      )}
    </div>
  )
}
