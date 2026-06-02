'use client'

import { useState, useTransition } from 'react'
import { updateUserRole, deleteUser } from './actions'

interface UserRowModule {
  id: string
  slug: string
  name: string
  adminOnly: boolean
  isActive: boolean
}

interface UserRowProps {
  user: {
    id: string
    username: string
    role: 'admin' | 'staff'
    isProtected: boolean
  }
  isCurrentUser: boolean
  isProtectedActor: boolean
  modules: UserRowModule[]
  grantedModuleIds: Set<string>
}

export function UserRow({ user, isCurrentUser, isProtectedActor, modules, grantedModuleIds }: UserRowProps) {
  const [isPendingRole, startRoleTransition] = useTransition()
  const [isPendingDelete, startDeleteTransition] = useTransition()
  const [roleError, setRoleError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [showAccessEditor, setShowAccessEditor] = useState(false)

  // Determine if this user's controls should be disabled
  // Protected users: always disabled
  // Other admins: disabled unless actor is the protected super-user
  const isTargetProtected = user.isProtected
  const isTargetAdmin = user.role === 'admin'
  const canManage =
    !isTargetProtected && (isProtectedActor || !isTargetAdmin)

  function handleRoleChange(newRole: 'admin' | 'staff') {
    setRoleError(null)
    startRoleTransition(async () => {
      const result = await updateUserRole(user.id, newRole)
      if ('error' in result) {
        setRoleError(result.error)
      } else {
        window.location.reload()
      }
    })
  }

  function handleDelete() {
    if (!confirm(`Delete user "${user.username}"? This cannot be undone.`)) return
    setDeleteError(null)
    startDeleteTransition(async () => {
      const result = await deleteUser(user.id)
      if ('error' in result) {
        setDeleteError(result.error)
      } else {
        window.location.reload()
      }
    })
  }

  const disabledReason = isTargetProtected
    ? 'This user is protected and cannot be modified.'
    : isTargetAdmin && !isProtectedActor
      ? 'Only the super-user can manage other admins.'
      : null

  return (
    <>
      <tr className="border-b border-gray-100 hover:bg-gray-50">
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">{user.username}</span>
            {isCurrentUser && (
              <span className="text-xs text-gray-400">(you)</span>
            )}
            {user.isProtected && (
              <span
                title="This user is protected and cannot be modified"
                className="text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded px-1.5 py-0.5"
              >
                Protected
              </span>
            )}
          </div>
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <select
              value={user.role}
              disabled={!canManage || isPendingRole}
              onChange={(e) => handleRoleChange(e.target.value as 'admin' | 'staff')}
              title={disabledReason ?? undefined}
              className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
            {isPendingRole && <span className="text-xs text-gray-400">Saving…</span>}
            {roleError && <span className="text-xs text-red-600">{roleError}</span>}
          </div>
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAccessEditor((v) => !v)}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              {showAccessEditor ? 'Hide' : 'Manage access'}
            </button>
          </div>
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              disabled={!canManage || isPendingDelete}
              title={disabledReason ?? undefined}
              className="text-sm text-red-600 hover:text-red-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isPendingDelete ? 'Deleting…' : 'Delete'}
            </button>
            {deleteError && <span className="text-xs text-red-600">{deleteError}</span>}
          </div>
        </td>
      </tr>
      {showAccessEditor && (
        <tr className="bg-gray-50 border-b border-gray-100">
          <td colSpan={4} className="py-3 px-8">
            <AccessEditor
              userId={user.id}
              userRole={user.role}
              modules={modules}
              grantedModuleIds={grantedModuleIds}
              canManage={canManage}
            />
          </td>
        </tr>
      )}
    </>
  )
}

interface AccessEditorProps {
  userId: string
  userRole: 'admin' | 'staff'
  modules: UserRowModule[]
  grantedModuleIds: Set<string>
  canManage: boolean
}

function AccessEditor({ userId, userRole, modules, grantedModuleIds, canManage }: AccessEditorProps) {
  // Admin-only modules are role-driven; only show non-admin-only modules in editor
  const grantableModules = modules.filter((m) => !m.adminOnly && m.isActive)
  const adminOnlyModules = modules.filter((m) => m.adminOnly && m.isActive)

  if (grantableModules.length === 0 && adminOnlyModules.length === 0) {
    return <p className="text-sm text-gray-500">No modules configured.</p>
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Module Access</p>
      <div className="flex flex-wrap gap-4">
        {grantableModules.map((mod) => (
          <AccessCheckbox
            key={mod.id}
            userId={userId}
            module={mod}
            granted={grantedModuleIds.has(mod.id)}
            canManage={canManage}
          />
        ))}
        {/* Admin-only modules: show locked state depending on role */}
        {adminOnlyModules.map((mod) => (
          <div key={mod.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={userRole === 'admin'}
              disabled
              readOnly
              className="h-4 w-4 opacity-50 cursor-not-allowed"
            />
            <span className="text-sm text-gray-500">
              {mod.name}
              <span className="ml-1 text-xs text-gray-400">(admin-only)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface AccessCheckboxProps {
  userId: string
  module: UserRowModule
  granted: boolean
  canManage: boolean
}

function AccessCheckbox({ userId, module, granted, canManage }: AccessCheckboxProps) {
  // Import setModuleAccess here to avoid top-level import issues with Server Actions in client
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [localGranted, setLocalGranted] = useState(granted)

  function handleChange(checked: boolean) {
    setError(null)
    setLocalGranted(checked) // optimistic
    startTransition(async () => {
      const { setModuleAccess } = await import('./actions')
      const result = await setModuleAccess(userId, module.id, checked)
      if ('error' in result) {
        setLocalGranted(!checked) // revert
        setError(result.error)
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        id={`access-${userId}-${module.id}`}
        checked={localGranted}
        disabled={!canManage || isPending}
        onChange={(e) => handleChange(e.target.checked)}
        className="h-4 w-4 text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <label
        htmlFor={`access-${userId}-${module.id}`}
        className="text-sm text-gray-700 cursor-pointer select-none"
      >
        {module.name}
        {isPending && <span className="ml-1 text-xs text-gray-400">…</span>}
      </label>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
