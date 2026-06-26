'use client'

import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[dashboard-error]', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    })
  }, [error])

  return (
    <div className="max-w-lg mx-auto mt-16 bg-white border border-red-200 rounded p-8 text-center">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h2>
      <p className="text-sm text-gray-500 mb-6">
        There was a problem loading this page. This is usually a temporary issue.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
      >
        Try again
      </button>
      {error.digest && (
        <p className="mt-4 text-xs text-gray-400 font-mono">ref: {error.digest}</p>
      )}
    </div>
  )
}
