'use client'

import { useState } from 'react'

type EmailGateSettingsFormProps = {
  action: (formData: FormData) => void | Promise<void>
  enabled: boolean
  recipientEmails: string
}

export function EmailGateSettingsForm({
  action,
  enabled,
  recipientEmails,
}: EmailGateSettingsFormProps) {
  const [isEnabled, setIsEnabled] = useState(enabled)
  const [emails, setEmails] = useState(recipientEmails)

  return (
    <form action={action} className="grid gap-3 border-t border-gray-100 pt-4 md:grid-cols-[160px_minmax(260px,1fr)_auto]">
      <label className="flex items-center gap-2 self-end rounded border border-gray-200 px-3 py-2 text-sm text-gray-800">
        <input
          type="checkbox"
          name="emailGateEnabled"
          checked={isEnabled}
          onChange={(event) => {
            const checked = event.target.checked
            setIsEnabled(checked)
            if (!checked) setEmails('')
          }}
          className="h-4 w-4 rounded border-gray-300"
        />
        Email gate
      </label>
      {isEnabled && (
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Recipient emails</span>
          <textarea
            name="recipientEmails"
            value={emails}
            onChange={(event) => setEmails(event.target.value)}
            placeholder="client@example.co.nz, manager@example.co.nz; accounts@example.co.nz"
            rows={2}
            required
            className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950"
          />
        </label>
      )}
      <button
        type="submit"
        className="self-end rounded bg-[#142B3A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1d3d52]"
      >
        Save gate
      </button>
    </form>
  )
}
