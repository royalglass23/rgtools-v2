'use client'

import { FormEvent, useMemo, useState, useTransition } from 'react'

import { PlacesAutocomplete } from '@/modules/lead-intake/PlacesAutocomplete'

import type { PublishedPsConfiguration } from './configuration'
import type { PsGenerationMode } from './generation'

type LookupJobResult =
  | { found: true; clientName: string; jobAddress: string }
  | { found: false; message?: string }

interface GeneratePsFormProps {
  configuration: PublishedPsConfiguration
  lookupJob?: (jobNumber: string) => Promise<LookupJobResult>
}

interface GeneratedOutput {
  documentKind: 'ps1' | 'ps3'
  filename: string
  contentType: string
  base64: string
}

const DEFAULT_SELECTIONS: Record<string, string> = {
  system: 'double-disc',
  structure_material: 'timber',
  structure_type: 'deck',
  location: 'external',
  structure_built: 'new',
  glass_type: 'toughened',
  thickness: '12mm',
  gate_required: 'no',
}

const MODE_OPTIONS: Array<{ value: PsGenerationMode; label: string; body: string }> = [
  { value: 'ps1_only', label: 'PS1 only', body: 'Prepare only the PS1 package.' },
  { value: 'ps3_only', label: 'PS3 only', body: 'Prepare only the PS3 package.' },
  { value: 'both', label: 'PS1 + PS3', body: 'Prepare separate PS1 and PS3 packages.' },
]

