'use client'

import { useState, type ReactNode } from 'react'

type NoticeTone = 'error' | 'success' | 'warning' | 'info'

const toneClasses: Record<NoticeTone, string> = {
  error: 'border-red-200 bg-red-50 text-red-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-blue-200 bg-blue-50 text-blue-900',
}

export function DismissibleNotice({
  tone,
  noticeKey,
  children,
}: {
  tone: NoticeTone
  noticeKey?: string | number
  children: ReactNode
}) {
  const currentNoticeKey = noticeKey ?? null
  const [dismissedNoticeKey, setDismissedNoticeKey] = useState<string | number | null>()
  if (dismissedNoticeKey === currentNoticeKey) return null

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start justify-between gap-3 rounded border px-4 py-3 text-sm ${toneClasses[tone]}`}
    >
      <div className="min-w-0 flex-1">{children}</div>
      <button
        type="button"
        onClick={() => setDismissedNoticeKey(currentNoticeKey)}
        aria-label="Close notification"
        className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-xl leading-none opacity-70 hover:bg-black/5 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  )
}
