'use client'

import { useState } from 'react'

export function CopyLinkButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      onClick={async (event) => {
        event.stopPropagation()
        await navigator.clipboard.writeText(value)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1600)
      }}
      className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
    >
      {copied ? 'Copied' : label}
    </button>
  )
}