export function GeneratePsForm({ configuration, lookupJob }: GeneratePsFormProps) {
  const [mode, setMode] = useState<PsGenerationMode>('ps1_only')
  const [projectDetails, setProjectDetails] = useState({
    jobNumber: '',
    clientName: '',
    jobAddress: '',
    bcNumber: '',
    lotDescription: '',
  })
  const [selections, setSelections] = useState<Record<string, string>>(() => defaultsForConfiguration(configuration))
  const [outputs, setOutputs] = useState<GeneratedOutput[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const selectedSystem = useMemo(() => (
    configuration.systems.find((system) => system.slug === selections.system) ?? configuration.systems[0]
  ), [configuration.systems, selections.system])

  function setProjectField(field: keyof typeof projectDetails, value: string) {
    setProjectDetails((current) => ({ ...current, [field]: value }))
  }

  function setSelection(categorySlug: string, value: string) {
    setSelections((current) => normalizeSelectionsForSystem({
      ...current,
      [categorySlug]: value,
    }, configuration, categorySlug === 'system' ? value : current.system))
  }

  function handleLookupJob() {
    const normalized = projectDetails.jobNumber.trim().toUpperCase()
    setProjectField('jobNumber', normalized)
    if (!normalized || !lookupJob) return

    startTransition(async () => {
      const result = await lookupJob(normalized)
      if (!result.found) {
        setMessage(result.message ?? `No job found for ${normalized}. You can keep entering details manually.`)
        return
      }

      setProjectDetails((current) => ({
        ...current,
        jobNumber: normalized,
        clientName: result.clientName,
        jobAddress: result.jobAddress,
      }))
      setMessage(`Loaded job ${normalized}.`)
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setOutputs([])

    const response = await fetch('/api/ps-generator/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mode,
        projectDetails,
        selections,
      }),
    })
    const body = await response.json()
    if (!response.ok || body.ok === false) {
      setMessage(body.error?.message ?? body.error ?? 'Unable to generate Producer Statement PDFs.')
      return
    }

    setOutputs(body.outputs ?? [])
    setMessage(`Generated ${body.outputs?.length ?? 0} document${body.outputs?.length === 1 ? '' : 's'}.`)
  }

  if (!configuration.versionLabel || configuration.systems.length === 0) {
    return (
      <div className="mx-auto max-w-6xl rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        No published PS Generator configuration is available.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-950">Generate PS</h1>
          <p className="mt-1 text-sm text-gray-500">Create PS1 and PS3 producer statement packages from the published configuration.</p>
        </div>
        <div className="rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600">
          Published config: <span className="font-medium text-gray-950">{configuration.versionLabel}</span>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-3" aria-label="Generation mode">
        {MODE_OPTIONS.map((option) => (
          <label key={option.value} className="rounded border border-gray-200 bg-white p-4 shadow-sm">
            <span className="flex items-center gap-2 text-sm font-semibold text-gray-950">
              <input
                type="radio"
                name="mode"
                value={option.value}
                aria-label={option.label}
                checked={mode === option.value}
                onChange={() => setMode(option.value)}
                className="h-4 w-4"
              />
              {option.label}
            </span>
            <span className="mt-2 block text-sm text-gray-600">{option.body}</span>
          </label>
        ))}
      </section>

      <section className="rounded border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-950">Project details</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">
            Job number
            <div className="mt-1 flex gap-2">
              <input
                value={projectDetails.jobNumber}
                onChange={(event) => setProjectField('jobNumber', event.target.value)}
                className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={handleLookupJob}
                disabled={isPending || !lookupJob}
                className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                Find job
              </button>
            </div>
          </label>
          <TextInput label="Client name" value={projectDetails.clientName} onChange={(value) => setProjectField('clientName', value)} required />
          <PlacesAutocomplete
            label="Job address"
            value={projectDetails.jobAddress}
            onChange={(address) => setProjectField('jobAddress', address)}
            required
            updateOnInput
          />
          <TextInput label="BC number" value={projectDetails.bcNumber} onChange={(value) => setProjectField('bcNumber', value)} />
          <TextInput label="Lot description" value={projectDetails.lotDescription} onChange={(value) => setProjectField('lotDescription', value)} />
        </div>
      </section>

      <section className="rounded border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-950">Configuration choices</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField
            label="System"
            value={selections.system}
            options={configuration.systems.map((system) => ({ slug: system.slug, label: system.displayName }))}
            onChange={(value) => setSelection('system', value)}
          />
          {configuration.optionCategories
            .filter((category) => category.slug !== 'system')
            .map((category) => (
              <SelectField
                key={category.slug}
                label={category.label}
                value={selections[category.slug] ?? ''}
                options={selectedSystem?.optionRules[category.slug] ?? []}
                onChange={(value) => setSelection(category.slug, value)}
              />
            ))}
        </div>
      </section>

      {message ? (
        <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900" role="status">
          {message}
        </div>
      ) : null}

      {outputs.length > 0 ? (
        <section className="rounded border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-950">Generated documents</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {outputs.map((output) => (
              <a
                key={`${output.documentKind}:${output.filename}`}
                href={`data:${output.contentType};base64,${output.base64}`}
                download={output.filename}
                className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white"
              >
                Download {output.documentKind.toUpperCase()}
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <div className="flex justify-end">
        <button type="submit" className="rounded bg-gray-950 px-4 py-2 text-sm font-semibold text-white">
          Generate PS
        </button>
      </div>
    </form>
  )
}

function TextInput({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
}) {
  return (
    <label className="text-sm font-medium text-gray-700">
      <span className="flex items-center gap-2">
        {label}
        {required ? <span aria-hidden="true" className="text-red-600">*</span> : null}
      </span>
      <input
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
      />
    </label>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<{ slug: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <label className="text-sm font-medium text-gray-700">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
      >
        {options.map((option) => (
          <option key={option.slug} value={option.slug}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

function defaultsForConfiguration(configuration: PublishedPsConfiguration): Record<string, string> {
  return normalizeSelectionsForSystem(DEFAULT_SELECTIONS, configuration, DEFAULT_SELECTIONS.system)
}

function normalizeSelectionsForSystem(
  selections: Record<string, string>,
  configuration: PublishedPsConfiguration,
  systemSlug: string,
) {
  const system = configuration.systems.find((candidate) => candidate.slug === systemSlug) ?? configuration.systems[0]
  if (!system) return selections

  const next: Record<string, string> = { ...selections, system: system.slug }
  for (const category of configuration.optionCategories) {
    const values = category.slug === 'system'
      ? configuration.systems.map((candidate) => ({ slug: candidate.slug }))
      : system.optionRules[category.slug] ?? []
    if (!values.some((value) => value.slug === next[category.slug])) {
      next[category.slug] = values[0]?.slug ?? ''
    }
  }

  return next
}
