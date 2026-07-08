'use client'

import { useActionState } from 'react'
import {
  refreshServiceM8ClientsAction,
  type ServiceM8ClientsImportActionState,
} from './servicem8-import-actions'

export function ServiceM8ClientsImportButton() {
  const [state, formAction, pending] = useActionState<ServiceM8ClientsImportActionState, FormData>(
    refreshServiceM8ClientsAction,
    null,
  )

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-[#142B3A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1d3d52] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Refreshing...' : 'Refresh from ServiceM8'}
        </button>
      </form>
      {state && 'success' in state && (
        <p className="text-sm text-gray-600">
          Imported {state.summary.created} new, updated {state.summary.sourceUpdated}, needs review {state.summary.needsReview}, skipped {state.summary.skipped}, errors {state.summary.errors}.
        </p>
      )}
      {state && 'error' in state && (
        <p className="text-sm text-red-700">
          ServiceM8 Clients import failed: {state.error}
        </p>
      )}
    </div>
  )
}
