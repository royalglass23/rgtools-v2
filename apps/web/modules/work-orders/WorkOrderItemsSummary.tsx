'use client'

import { useState } from 'react'
import {
  bulkApplyWorkOrderItemOperationalFieldAction,
  regenerateWorkOrderItemLabelAction,
  updateWorkOrderItemLabelAction,
  updateWorkOrderItemOperationalFieldAction,
} from './actions'
import { operationalFieldLabel, type WorkOrderItemOperationalField } from './item-operational-fields'
import type { WorkOrderItemSummaryRow } from './work-order-items'

type FilterOption = { id: string; label: string }
type WorkOrderItemOptions = {
  installers: FilterOption[]
  stages: FilterOption[]
  hardwareStatuses: FilterOption[]
}

const EMPTY_OPTIONS: WorkOrderItemOptions = { installers: [], stages: [], hardwareStatuses: [] }

export function WorkOrderItemsSummary({
  items,
  showCount = true,
  canManage = false,
  options = EMPTY_OPTIONS,
}: {
  items: WorkOrderItemSummaryRow[]
  showCount?: boolean
  canManage?: boolean
  options?: WorkOrderItemOptions
}) {
  if (items.length === 0) {
    return (
      <section aria-label="Work Order items" className="space-y-2 px-4 py-3">
        {showCount && <ItemCount count={0} />}
        <p className="rounded border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-sm text-gray-600">
          No items synced from ServiceM8 yet
        </p>
      </section>
    )
  }

  const activeItemCount = items.filter((item) => item.isActive).length

  return (
    <section aria-label="Work Order items" className="space-y-2 px-4 py-3">
      {showCount && <ItemCount count={activeItemCount} />}
      <div className="grid gap-2">
        {items.map((item) => {
          const effectiveLabel = item.manualLabelOverride ?? item.generatedLabel ?? truncateDescription(item.originalDescription)
          const isLabelPending = !item.manualLabelOverride
            && !item.generatedLabel
            && (item.labelStatus === 'pending' || item.labelStatus === 'failed')
          const lineTotal = item.lineTotalExcludingGst
            ? `$${item.lineTotalExcludingGst}`
            : 'Not available'
          const hoverDetail = `${item.originalDescription}\nLine total excluding GST: ${lineTotal}`

          return (
            <div
              key={item.id}
              title={hoverDetail}
              className={`grid gap-1 rounded border px-3 py-2 text-sm md:grid-cols-[90px_160px_1fr] ${item.isActive ? 'border-gray-200 bg-gray-50' : 'border-amber-200 bg-amber-50'}`}
            >
              <span className="font-medium text-gray-700">Qty {formatQuantity(item.quantity)}</span>
              <span className="font-mono text-xs text-gray-600">{item.itemCode ?? 'No item code'}</span>
              <div title={hoverDetail} className="flex flex-wrap items-center gap-2 text-gray-950">
                {canManage && item.isActive ? (
                  <>
                    <form action={updateWorkOrderItemLabelAction.bind(null, item.id)} className="flex min-w-[260px] flex-1 gap-2">
                      <input
                        aria-label={`Short label for ${item.itemCode ?? 'item'}`}
                        name="label"
                        defaultValue={effectiveLabel}
                        required
                        maxLength={160}
                        className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-950"
                      />
                      <button type="submit" className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100">
                        Save label
                      </button>
                    </form>
                    <form
                      action={regenerateWorkOrderItemLabelAction.bind(null, item.id)}
                      onSubmit={(event) => {
                        if (!window.confirm('Regenerate this label with AI? This will replace the current label.')) {
                          event.preventDefault()
                        }
                      }}
                    >
                      <button type="submit" className="rounded border border-sky-300 bg-white px-2 py-1 text-xs font-medium text-sky-800 hover:bg-sky-50">
                        Regenerate with AI
                      </button>
                    </form>
                  </>
                ) : (
                  <span>{effectiveLabel}</span>
                )}
                {isLabelPending && (
                  <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">Label pending</span>
                )}
                {item.labelStatus === 'source_changed' && (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Source description changed</span>
                )}
                {!item.isActive && (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Removed</span>
                )}
              </div>
              <ItemOperationalFields item={item} options={options} canManage={canManage && item.isActive} />
            </div>
          )
        })}
      </div>
    </section>
  )
}

function ItemOperationalFields({
  item,
  options,
  canManage,
}: {
  item: WorkOrderItemSummaryRow
  options: WorkOrderItemOptions
  canManage: boolean
}) {
  const itemLabel = item.itemCode ?? 'item'
  const fields: Array<{
    field: WorkOrderItemOperationalField
    value: string
    options?: FilterOption[]
    type?: 'date'
  }> = [
    { field: 'installer', value: item.installerId ?? '', options: options.installers },
    { field: 'stage', value: item.stageOptionId ?? '', options: options.stages },
    { field: 'hardware', value: item.hardwareStatusOptionId ?? '', options: options.hardwareStatuses },
    { field: 'maintenanceProgram', value: item.maintenanceProgram ? 'yes' : 'no', options: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }] },
    { field: 'installDate', value: item.installDate ?? '', type: 'date' },
    { field: 'dateCompleted', value: item.dateCompleted ?? '', type: 'date' },
    { field: 'risk', value: item.riskLevel ?? '', options: levelOptions() },
    { field: 'importance', value: item.importance ?? '', options: levelOptions() },
  ]

  return (
    <dl className="mt-2 grid gap-2 border-t border-gray-200 pt-2 md:col-span-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
      {fields.map((definition) => {
        const label = operationalFieldLabel(definition.field)
        if (!canManage) {
          return (
            <div key={definition.field}>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</dt>
              <dd className="mt-1 text-xs text-gray-900">{readOnlyOperationalValue(item, definition.field)}</dd>
            </div>
          )
        }

        return (
          <EditableOperationalField
            key={`${definition.field}:${definition.value}`}
            itemId={item.id}
            workOrderId={item.workOrderId}
            itemLabel={itemLabel}
            field={definition.field}
            initialValue={definition.value}
            options={definition.options}
            type={definition.type}
          />
        )
      })}
    </dl>
  )
}

