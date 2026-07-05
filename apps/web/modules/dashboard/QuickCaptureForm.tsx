'use client'

import Link from 'next/link'
import { useRef, useState, useTransition, type FormEvent } from 'react'
import { submitQuickCaptureLead } from './quick-capture-actions'
import type { LeadIntakeResult } from '@/modules/lead-intake/actions'

type BuildingStageOption = {
  key: string
  label: string
}

export function QuickCaptureForm({
  buildingStageOptions,
}: {
  buildingStageOptions: BuildingStageOption[]
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [result, setResult] = useState<LeadIntakeResult | null>(null)
  const [isPending, startTransition] = useTransition()
  const successfulResult = result && 'success' in result ? result : null

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const nextResult = await submitQuickCaptureLead(formData)
      setResult(nextResult)
      if ('success' in nextResult) formRef.current?.reset()
    })
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Quick Capture</h2>
          <p className="text-sm text-gray-500">Log the first call and continue qualification later.</p>
        </div>
        {successfulResult && (
          <Link
            href={`/lead-intake?leadId=${successfulResult.leadId}`}
            className="text-sm font-medium text-blue-700 hover:text-blue-900"
          >
            Continue full intake
          </Link>
        )}
      </div>

      <form
        ref={formRef}
        onSubmit={onSubmit}
        noValidate
        className="rounded border border-gray-200 bg-white p-4"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <TextField name="clientName" label="Client name" required />
          <TextField name="phone" label="Phone" type="tel" required />
          <TextField name="email" label="Email" type="email" required />
          <div className="md:col-span-2">
            <TextField name="location" label="Job address" required />
          </div>
          <label className="block text-sm font-medium text-gray-700">
            Building Stage
            <select
              name="buildingStage"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              defaultValue=""
            >
              <option value="">Select stage</option>
              {buildingStageOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700">
              Job Description
              <input
                name="jobDescription"
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="One sentence from the call"
              />
            </label>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center justify-center rounded bg-gray-950 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isPending ? 'Capturing...' : 'Capture lead'}
          </button>
          {result && 'error' in result && (
            <p role="alert" className="text-sm font-medium text-red-700">
              {result.error}
            </p>
          )}
          {result && 'success' in result && (
            <p className="text-sm text-gray-700">
              Created lead. <span className="font-semibold text-gray-950">Tier {result.tier}</span> - {result.completeness}% complete.
            </p>
          )}
        </div>
      </form>
    </section>
  )
}

function TextField({
  name,
  label,
  type = 'text',
  required = false,
}: {
  name: string
  label: string
  type?: string
  required?: boolean
}) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}{required ? <RequiredMark /> : null}
      <input
        name={name}
        type={type}
        required={required}
        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
      />
    </label>
  )
}

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-red-600">
      {' '}
      *
    </span>
  )
}
