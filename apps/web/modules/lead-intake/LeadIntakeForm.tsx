'use client'

import { useRef, useState, useTransition, type MutableRefObject } from 'react'
import { useRouter } from 'next/navigation'
import type { ActiveScoringOptionLists, FormOption } from '@/modules/lead-intake/scoring/config-options'
import { optionTeamNote, scoreLead, tierAction, type DecisionMatrixAnswers } from '@/modules/lead-intake/scoring/score-lead'
import { submitLeadIntake, computeLeadDistance, type LeadIntakeInput, type LeadIntakeResult } from './actions'
import { PROJECT_TYPES, SOURCES } from './display-labels'
import { PlacesAutocomplete } from './PlacesAutocomplete'
import { ScorePanel } from './ScorePanel'

const initialState: LeadIntakeInput = {
  editReason: '',
  clientName: '',
  companyName: '',
  phone: '',
  email: '',
  clientProfileKey: '',
  projectType: '',
  location: '',
  suburb: '',
  cat4: '',
  rcStatus: '',
  bcStatus: '',
  buildingStage: '',
  followUpDate: '',
  budgetBand: '',
  decisionMakers: '',
  priceSensitivityRead: '',
  leadSource: '',
  paymentHistory: '',
  siteAccess: '',
  installationHeight: '',
  source: 'phone',
  freeText: '',
}

const FIELD_LABEL_CLASS = 'inline-flex h-4 items-center text-xs font-medium text-gray-600'
const FIELD_CONTROL_CLASS = 'mt-1 h-[38px] w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-950 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500'

