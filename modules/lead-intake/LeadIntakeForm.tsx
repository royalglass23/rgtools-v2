'use client'

import { useState, useTransition } from 'react'
import type { ActiveScoringOptionLists, FormOption } from '@/modules/lead-intake/scoring/config-options'
import { submitLeadIntake, type LeadIntakeInput, type LeadIntakeResult } from './actions'
import { PlacesAutocomplete } from './PlacesAutocomplete'
import { ScorePanel } from './ScorePanel'

const PROJECT_TYPES = [
  { key: 'pool_fence', label: 'Pool fence' },
  { key: 'balustrade', label: 'Balustrade' },
  { key: 'shower', label: 'Shower' },
  { key: 'handrail', label: 'Handrail' },
  { key: 'other', label: 'Other' },
]

const SOURCES: Array<{ key: LeadIntakeInput['source']; label: string }> = [
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'wechat', label: 'WeChat' },
  { key: 'calculator', label: 'Calculator' },
  { key: 'contact_form', label: 'Contact form' },
  { key: 'other', label: 'Other' },
]

const initialState: LeadIntakeInput = {
  clientName: '',
  companyName: '',
  phone: '',
  email: '',
  clientProfileKey: '',
  projectType: '',
  location: '',
  suburb: '',
  cat4: '',
  consentStatus: '',
  budgetBand: '',
  decisionMakers: '',
  priceSensitivityRead: '',
  source: 'phone',
  freeText: '',
}

export function LeadIntakeForm({
  optionLists,
  initialInput,
}: {
  optionLists: ActiveScoringOptionLists
  initialInput?: LeadIntakeInput
}) {
  const [input, setInput] = useState<LeadIntakeInput>(initialInput ?? initialState)
  const [result, setResult] = useState<LeadIntakeResult | null>(null)
  const [isPending, startTransition] = useTransition()

  function update<K extends keyof LeadIntakeInput>(key: K, value: LeadIntakeInput[K]) {
    setInput((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit() {
    setResult(null)

    startTransition(async () => {
      const nextResult = await submitLeadIntake(input)
      setResult(nextResult)
      if ('success' in nextResult && !input.leadId) setInput(initialState)
    })
  }

  return (
    <>
      <ScorePanel input={input} config={optionLists.config} />

      <div className="space-y-5 rounded border border-gray-200 bg-white p-5 shadow-sm">
        {result && 'error' in result && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {result.error}
          </div>
        )}
        {result && 'success' in result && (
          <div className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <div className="font-medium">Tier {result.tier} · {result.score} points</div>
            <div className="mt-1">{result.reason}</div>
            <div className="mt-1 text-xs text-green-700">
              Lead {result.leadId} · {input.leadId ? 'updated existing lead' : result.matchedExistingClient ? 'matched existing client' : 'created new client'}
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Client Name/Business Name" required value={input.clientName} onChange={(value) => update('clientName', value)} />
          <TextField label="Phone" required value={input.phone ?? ''} onChange={(value) => update('phone', value)} />
          <TextField label="Email" type="email" required value={input.email ?? ''} onChange={(value) => update('email', value)} />
          <PlacesAutocomplete
            value={input.location}
            onChange={(address, suburb) => {
              update('location', address)
              update('suburb', suburb)
            }}
          />
          <SelectField
            label="Project type"
            required
            value={input.projectType}
            options={PROJECT_TYPES}
            onChange={(value) => update('projectType', value)}
          />
          <SelectField
            label="Client type"
            value={input.clientProfileKey}
            options={optionLists.categories['1']?.options ?? []}
            onChange={(value) => update('clientProfileKey', value)}
          />
          <SelectField
            label="Budget band"
            value={input.budgetBand ?? ''}
            options={optionLists.categories['2']?.options ?? []}
            onChange={(value) => update('budgetBand', value)}
          />
          <SelectField
            label="Consent status"
            value={input.consentStatus ?? ''}
            options={optionLists.categories['3']?.options ?? []}
            onChange={(value) => update('consentStatus', value)}
          />
          <SelectField
            label="Distance / complexity"
            value={input.cat4 ?? ''}
            options={optionLists.categories['4']?.options ?? []}
            onChange={(value) => update('cat4', value)}
          />
          <SelectField
            label="Price-sensitivity read"
            value={input.priceSensitivityRead ?? ''}
            options={optionLists.categories['5']?.options ?? []}
            onChange={(value) => update('priceSensitivityRead', value)}
          />
          <SelectField
            label="Decision-makers"
            value={input.decisionMakers ?? ''}
            options={optionLists.categories['6']?.options ?? []}
            onChange={(value) => update('decisionMakers', value)}
          />
          <SelectField
            label="Source"
            required
            value={input.source}
            options={SOURCES}
            onChange={(value) => update('source', value as LeadIntakeInput['source'])}
          />
        </div>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Anything else</span>
          <textarea
            value={input.freeText ?? ''}
            onChange={(event) => update('freeText', event.target.value)}
            className="mt-1 min-h-24 w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-950 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded bg-[#142B3A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1d3d52] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Saving...' : 'Save and score'}
          </button>
        </div>
      </div>
    </>
  )
}

function TextField({
  label,
  value,
  onChange,
  required,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  type?: string
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">
        {label}{required ? ' *' : ''}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-950 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </label>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
  required,
}: {
  label: string
  value: string
  options: Array<FormOption | { key: string; label: string }>
  onChange: (value: string) => void
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">
        {label}{required ? ' *' : ''}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Select...</option>
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
