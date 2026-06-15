'use client'

import { useActionState, useMemo, useState } from 'react'
import {
  DEFAULT_PRICING_CONFIG,
  PRICING_KEYS,
  validatePricingConfigDraft,
  type PricingConfig,
} from './config-admin'
import { savePricingConfigVersion, type SavePricingConfigResult } from './actions'

type Props = {
  initialConfig: PricingConfig
  readOnly: boolean
}

const emptyResult: SavePricingConfigResult | null = null

async function submitConfig(
  _previous: SavePricingConfigResult | null,
  formData: FormData,
): Promise<SavePricingConfigResult> {
  return savePricingConfigVersion(formData)
}

export function PricingEditor({ initialConfig, readOnly }: Props) {
  const [config, setConfig] = useState<PricingConfig>(initialConfig)
  const [result, formAction, pending] = useActionState(submitConfig, emptyResult)
  const validationErrors = useMemo(() => validatePricingConfigDraft(config), [config])

  function updateScenario(
    key: keyof PricingConfig['scenarios'],
    field: keyof PricingConfig['scenarios'][keyof PricingConfig['scenarios']],
    value: string,
  ) {
    setConfig((current) => ({
      ...current,
      scenarios: {
        ...current.scenarios,
        [key]: {
          ...current.scenarios[key],
          [field]: field === 'gatePrice' && value === '' ? null : Number(value),
        },
      },
    }))
  }

  function updateTopLevel(field: 'minimumLength' | 'cornerSurcharge' | 'interlikingRailsSurcharge' | 'rangeLowPercent' | 'rangeHighPercent', value: string) {
    setConfig((current) => ({ ...current, [field]: Number(value) }))
  }

  function updateMap<K extends keyof Pick<PricingConfig, 'hardwareFinishSurcharge' | 'fixingMethodSurcharge' | 'glassTypeSurcharge' | 'glassColourSurcharge'>>(
    group: K,
    key: keyof PricingConfig[K],
    value: string,
  ) {
    setConfig((current) => ({
      ...current,
      [group]: {
        ...current[group],
        [key]: Number(value),
      },
    }))
  }

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="config" value={JSON.stringify(config)} />

      {result && 'success' in result && (
        <div className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Activated {result.versionLabel}.
        </div>
      )}
      {result && 'error' in result && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {result.error}
        </div>
      )}

      {validationErrors.length > 0 && (
        <div className="space-y-2 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {validationErrors.map((error) => <p key={error}>{error}</p>)}
        </div>
      )}

      {!readOnly && (
        <div className="grid gap-4 rounded border border-gray-200 bg-white p-4 text-sm shadow-sm md:grid-cols-[16rem_1fr]">
          <div>
            <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Version label</span>
            <p className="font-mono text-sm text-gray-800">Generated on save</p>
            <p className="mt-1 text-xs text-gray-500">Format: vN-YYYY-MM-DD</p>
          </div>
          <label>
            <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Remarks</span>
            <textarea
              name="activationNote"
              required
              rows={3}
              placeholder="Summarise why this pricing version is being activated."
              className={inputClassName(false)}
            />
          </label>
        </div>
      )}

      <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800">Base Rates</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase text-gray-500">
                <th className="py-2 pr-3 font-medium">Scenario</th>
                <th className="px-3 py-2 font-medium">Rate per metre</th>
                <th className="px-3 py-2 font-medium">Gate price</th>
              </tr>
            </thead>
            <tbody>
              {PRICING_KEYS.scenarios.map((key) => (
                <tr key={key} className="border-b border-gray-50">
                  <td className="py-2 pr-3 font-mono text-xs text-gray-700">{key}</td>
                  <td className="px-3 py-2">
                    <NumberInput
                      value={config.scenarios[key]?.ratePerMetre ?? DEFAULT_PRICING_CONFIG.scenarios[key].ratePerMetre}
                      readOnly={readOnly}
                      min={0}
                      onChange={(value) => updateScenario(key, 'ratePerMetre', value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <NumberInput
                      value={config.scenarios[key]?.gatePrice ?? ''}
                      readOnly={readOnly || key !== 'premium_pool_fence'}
                      min={0}
                      onChange={(value) => updateScenario(key, 'gatePrice', value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <NumberMapEditor
          title="Hardware Finish Surcharges"
          values={config.hardwareFinishSurcharge}
          keys={PRICING_KEYS.hardwareFinishes}
          readOnly={readOnly}
          allowNegative={false}
          onChange={(key, value) => updateMap('hardwareFinishSurcharge', key, value)}
        />
        <NumberMapEditor
          title="Fixing Method Surcharges"
          values={config.fixingMethodSurcharge}
          keys={PRICING_KEYS.fixingMethods}
          readOnly={readOnly}
          allowNegative
          onChange={(key, value) => updateMap('fixingMethodSurcharge', key, value)}
        />
        <NumberMapEditor
          title="Glass Type Surcharges"
          values={config.glassTypeSurcharge}
          keys={PRICING_KEYS.glassTypes}
          readOnly={readOnly}
          allowNegative={false}
          onChange={(key, value) => updateMap('glassTypeSurcharge', key, value)}
        />
        <NumberMapEditor
          title="Glass Colour Surcharges"
          values={config.glassColourSurcharge}
          keys={PRICING_KEYS.glassColours}
          readOnly={readOnly}
          allowNegative={false}
          onChange={(key, value) => updateMap('glassColourSurcharge', key, value)}
        />
      </section>

      <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800">Other Settings</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <SettingInput label="Minimum length" value={config.minimumLength} readOnly={readOnly} min={0} onChange={(value) => updateTopLevel('minimumLength', value)} />
          <SettingInput label="Corner surcharge" value={config.cornerSurcharge} readOnly={readOnly} min={0} onChange={(value) => updateTopLevel('cornerSurcharge', value)} />
          <SettingInput label="Interlinking rails" value={config.interlikingRailsSurcharge} readOnly={readOnly} min={0} onChange={(value) => updateTopLevel('interlikingRailsSurcharge', value)} />
          <SettingInput label="Range low %" value={config.rangeLowPercent} readOnly={readOnly} min={0} onChange={(value) => updateTopLevel('rangeLowPercent', value)} />
          <SettingInput label="Range high %" value={config.rangeHighPercent} readOnly={readOnly} min={0} onChange={(value) => updateTopLevel('rangeHighPercent', value)} />
        </div>
      </section>

      {!readOnly && (
        <div className="sticky bottom-0 flex justify-end border-t border-gray-200 bg-gray-50/95 py-4">
          <button
            type="submit"
            disabled={pending || validationErrors.length > 0}
            className="rounded bg-[#142B3A] px-5 py-2.5 text-sm font-medium text-white shadow-sm disabled:bg-gray-300"
          >
            {pending ? 'Saving...' : 'Save new active version'}
          </button>
        </div>
      )}
    </form>
  )
}

function inputClassName(readOnly: boolean) {
  return [
    'w-full rounded border border-gray-300 px-3 py-2 text-sm',
    readOnly
      ? 'bg-gray-50 text-gray-900 disabled:text-gray-900 disabled:opacity-100'
      : 'bg-white text-gray-900',
  ].join(' ')
}

function NumberMapEditor<K extends string>({
  title,
  values,
  keys,
  readOnly,
  allowNegative,
  onChange,
}: {
  title: string
  values: Record<K, number>
  keys: readonly K[]
  readOnly: boolean
  allowNegative: boolean
  onChange: (key: K, value: string) => void
}) {
  return (
    <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      <div className="mt-4 space-y-3">
        {keys.map((key) => (
          <label key={key} className="grid gap-2 text-sm md:grid-cols-[1fr_8rem] md:items-center">
            <span className="font-mono text-xs text-gray-600">{key}</span>
            <NumberInput
              value={values[key] ?? 0}
              readOnly={readOnly}
              min={allowNegative ? undefined : 0}
              onChange={(value) => onChange(key, value)}
            />
          </label>
        ))}
      </div>
    </section>
  )
}

function SettingInput({
  label,
  value,
  readOnly,
  min,
  onChange,
}: {
  label: string
  value: number
  readOnly: boolean
  min: number
  onChange: (value: string) => void
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-xs font-medium uppercase text-gray-500">{label}</span>
      <NumberInput value={value} readOnly={readOnly} min={min} onChange={onChange} />
    </label>
  )
}

function NumberInput({
  value,
  readOnly,
  min,
  onChange,
}: {
  value: number | ''
  readOnly: boolean
  min?: number
  onChange: (value: string) => void
}) {
  return (
    <input
      type="number"
      step="any"
      min={min}
      value={value}
      disabled={readOnly}
      onChange={(event) => onChange(event.target.value)}
      className={inputClassName(readOnly)}
    />
  )
}
