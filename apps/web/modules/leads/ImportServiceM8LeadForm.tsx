'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { ImportServiceM8LeadActionResult } from '@/app/(dashboard)/leads/actions'

export function ImportServiceM8LeadForm({
  action,
}: {
  action: (jobNumber: string) => Promise<ImportServiceM8LeadActionResult>
}) {
  const router = useRouter()
  const [jobNumber, setJobNumber] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = jobNumber.trim().toUpperCase()
    if (!normalized) {
      setErrorMessage('Enter a ServiceM8 job number.')
      return
    }

    setErrorMessage(null)
    startTransition(async () => {
      const result = await action(normalized)
      if (!result.ok) {
        setErrorMessage(result.message)
        return
      }

      router.push(result.redirectPath)
    })
  }

  return (
    <>
      <form onSubmit={submit} className="flex items-end gap-2">
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Import from ServiceM8</span>
          <input
            value={jobNumber}
            onChange={(event) => setJobNumber(event.target.value)}
            placeholder="Job number"
            className="mt-1 h-10 w-40 rounded border border-gray-300 bg-white px-3 text-sm text-gray-950"
          />
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="h-10 rounded border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? 'Importing...' : 'Import'}
        </button>
      </form>

      {errorMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-servicem8-error-title"
            className="w-full max-w-md rounded border border-gray-200 bg-white p-5 shadow-xl"
          >
            <h2 id="import-servicem8-error-title" className="text-base font-semibold text-gray-950">Import from ServiceM8</h2>
            <p className="mt-3 text-sm leading-6 text-gray-700">{errorMessage}</p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="rounded bg-[#142B3A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d3d52]"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