export function LeadIntakeForm({
  optionLists,
  initialInput,
}: {
  optionLists: ActiveScoringOptionLists
  initialInput?: LeadIntakeInput
}) {
  const router = useRouter()
  const [input, setInput] = useState<LeadIntakeInput>(initialInput ?? initialState)
  const [result, setResult] = useState<LeadIntakeResult | null>(null)
  const [distanceBand, setDistanceBand] = useState<string | null>(initialInput?.distanceBand ?? null)
  const [isComputingDistance, setIsComputingDistance] = useState(false)
  const [isPending, startTransition] = useTransition()
  const lastPrefilledDate = useRef<string | null>(null)
  const distanceRequestId = useRef(0)

  function update<K extends keyof LeadIntakeInput>(key: K, value: LeadIntakeInput[K]) {
    setInput((current) => {
      const next = { ...current, [key]: value }
      if (key === 'followUpDate') {
        if (value !== lastPrefilledDate.current) lastPrefilledDate.current = null
        return next
      }
      return applyFollowUpPrefill(next, distanceBand, lastPrefilledDate)
    })
  }

  function handleSubmit() {
    setResult(null)

    startTransition(async () => {
      const nextResult = await submitLeadIntake(input)
      setResult(nextResult)
      if ('success' in nextResult) {
        const status = input.leadId ? 'updated' : 'added'
        router.push(`/leads/${nextResult.leadId}?intakeSaved=${status}`)
      }
    })
  }

  function cancelDistanceLookup() {
    distanceRequestId.current += 1
    setIsComputingDistance(false)
  }

  async function computeDistanceForAddress(address: string) {
    const requestId = distanceRequestId.current + 1
    distanceRequestId.current = requestId
    setIsComputingDistance(true)

    try {
      const band = await computeLeadDistance(address)
      if (requestId !== distanceRequestId.current) return

      setDistanceBand(band)
      setInput((current) => applyFollowUpPrefill(current, band, lastPrefilledDate))
    } finally {
      if (requestId === distanceRequestId.current) {
        setIsComputingDistance(false)
      }
    }
  }

  return (
    <>
      <ScorePanel
        input={{ ...input, distanceBand }}
        config={optionLists.config}
        lastUpdated={input.lastUpdated}
        followUpDate={input.followUpDate}
      />

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
            {result.flagNote && (
              <div className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
                ⚑ {result.flagNote}
              </div>
            )}
            <div className="mt-1 text-xs text-green-700">
              Lead {result.leadId} · {input.leadId ? 'updated existing lead' : result.matchedExistingClient ? 'matched existing client' : 'created new client'}
            </div>
            <div className="mt-1 text-xs text-green-700">
              ServiceM8 {result.servicem8Sync.ok ? 'sent to inbox' : `queued for retry: ${result.servicem8Sync.error}`}
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Client Name/Business Name" required value={input.clientName} onChange={(value) => update('clientName', value)} />
          <TextField label="Phone" required value={input.phone ?? ''} onChange={(value) => update('phone', value)} />
          <SelectField
            label="Client type"
            value={input.clientProfileKey}
            options={optionLists.categories['1']?.options ?? []}
            teamNote={optionTeamNote('clientType', input.clientProfileKey)}
            onChange={(value) => update('clientProfileKey', value)}
          />
          <TextField label="Email" required type="email" value={input.email ?? ''} onChange={(value) => update('email', value)} />
          <PlacesAutocomplete
            value={input.location}
            updateOnInput
            onChange={async (address, suburb, source) => {
              update('location', address)
              update('suburb', suburb)
              setDistanceBand(null)
              if (!address || source === 'input') {
                cancelDistanceLookup()
                return
              }
              await computeDistanceForAddress(address)
            }}
          />
          <DistanceDisplay band={distanceBand} isComputing={isComputingDistance} />
          <SelectField
            label="Product"
            value={input.projectType}
            options={PROJECT_TYPES}
            onChange={(value) => update('projectType', value)}
          />
          <SelectField
            label="Project Type"
            value={input.cat4 ?? ''}
            options={optionLists.categories['4']?.options ?? []}
            teamNote={optionTeamNote('projectType', input.cat4)}
            onChange={(value) => update('cat4', value)}
          />
          <SelectField
            label="Budget Band"
            value={input.budgetBand ?? ''}
            options={optionLists.categories['2']?.options ?? []}
            teamNote={optionTeamNote('budgetBand', input.budgetBand)}
            onChange={(value) => update('budgetBand', value)}
          />
          <SelectField
            label="Building Consent (BC)"
            value={input.bcStatus ?? ''}
            options={optionLists.categories['9']?.options ?? []}
            teamNote={optionTeamNote('buildingConsent', input.bcStatus)}
            onChange={(value) => update('bcStatus', value)}
          />
          <SelectField
            label="Building Stage"
            value={input.buildingStage ?? ''}
            options={optionLists.categories['10']?.options ?? []}
            teamNote={optionTeamNote('buildingStage', input.buildingStage)}
            onChange={(value) => update('buildingStage', value)}
          />
          <SelectField
            label="Resource Consent (RC)"
            value={input.rcStatus ?? ''}
            options={optionLists.categories['8']?.options ?? []}
            teamNote={optionTeamNote('resourceConsent', input.rcStatus)}
            onChange={(value) => update('rcStatus', value)}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <SelectField
            label="Price-sensitivity read"
            value={input.priceSensitivityRead ?? ''}
            options={optionLists.categories['5']?.options ?? []}
            teamNote={optionTeamNote('priceSensitivity', input.priceSensitivityRead)}
            onChange={(value) => update('priceSensitivityRead', value)}
          />
          <SelectField
            label="Decision-makers"
            value={input.decisionMakers ?? ''}
            options={optionLists.categories['6']?.options ?? []}
            teamNote={optionTeamNote('decisionMakers', input.decisionMakers)}
            onChange={(value) => update('decisionMakers', value)}
          />
          <SelectField
            label="Source"
            value={input.leadSource ?? ''}
            options={optionLists.categories['11']?.options ?? []}
            teamNote={optionTeamNote('source', input.leadSource)}
            onChange={(value) => update('leadSource', value)}
          />
          <SelectField
            label="Payment History"
            value={input.paymentHistory ?? ''}
            options={optionLists.categories['12']?.options ?? []}
            teamNote={optionTeamNote('paymentHistory', input.paymentHistory)}
            onChange={(value) => update('paymentHistory', value)}
          />
          <SelectField
            label="Site Access"
            value={input.siteAccess ?? ''}
            options={optionLists.categories['13']?.options ?? []}
            teamNote={optionTeamNote('siteAccess', input.siteAccess)}
            onChange={(value) => update('siteAccess', value)}
          />
          <SelectField
            label="Installation Height"
            value={input.installationHeight ?? ''}
            options={optionLists.categories['14']?.options ?? []}
            teamNote={optionTeamNote('installationHeight', input.installationHeight)}
            onChange={(value) => update('installationHeight', value)}
          />
          <SelectField
            label="Channel"
            value={input.source}
            options={SOURCES}
            onChange={(value) => update('source', value as LeadIntakeInput['source'])}
          />
          <TextField
            label="Follow-up date"
            type="date"
            value={input.followUpDate ?? ''}
            onChange={(value) => update('followUpDate', value)}
          />
        </div>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Free notes</span>
          <textarea
            value={input.freeText ?? ''}
            onChange={(event) => update('freeText', event.target.value)}
            className="mt-1 min-h-24 w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-950 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        {input.leadId && (
          <label className="block">
            <span className="text-xs font-medium text-gray-600">
              Reason for edit <RequiredMark />
            </span>
            <textarea
              value={input.editReason ?? ''}
              onChange={(event) => update('editReason', event.target.value)}
              className="mt-1 min-h-20 w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-950 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
        )}

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
      <span className={FIELD_LABEL_CLASS}>
        {label}{required ? <RequiredMark /> : null}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={FIELD_CONTROL_CLASS}
      />
    </label>
  )
}

