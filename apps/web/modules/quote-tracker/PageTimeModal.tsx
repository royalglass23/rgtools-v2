'use client'

import type { DeviceSession } from './viewer-analytics'
import { formatDuration, maskIp } from './presentation'

export function PageTimeModal({
  device,
  onClose,
}: {
  device: DeviceSession
  onClose: () => void
}) {
  const maxMs = Math.max(1, ...device.perPage.map((page) => page.activeMs))
  const hasTiming = device.perPage.some((page) => page.activeMs > 0)
  const deviceLabel = device.deviceType
    ? device.deviceType.charAt(0).toUpperCase() + device.deviceType.slice(1)
    : 'Unknown device'
  const headerParts = [
    deviceLabel,
    device.geoCity ?? device.geoCountry,
    device.geoIsp,
    maskIp(device.ip),
  ].filter(Boolean)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Per-page time"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose()
      }}
    >
      <div
        className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="text-base font-semibold text-gray-950">
            {headerParts.join(' · ')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded px-2 text-gray-400 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {device.perPage.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No pages recorded for this visit.</p>
        ) : (
          <>
            {!hasTiming && (
              <p className="mt-2 text-xs text-gray-500">
                Per-page timing isn’t available for this visit; pages seen are listed below.
              </p>
            )}
            <ul className="mt-4 space-y-2">
              {device.perPage.map((page) => (
                <li key={page.pageNumber} className="flex items-center gap-3 text-sm">
                  <span className="w-16 shrink-0 text-gray-500">Page {page.pageNumber}</span>
                  <span className="h-3 flex-1 overflow-hidden rounded bg-gray-100">
                    <span
                      className="block h-full rounded bg-[#142B3A]"
                      style={{ width: `${Math.max(2, (page.activeMs / maxMs) * 100)}%` }}
                    />
                  </span>
                  <span className="w-16 shrink-0 text-right text-gray-700">
                    {formatDuration(page.activeMs)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
