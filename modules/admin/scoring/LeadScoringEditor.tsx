'use client'

import { useMemo, useState, useActionState } from 'react'
import type { ScoringConfig } from '@/modules/lead-intake/scoring/score-lead'
import { saveScoringConfigVersion, type SaveScoringConfigResult } from './actions'
import { buildRemovedOptionWarnings, validateScoringConfigDraft } from './config-admin'

type Props = {
  initialConfig: ScoringConfig
  activeConfig: ScoringConfig
  usedOptionKeys: string[]
  readOnly: boolean
}

const emptyResult: SaveScoringConfigResult | null = null

async function submitConfig(
  _previous: SaveScoringConfigResult | null,
  formData: FormData,
): Promise<SaveScoringConfigResult> {
  return saveScoringConfigVersion(formData)
}

export function LeadScoringEditor({
  initialConfig,
  activeConfig,
  usedOptionKeys,
  readOnly,
}: Props) {
  const [config, setConfig] = useState<ScoringConfig>(initialConfig)
  const [result, formAction, pending] = useActionState(submitConfig, emptyResult)
  const initialOptionKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const category of Object.values(initialConfig.categories)) {
      for (const key of Object.keys(category.options)) keys.add(key)
    }
    return keys
  }, [initialConfig])

  const validationErrors = useMemo(() => validateScoringConfigDraft(config), [config])
  const warnings = useMemo(
    () => buildRemovedOptionWarnings(activeConfig, config, new Set(usedOptionKeys)),
    [activeConfig, config, usedOptionKeys],
  )

  function updateCategory(
    categoryKey: string,
    updater: (category: ScoringConfig['categories'][string]) => ScoringConfig['categories'][string],
  ) {
    setConfig((current) => ({
      ...current,
      categories: {
        ...current.categories,
        [categoryKey]: updater(current.categories[categoryKey]),
      },
    }))
  }

  function updateOption(categoryKey: string, optionKey: string, field: 'key' | 'label' | 'points', value: string) {
    updateCategory(categoryKey, (category) => {
      const options = { ...category.options }
      const optionLabels = { ...(category.optionLabels ?? {}) }
      const optionOrder = [...(category.optionOrder ?? Object.keys(category.options))]

      if (field === 'key') {
        const nextKey = value.trim()
        if (!nextKey || nextKey === optionKey) return category
        const index = optionOrder.indexOf(optionKey)
        if (index >= 0) optionOrder[index] = nextKey
        options[nextKey] = options[optionKey]
        optionLabels[nextKey] = optionLabels[optionKey] ?? ''
        delete options[optionKey]
        delete optionLabels[optionKey]
        return { ...category, options, optionLabels, optionOrder }
      }

      if (field === 'label') {
        optionLabels[optionKey] = value
        return { ...category, optionLabels }
      }

      options[optionKey] = Number(value)
      return { ...category, options }
    })
  }

  function addOption(categoryKey: string) {
    updateCategory(categoryKey, (category) => {
      let index = Object.keys(category.options).length + 1
      let key = `new_option_${index}`
      while (key in category.options) {
        index += 1
        key = `new_option_${index}`
      }
      return {
        ...category,
        options: { ...category.options, [key]: 0 },
        optionLabels: { ...(category.optionLabels ?? {}), [key]: 'New option' },
        optionOrder: [...(category.optionOrder ?? Object.keys(category.options)), key],
      }
    })
  }

  function removeOption(categoryKey: string, optionKey: string) {
    updateCategory(categoryKey, (category) => {
      const options = { ...category.options }
      const optionLabels = { ...(category.optionLabels ?? {}) }
      delete options[optionKey]
      delete optionLabels[optionKey]
      return {
        ...category,
        options,
        optionLabels,
        optionOrder: (category.optionOrder ?? Object.keys(category.options)).filter((key) => key !== optionKey),
      }
    })
  }

  function moveOption(categoryKey: string, optionKey: string, direction: -1 | 1) {
    updateCategory(categoryKey, (category) => {
      const order = [...(category.optionOrder ?? Object.keys(category.options))]
      const index = order.indexOf(optionKey)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return category
      ;[order[index], order[nextIndex]] = [order[nextIndex], order[index]]
      return { ...category, optionOrder: order }
    })
  }

  function updateAdjustment(kind: 'bonuses' | 'penalties', key: string, field: 'key' | 'points', value: string) {
    setConfig((current) => {
      const next = { ...current[kind] }
      if (field === 'key') {
        const nextKey = value.trim()
        if (!nextKey || nextKey === key) return current
        next[nextKey] = next[key]
        delete next[key]
      } else {
        next[key] = Number(value)
      }
      return { ...current, [kind]: next }
    })
  }

  function addAdjustment(kind: 'bonuses' | 'penalties') {
    setConfig((current) => {
      let index = Object.keys(current[kind]).length + 1
      let key = kind === 'bonuses' ? `bonus_${index}` : `penalty_${index}`
      while (key in current[kind]) {
        index += 1
        key = kind === 'bonuses' ? `bonus_${index}` : `penalty_${index}`
      }
      return { ...current, [kind]: { ...current[kind], [key]: 0 } }
    })
  }

  function removeAdjustment(kind: 'bonuses' | 'penalties', key: string) {
    setConfig((current) => {
      const next = { ...current[kind] }
      delete next[key]
      return { ...current, [kind]: next }
    })
  }

  const categoryEntries = Object.entries(config.categories).sort(([left], [right]) => Number(left) - Number(right))
  const strikeWeights = config.strikes?.weights ?? {}
  const totalMaxPoints = categoryEntries.reduce((total, [, category]) => total + category.max, 0)

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

      {(validationErrors.length > 0 || warnings.length > 0) && (
        <div className="space-y-2 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {validationErrors.map((error) => <p key={error}>{error}</p>)}
          {warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      )}

      <section className="space-y-4">
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
                placeholder="Summarise why this scoring version is being activated."
                className={inputClassName(false, 'w-full')}
              />
            </label>
          </div>
        )}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-800">Categories</h2>
          <div className="rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm">
            Total ceiling: <span className="font-semibold">{totalMaxPoints}</span> / 100
          </div>
        </div>
        <div className="space-y-5">
          {categoryEntries.map(([categoryKey, category]) => {
            const optionOrder = category.optionOrder ?? Object.keys(category.options)
            const highestOptionPoints = Math.max(0, ...Object.values(category.options))
            return (
              <div key={categoryKey} className="rounded border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-800">{category.label || `Category ${categoryKey}`}</h3>
                  <div className={`rounded px-2 py-1 text-xs ${highestOptionPoints > category.max || category.max > 100 ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                    Highest option {highestOptionPoints} / ceiling {category.max}
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-[6rem_1fr_8rem]">
                  <label className="text-sm">
                    <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Category</span>
                    <input
                      value={categoryKey}
                      disabled
                      className="w-full rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Label</span>
                    <input
                      value={category.label}
                      disabled={readOnly}
                      onChange={(event) => updateCategory(categoryKey, (current) => ({ ...current, label: event.target.value }))}
                      className={inputClassName(readOnly, 'w-full')}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Max</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={category.max}
                      disabled={readOnly}
                      onChange={(event) => updateCategory(categoryKey, (current) => ({ ...current, max: Number(event.target.value) }))}
                      className={inputClassName(readOnly, 'w-full')}
                    />
                  </label>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left text-xs uppercase text-gray-500">
                        <th className="py-2 pr-3 font-medium">Order</th>
                        <th className="px-3 py-2 font-medium">Key</th>
                        <th className="px-3 py-2 font-medium">Label</th>
                        <th className="px-3 py-2 font-medium">Points</th>
                        <th className="px-3 py-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {optionOrder.map((optionKey, index) => (
                        <tr key={optionKey} className="border-b border-gray-50">
                          <td className="py-2 pr-3 text-gray-500">{index + 1}</td>
                          <td className="px-3 py-2">
                            {initialOptionKeys.has(optionKey) ? (
                              <code className="block rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-700">
                                {optionKey}
                              </code>
                            ) : (
                              <input
                                defaultValue={optionKey}
                                disabled={readOnly}
                                onBlur={(event) => updateOption(categoryKey, optionKey, 'key', event.target.value)}
                                className={compactInputClassName(readOnly, 'w-full font-mono text-xs')}
                              />
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={category.optionLabels?.[optionKey] ?? ''}
                              disabled={readOnly}
                              onChange={(event) => updateOption(categoryKey, optionKey, 'label', event.target.value)}
                              className={compactInputClassName(readOnly, 'w-full')}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              value={category.options[optionKey]}
                              disabled={readOnly}
                              onChange={(event) => updateOption(categoryKey, optionKey, 'points', event.target.value)}
                              className={compactInputClassName(readOnly, 'w-24')}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-2">
                              <button type="button" disabled={readOnly || index === 0} onClick={() => moveOption(categoryKey, optionKey, -1)} className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 disabled:text-gray-300">Up</button>
                              <button type="button" disabled={readOnly || index === optionOrder.length - 1} onClick={() => moveOption(categoryKey, optionKey, 1)} className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 disabled:text-gray-300">Down</button>
                              <button type="button" disabled={readOnly} onClick={() => removeOption(categoryKey, optionKey)} className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 disabled:text-gray-300">Remove</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" disabled={readOnly} onClick={() => addOption(categoryKey)} className="mt-3 rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 disabled:text-gray-300">
                  Add option
                </button>
              </div>
            )
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <AdjustmentEditor title="Bonuses" kind="bonuses" values={config.bonuses} readOnly={readOnly} onAdd={addAdjustment} onChange={updateAdjustment} onRemove={removeAdjustment} />
        <AdjustmentEditor title="Penalties" kind="penalties" values={config.penalties} readOnly={readOnly} onAdd={addAdjustment} onChange={updateAdjustment} onRemove={removeAdjustment} />
      </section>

      <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800">Tiers</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {(['A', 'B', 'C'] as const).map((tier) => (
            <label key={tier} className="text-sm">
              <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Tier {tier}</span>
              <input
                type="number"
                value={config.tiers[tier]}
                disabled={readOnly}
                onChange={(event) => setConfig((current) => ({ ...current, tiers: { ...current.tiers, [tier]: Number(event.target.value) } }))}
                className={inputClassName(readOnly, 'w-full')}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800">Strikes</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Soft demote at</span>
            <input type="number" value={config.strikes?.softDemoteAt ?? 0} disabled={readOnly} onChange={(event) => setConfig((current) => ({ ...current, strikes: { capAt: 0, capCeiling: 'C', weights: {}, ...current.strikes, softDemoteAt: Number(event.target.value) } }))} className={inputClassName(readOnly, 'w-full')} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Cap at</span>
            <input type="number" value={config.strikes?.capAt ?? 0} disabled={readOnly} onChange={(event) => setConfig((current) => ({ ...current, strikes: { softDemoteAt: 0, capCeiling: 'C', weights: {}, ...current.strikes, capAt: Number(event.target.value) } }))} className={inputClassName(readOnly, 'w-full')} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Cap ceiling</span>
            <select value={config.strikes?.capCeiling ?? 'C'} disabled={readOnly} onChange={(event) => setConfig((current) => ({ ...current, strikes: { softDemoteAt: 0, capAt: 0, weights: {}, ...current.strikes, capCeiling: event.target.value as 'A' | 'B' | 'C' | 'D' } }))} className={inputClassName(readOnly, 'w-full')}>
              {(['A', 'B', 'C', 'D'] as const).map((tier) => <option key={tier} value={tier}>{tier}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {Object.entries(strikeWeights).map(([key, weight]) => (
            <label key={key} className="text-sm">
              <span className="mb-1 block font-mono text-xs text-gray-500">{key}</span>
              <input type="number" value={weight} disabled={readOnly} onChange={(event) => setConfig((current) => ({ ...current, strikes: { softDemoteAt: 0, capAt: 0, capCeiling: 'C', ...current.strikes, weights: { ...(current.strikes?.weights ?? {}), [key]: Number(event.target.value) } } }))} className={inputClassName(readOnly, 'w-full')} />
            </label>
          ))}
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

function inputClassName(readOnly: boolean, extra = '') {
  return [
    'rounded border border-gray-300 px-3 py-2 text-sm',
    readOnly
      ? 'bg-gray-50 text-gray-900 disabled:text-gray-900 disabled:opacity-100'
      : 'bg-white text-gray-900',
    extra,
  ].filter(Boolean).join(' ')
}

function compactInputClassName(readOnly: boolean, extra = '') {
  return [
    'rounded border border-gray-300 px-2 py-1.5',
    readOnly
      ? 'bg-gray-50 text-gray-900 disabled:text-gray-900 disabled:opacity-100'
      : 'bg-white text-gray-900',
    extra,
  ].filter(Boolean).join(' ')
}

function AdjustmentEditor({
  title,
  kind,
  values,
  readOnly,
  onAdd,
  onChange,
  onRemove,
}: {
  title: string
  kind: 'bonuses' | 'penalties'
  values: Record<string, number>
  readOnly: boolean
  onAdd: (kind: 'bonuses' | 'penalties') => void
  onChange: (kind: 'bonuses' | 'penalties', key: string, field: 'key' | 'points', value: string) => void
  onRemove: (kind: 'bonuses' | 'penalties', key: string) => void
}) {
  return (
    <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      <div className="mt-4 space-y-3">
        {Object.entries(values).map(([key, points]) => (
          <div key={key} className="grid gap-3 md:grid-cols-[1fr_7rem_auto]">
            <input defaultValue={key} disabled={readOnly} onBlur={(event) => onChange(kind, key, 'key', event.target.value)} className={inputClassName(readOnly, 'font-mono text-xs')} />
            <input type="number" value={points} disabled={readOnly} onChange={(event) => onChange(kind, key, 'points', event.target.value)} className={inputClassName(readOnly)} />
            <button type="button" disabled={readOnly} onClick={() => onRemove(kind, key)} className="rounded border border-red-200 px-3 py-2 text-sm text-red-700 disabled:text-gray-300">Remove</button>
          </div>
        ))}
        {Object.keys(values).length === 0 && <p className="text-sm text-gray-500">No {title.toLowerCase()} configured.</p>}
      </div>
      <button type="button" disabled={readOnly} onClick={() => onAdd(kind)} className="mt-3 rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 disabled:text-gray-300">
        Add {title.slice(0, -1).toLowerCase()}
      </button>
    </section>
  )
}
