'use client'

import { useState, useTransition } from 'react'

type FetchResult =
  | {
      ok: true
      jobUuid: string
      jobStatus: string | null
      leadsQuality: string
      customFieldUpdated: boolean
    }
  | {
      ok: false
      reason: string
      message: string
    }

export function ServiceM8FetchButton({
  leadId,
  initialJobUuid,
  initialJobStatus,
  initialLeadsQuality,
}: {
  leadId: string
  initialJobUuid: string | null
  initialJobStatus: string | null
  initialLeadsQuality: string
}) {
  const [jobUuid, setJobUuid] = useState(initialJobUuid)
  const [jobStatus, setJobStatus] = useState(initialJobStatus)
  const [leadsQuality, setLeadsQuality] = useState(initialLeadsQuality)
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
      setJobStatus(result.jobStatus)
      setLeadsQuality(result.leadsQuality)
      setMessage(result.customFieldUpdated ? 'ServiceM8 job linked and Leads Quality set.' : 'ServiceM8 job details refreshed.')
    })
  }

  return (
    <div className="space-y-4">
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <Field label="Leads Quality" value={leadsQuality || 'Not set'} />
        <Field label="Job UUID" value={jobUuid || 'Not linked'} />
        <Field label="Job Status" value={jobStatus || '-'} />
      </dl>
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
