'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  useEffect(() => {
    console.error('[global-error]', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    })
  }, [error])

  return (
    <html lang="en">
      <body>
        <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="max-w-lg bg-white border border-red-200 rounded p-8 text-center">
            <h1 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-500 mb-4">
              Refresh the page and check the latest system error entry.
            </p>
            {error.digest && (
              <p className="text-xs text-gray-400 font-mono">ref: {error.digest}</p>
            )}
          </div>
        </main>
      </body>
    </html>
  )
}
