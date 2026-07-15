'use client'

import { useState, useTransition } from 'react'
import { createTestError } from './actions'
import { DismissibleNotice } from '@/modules/ui/DismissibleNotice'

export function TestErrorButton() {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  function handleClick() {
    setMessage(null)
    startTransition(async () => {
      const result = await createTestError()
      if ('error' in result) {
        setMessage(result.error)
        return
      }

      setMessage(`Created test error: ${result.errorId}`)
      window.location.reload()
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="px-4 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? 'Creating...' : 'Create Test Error'}
      </button>
      {message && (
        <DismissibleNotice tone={message.startsWith('Created') ? 'success' : 'error'} noticeKey={message}>
          <span className="font-mono text-xs">{message}</span>
        </DismissibleNotice>
      )}
    </div>
  )
}
