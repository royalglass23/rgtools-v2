'use client'

import { regenerateWorkOrderItemLabelAction, updateWorkOrderItemLabelAction } from './actions'
import type { WorkOrderItemSummaryRow } from './work-order-items'

export function WorkOrderItemsSummary({
  items,
  showCount = true,
  canManage = false,
}: {
  items: WorkOrderItemSummaryRow[]
  showCount?: boolean
  canManage?: boolean
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
            </div>
          )
        })}
      </div>
    </section>
  )
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