function EditableOperationalField({
  itemId,
  workOrderId,
  itemLabel,
  field,
  initialValue,
  options,
  type,
}: {
  itemId: string
  workOrderId: string
  itemLabel: string
  field: WorkOrderItemOperationalField
  initialValue: string
  options?: FilterOption[]
  type?: 'date'
}) {
  const [value, setValue] = useState(initialValue)
  const [persistedValue, setPersistedValue] = useState(initialValue)
  const [retryValue, setRetryValue] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [bulkMessage, setBulkMessage] = useState<string | null>(null)
  const label = operationalFieldLabel(field)

  async function save(nextValue: string) {
    setValue(nextValue)
    setStatus('saving')
    setErrorMessage(null)

    try {
      await updateWorkOrderItemOperationalFieldAction(itemId, field, nextValue)
      setPersistedValue(nextValue)
      setRetryValue(null)
      setStatus('saved')
    } catch (error) {
      setValue(persistedValue)
      setRetryValue(nextValue)
      setErrorMessage(error instanceof Error ? error.message : `${label} could not be saved.`)
      setStatus('error')
    }
  }

  async function bulkApply() {
    if (!window.confirm(`Apply ${label} from ${itemLabel} to all active items in this Work Order?`)) return
    setBulkMessage('Applying...')
    try {
      const result = await bulkApplyWorkOrderItemOperationalFieldAction(workOrderId, itemId, field)
      setBulkMessage(`Applied to ${result.changedCount} ${result.changedCount === 1 ? 'item' : 'items'}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : `${label} could not be bulk applied.`
      setBulkMessage(`Bulk apply failed: ${message}`)
    }
  }

  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-1">
        {type === 'date' ? (
          <input
            aria-label={`${label} for ${itemLabel}`}
            type="date"
            value={value}
            onChange={(event) => void save(event.target.value)}
            className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-950"
          />
        ) : (
          <select
            aria-label={`${label} for ${itemLabel}`}
            value={value}
            onChange={(event) => void save(event.target.value)}
            className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-950"
          >
            {field !== 'maintenanceProgram' && <option value="">None</option>}
            {options?.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        )}
        <SaveStatus
          status={status}
          errorMessage={errorMessage}
          onRetry={retryValue === null ? null : () => void save(retryValue)}
        />
        <button
          type="button"
          aria-label={`Apply ${label} to all active items`}
          onClick={() => void bulkApply()}
          className="mt-1 text-[11px] font-medium text-sky-800 underline"
        >
          Apply to all active items
        </button>
        {bulkMessage && <span className="mt-1 block text-[11px] text-gray-600">{bulkMessage}</span>}
      </dd>
    </div>
  )
}

function SaveStatus({
  status,
  errorMessage,
  onRetry,
}: {
  status: 'idle' | 'saving' | 'saved' | 'error'
  errorMessage: string | null
  onRetry: (() => void) | null
}) {
  if (status === 'idle') return null
  if (status === 'saving') return <span className="mt-1 block text-[11px] text-sky-700">Saving</span>
  if (status === 'saved') return <span className="mt-1 block text-[11px] text-green-700">Saved</span>
  return (
    <span className="mt-1 block text-[11px] text-red-700" role="alert">
      {errorMessage ?? 'Save failed.'}{' '}
      {onRetry && <button type="button" onClick={onRetry} className="font-semibold underline">Retry</button>}
    </span>
  )
}

function readOnlyOperationalValue(item: WorkOrderItemSummaryRow, field: WorkOrderItemOperationalField) {
  if (field === 'installer') return item.installerName ?? '-'
  if (field === 'stage') return item.stageName ?? '-'
  if (field === 'hardware') return item.hardwareStatusName ?? '-'
  if (field === 'maintenanceProgram') return item.maintenanceProgram ? 'Yes' : 'No'
  if (field === 'installDate') return item.installDate ?? '-'
  if (field === 'dateCompleted') return item.dateCompleted ?? '-'
  if (field === 'risk') return item.riskLevel ? titleCase(item.riskLevel) : '-'
  return item.importance ? titleCase(item.importance) : '-'
}

function levelOptions(): FilterOption[] {
  return [
    { id: 'high', label: 'High' },
    { id: 'medium', label: 'Medium' },
    { id: 'low', label: 'Low' },
  ]
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function ItemCount({ count }: { count: number }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
      {count} active {count === 1 ? 'item' : 'items'}
    </p>
  )
}

function formatQuantity(quantity: string) {
  const parsed = Number(quantity)
  return Number.isFinite(parsed) ? String(parsed) : quantity
}

function truncateDescription(description: string) {
  return description.length > 80 ? `${description.slice(0, 77)}...` : description
}
