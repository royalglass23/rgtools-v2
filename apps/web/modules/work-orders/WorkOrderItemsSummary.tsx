import type { WorkOrderItemSummaryRow } from './work-order-items'

export function WorkOrderItemsSummary({ items }: { items: WorkOrderItemSummaryRow[] }) {
  if (items.length === 0) {
    return (
      <section aria-label="Work Order items" className="space-y-2 px-4 py-3">
        <ItemCount count={0} />
        <p className="rounded border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-sm text-gray-600">
          No items synced from ServiceM8 yet
        </p>
      </section>
    )
  }

  const activeItemCount = items.filter((item) => item.isActive).length

  return (
    <section aria-label="Work Order items" className="space-y-2 px-4 py-3">
      <ItemCount count={activeItemCount} />
      <div className="grid gap-2">
        {items.map((item) => {
          const effectiveLabel = item.manualLabelOverride ?? item.generatedLabel ?? item.originalDescription
          const hoverDetail = item.lineTotalExcludingGst
            ? `${item.originalDescription}\nLine total excluding GST: $${item.lineTotalExcludingGst}`
            : item.originalDescription

          return (
            <div
              key={item.id}
              title={hoverDetail}
              className={`grid gap-1 rounded border px-3 py-2 text-sm md:grid-cols-[90px_160px_1fr] ${item.isActive ? 'border-gray-200 bg-gray-50' : 'border-amber-200 bg-amber-50'}`}
            >
              <span className="font-medium text-gray-700">Qty {formatQuantity(item.quantity)}</span>
              <span className="font-mono text-xs text-gray-600">{item.itemCode ?? 'No item code'}</span>
              <span className="flex items-center gap-2 text-gray-950">
                {effectiveLabel}
                {!item.isActive && (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Removed</span>
                )}
              </span>
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
