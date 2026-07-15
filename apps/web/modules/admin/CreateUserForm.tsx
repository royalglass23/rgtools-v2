'use client'

import { useState, useTransition } from 'react'
import { createUser } from './actions'
import { DismissibleNotice } from '@/modules/ui/DismissibleNotice'

export function CreateUserForm() {
  const [isPending, startTransition] = useTransition()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'staff'>('staff')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!username.trim()) {
      setError('Username is required.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    startTransition(async () => {
      const result = await createUser({ username: username.trim(), password, role })
      if ('error' in result) {
        setError(result.error)
      } else {
        setSuccess(true)
        setUsername('')
        setPassword('')
        setRole('staff')
        // Reload to refresh user list
        window.location.reload()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <DismissibleNotice tone="error" noticeKey={error}>
          {error}
        </DismissibleNotice>
      )}
      {success && (
        <DismissibleNotice tone="success" noticeKey="user-created">
          User created successfully.
        </DismissibleNotice>
      )}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600" htmlFor="new-username">
            Username
          </label>
          <input
            id="new-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g. jsmith"
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600" htmlFor="new-password">
            Initial Password
          </label>
          <input
            id="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Min. 6 characters"
            autoComplete="new-password"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600" htmlFor="new-role">
            Role
          </label>
          <select
            id="new-role"
            value={role}
            onChange={(e) => setRole(e.target.value as 'admin' | 'staff')}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? 'Creating…' : 'Create User'}
        </button>
      </div>
    </form>
  )
}
