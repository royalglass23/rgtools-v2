'use client'

import { useState, useTransition } from 'react'

type FetchResult =
  | {
      ok: true
      jobUuid: string
      jobNumber: string | null
      jobStatus: string | null
      leadsQuality: string
      customFieldUpdated: boolean
      customFieldError?: string
    }
  | {
      ok: false
      reason: string
      message: string
    }

type LinkResult =
  | {
      ok: true
      jobUuid: string
      jobNumber: string
      jobStatus: string | null
      message: string
    }
  | {
      ok: false
      reason: string
      message: string
    }

export function ServiceM8FetchButton({
  leadId,
  initialJobUuid,
  initialJobNumber,
  initialJobStatus,
  initialLeadsQuality,
}: {
  leadId: string
  initialJobUuid: string | null
  initialJobNumber: string | null
  initialJobStatus: string | null
  initialLeadsQuality: string
}) {
  const [jobUuid, setJobUuid] = useState(initialJobUuid)
  const [jobNumber, setJobNumber] = useState(initialJobNumber)
  const [jobStatus, setJobStatus] = useState(initialJobStatus)
  const [leadsQuality, setLeadsQuality] = useState(initialLeadsQuality)
  const [jobNumberInput, setJobNumberInput] = useState('')
  const [isRelinking, setIsRelinking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function fetchFromServiceM8() {
    setMessage(null)

    startTransition(async () => {
      const response = await fetch(`/api/leads/${leadId}/servicem8-fetch`, { method: 'POST' })
      const result = await response.json() as FetchResult

      if (!response.ok || !result.ok) {
        setMessage('message' in result ? result.message : 'ServiceM8 fetch failed')
        return
      }

      setJobUuid(result.jobUuid)
      setJobNumber(result.jobNumber)
      setJobStatus(result.jobStatus)
      setLeadsQuality(result.leadsQuality)
      setMessage(
        result.customFieldError
          ? `ServiceM8 job linked, but job-card fields were not fully imported: ${result.customFieldError}`
          : result.customFieldUpdated
            ? 'ServiceM8 job linked and job-card fields imported.'
            : 'ServiceM8 job details refreshed.',
      )
    })
  }

  function linkByJobNumber() {
    const normalized = jobNumberInput.trim().toUpperCase()
    if (!normalized) {
      setMessage('Enter a ServiceM8 job number.')
      return
    }

    if (jobUuid) {
      const current = jobNumber || jobUuid
      const confirmed = window.confirm(`Re-link this lead from ${current} to ${normalized}?`)
      if (!confirmed) return
    }

    setMessage(null)

    startTransition(async () => {
      const response = await fetch(`/api/leads/${leadId}/servicem8-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobNumber: normalized }),
      })
      const result = await response.json() as LinkResult

      if (!response.ok || !result.ok) {
        setMessage('message' in result ? result.message : 'ServiceM8 link failed')
        return
      }

      setJobUuid(result.jobUuid)
      setJobNumber(result.jobNumber)
      setJobStatus(result.jobStatus)
      setJobNumberInput('')
      setIsRelinking(false)
      setMessage(result.message)
    })
  }

  const showManualLink = !jobUuid || isRelinking

  return (
    <div className="space-y-4">
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <Field label="Leads Quality" value={leadsQuality || 'Not set'} />
        <Field label="Job Number" value={jobNumber || 'Not linked'} />
        <Field label="Job UUID" value={jobUuid || 'Not linked'} />
        <Field label="Job Status" value={jobStatus || '-'} />
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={fetchFromServiceM8}
            disabled={isPending}
            className="rounded bg-[#142B3A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1d3d52] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Fetching...' : 'Fetch from ServiceM8'}
          </button>
          {message && <span className="text-sm text-gray-600">{message}</span>}
        </div>
        {showManualLink ? (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <span className="whitespace-nowrap text-xs uppercase tracking-wide text-gray-500">Job #</span>
              <input
                value={jobNumberInput}
                onChange={(event) => setJobNumberInput(event.target.value)}
                placeholder="Q253011"
                className="h-9 w-32 rounded border border-gray-300 px-2 text-sm text-gray-950 shadow-sm focus:border-[#142B3A] focus:outline-none focus:ring-1 focus:ring-[#142B3A]"
              />
            </label>
            <button
              type="button"
              onClick={linkByJobNumber}
              disabled={isPending}
              className="rounded bg-[#142B3A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1d3d52] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? 'Linking...' : jobUuid ? 'Re-link job' : 'Link by number'}
            </button>
            {isRelinking && (
              <button
                type="button"
                onClick={() => {
                  setIsRelinking(false)
                  setJobNumberInput('')
                }}
                className="px-2 py-2 text-sm font-medium text-gray-500 hover:text-gray-900"
              >
                Cancel
              </button>
            )}
          </div>
        ) : jobUuid ? (
          <div className="ml-auto flex items-center justify-end">
            <button
              type="button"
              onClick={() => setIsRelinking(true)}
              className="text-sm font-medium text-gray-500 hover:text-gray-900"
            >
              Wrong job? Re-link
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-1 break-words text-gray-950">{value}</dd>
    </div>
  )
}
