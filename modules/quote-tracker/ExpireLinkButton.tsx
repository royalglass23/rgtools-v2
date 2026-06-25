'use client'

import { useState } from 'react'
import { expireQuoteLinkAction } from './actions'

export function ExpireLinkButton({ quoteId }: { quoteId: string }) {
  const [pending, setPending] = useState(false)

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        if (!window.confirm('Expire this link? The client will no longer be able to open it.')) return
        setPending(true)
        await expireQuoteLinkAction(quoteId)
        setPending(false)
      }}
      className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
    >
      {pending ? 'Expiring…' : 'Expire link'}
    </button>
  )
}