function TextAreaField({
  label,
  value,
  onChange,
  required,
  rows = 2,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  rows?: number
}) {
  return (
    <label className="block">
      <span className={FIELD_LABEL_CLASS}>
        {label}{required ? <RequiredMark /> : null}
      </span>
      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-[76px] w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-950 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </label>
  )
}

function datePlusDays(days: number): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function matrixAnswers(input: LeadIntakeInput, distanceBand: string | null): DecisionMatrixAnswers {
  return {
    clientType: input.clientProfileKey || undefined,
    budgetBand: input.budgetBand || undefined,
    resourceConsent: input.rcStatus || undefined,
    buildingConsent: input.bcStatus || undefined,
    buildingStage: input.buildingStage || undefined,
    projectType: input.cat4 || undefined,
    priceSensitivity: input.priceSensitivityRead || undefined,
    decisionMakers: input.decisionMakers || undefined,
    source: input.leadSource || undefined,
    distanceBand: distanceBand || undefined,
    paymentHistory: input.paymentHistory || undefined,
    siteAccess: input.siteAccess || undefined,
    installationHeight: input.installationHeight || undefined,
  }
}

function applyFollowUpPrefill(
  input: LeadIntakeInput,
  distanceBand: string | null,
  lastPrefilledDate: MutableRefObject<string | null>,
): LeadIntakeInput {
  const score = scoreLead(matrixAnswers(input, distanceBand))
  if (score.completeness.answered === 0) return input

  const currentDate = input.followUpDate ?? ''
  if (currentDate && currentDate !== lastPrefilledDate.current) return input

  const nextDate = datePlusDays(tierAction(score.tier).followUpOffsetDays)
  if (nextDate === currentDate) return input

  lastPrefilledDate.current = nextDate
  return { ...input, followUpDate: nextDate }
}

const DISTANCE_BAND_LABELS: Record<string, { text: string; pts: string; color: string }> = {
  lt_15km: { text: '<15 km', pts: '+5 pts', color: 'text-green-700' },
  '15_50km': { text: '15-50 km', pts: '+3 pts', color: 'text-amber-700' },
  gt_50km: { text: '>50 km', pts: '+0 pts', color: 'text-orange-600' },
}

function DistanceDisplay({ band, isComputing }: { band: string | null; isComputing: boolean }) {
  const info = band ? DISTANCE_BAND_LABELS[band] : null
  return (
    <div className="block">
      <span className={FIELD_LABEL_CLASS}>Driving distance</span>
      <div className="mt-1 flex h-[38px] items-center rounded border border-gray-200 bg-gray-50 px-3 text-sm">
        {isComputing ? (
          <span className="italic text-gray-400">Computing…</span>
        ) : info ? (
          <span className={`font-medium ${info.color}`}>
            {info.text} <span className="ml-1 text-xs font-semibold">{info.pts}</span>
          </span>
        ) : (
          <span className="italic text-gray-400">Auto-computed from Job Address</span>
        )}
      </div>
    </div>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
  required,
  teamNote,
}: {
  label: string
  value: string
  options: Array<FormOption | { key: string; label: string }>
  onChange: (value: string) => void
  required?: boolean
  teamNote?: string | null
}) {
  const [showNote, setShowNote] = useState(false)
  return (
    <label className="block">
      <span className={`${FIELD_LABEL_CLASS} gap-1`}>
        <span>{label}{required ? <RequiredMark /> : null}</span>
        {teamNote && (
          <button
            type="button"
            aria-label={`${label} Team Note: ${teamNote}`}
            title={teamNote}
            onFocus={() => setShowNote(true)}
            onBlur={() => setShowNote(false)}
            onMouseEnter={() => setShowNote(true)}
            onMouseLeave={() => setShowNote(false)}
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 bg-gray-100 text-[10px] font-semibold text-gray-500"
          >
            i
          </button>
        )}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${FIELD_CONTROL_CLASS} bg-white`}
      >
        <option value="">Select...</option>
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
      {teamNote && showNote && (
        <div role="tooltip" className="mt-1 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-600">
          {teamNote}
        </div>
      )}
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
