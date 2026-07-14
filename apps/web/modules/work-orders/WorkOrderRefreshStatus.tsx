export type WorkOrderRefreshStatusValue = {
  lastSuccessfulAt: Date | null
  lastSuccessfulJobCount: number
  lastSuccessfulItemCount: number
  lastSuccessfulExcludedLineCount: number
  latestFailure: {
    at: Date
    message: string
  } | null
}

export function WorkOrderRefreshStatus({ status }: { status: WorkOrderRefreshStatusValue }) {
  if (!status.lastSuccessfulAt && !status.latestFailure) return null

  return (
    <div className="space-y-2">
      {status.lastSuccessfulAt && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <span className="font-medium">Last successful sync: {formatDateTime(status.lastSuccessfulAt)}</span>
          <span>{status.lastSuccessfulJobCount} jobs</span>
          <span>{status.lastSuccessfulItemCount} items</span>
          <span>{status.lastSuccessfulExcludedLineCount} billing lines excluded</span>
        </div>
      )}
      {status.latestFailure && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="font-medium">Latest refresh failed:</span> {status.latestFailure.message}
        </div>
      )}
    </div>
  )
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat('en-NZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Pacific/Auckland',
  }).format(value)
}
