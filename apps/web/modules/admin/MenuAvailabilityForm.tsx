'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { updateMenuAvailability } from '@/modules/admin/actions'
import {
  MENU_DEFINITIONS,
  type MenuAvailability,
  type MenuKey,
  type MenuRole,
} from '@/lib/menu-availability'

interface MenuAvailabilityFormProps {
  menuAvailability: MenuAvailability
}

export function MenuAvailabilityForm({ menuAvailability }: MenuAvailabilityFormProps) {
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)

    setStatus(null)
    startTransition(async () => {
      const result = await updateMenuAvailability(formData)
      if ('error' in result) {
        setStatus({
          kind: 'error',
          message: `Menu availability could not be saved. ${result.error}`,
        })
        return
      }

      setStatus({ kind: 'success', message: 'Menu availability saved.' })
    })
  }

  return (
    <>
      {status && (
        <div
          className={`mb-4 rounded border px-4 py-3 text-sm ${
            status.kind === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {status.message}
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        onChange={() => setStatus(null)}
        className="overflow-hidden rounded border border-gray-200 bg-white shadow-sm"
      >
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                Menu
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                Staff
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                Admin
              </th>
            </tr>
          </thead>
          <tbody>
            {MENU_DEFINITIONS.map((menu) => (
              <tr key={menu.key} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-3 font-medium text-gray-900">{menu.label}</td>
                <td className="px-4 py-3">
                  <MenuAvailabilityCheckbox
                    role="staff"
                    menuKey={menu.key}
                    checked={menuAvailability.staff[menu.key]}
                    disabled={menu.key === 'admin'}
                  />
                </td>
                <td className="px-4 py-3">
                  <MenuAvailabilityCheckbox
                    role="admin"
                    menuKey={menu.key}
                    checked={menuAvailability.admin[menu.key]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-end border-t border-gray-100 px-4 py-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-[#142B3A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1d3d52] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? 'Saving...' : 'Save menu availability'}
          </button>
        </div>
      </form>
    </>
  )
}

function MenuAvailabilityCheckbox({
  role,
  menuKey,
  checked,
  disabled = false,
}: {
  role: MenuRole
  menuKey: MenuKey
  checked: boolean
  disabled?: boolean
}) {
  const id = `menu-${role}-${menuKey}`

  return (
    <input
      id={id}
      name={`menu:${role}:${menuKey}`}
      type="checkbox"
      aria-label={`${role} ${menuKey} menu`}
      defaultChecked={checked}
      disabled={disabled}
      className="h-4 w-4 rounded border-gray-300 text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
    />
  )
}
