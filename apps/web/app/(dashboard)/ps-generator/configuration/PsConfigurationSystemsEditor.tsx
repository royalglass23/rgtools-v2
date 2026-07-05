'use client'

import { useState } from 'react'

export type PsConfigurationSystemRow = {
  id: string
  slug: string
  displayName: string
  isActive: boolean
  standardPs1Template: {
    id: string
    label: string
    originalFilename: string | null
    r2ObjectKey: string
  } | null
  poolPs1Template: {
    id: string
    label: string
    originalFilename: string | null
    r2ObjectKey: string
  } | null
}

type PsConfigurationSystemsEditorProps = {
  configVersionId: string
  systems: PsConfigurationSystemRow[]
  isDraft: boolean
  createAction: (formData: FormData) => void | Promise<void>
  updateAction: (formData: FormData) => void | Promise<void>
}

export function PsConfigurationSystemsEditor({
  configVersionId,
  systems,
  isDraft,
  createAction,
  updateAction,
}: PsConfigurationSystemsEditorProps) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <details className="rounded border border-gray-200 bg-white shadow-sm" open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 border-b border-gray-100 px-4 py-3">
        <span>
          <span className="block text-base font-semibold text-gray-950">System</span>
          <span className="mt-1 block text-xs text-gray-500">{systems.length} systems</span>
        </span>
        <button
          type="button"
          disabled={!isDraft || adding}
          onClick={(event) => {
            event.preventDefault()
            setAdding(true)
          }}
          className="rounded border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
        >
          Add system
        </button>
      </summary>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Template</th>
              <th className="px-4 py-3">Pool template</th>
              <th className="w-28 px-4 py-3">Active</th>
              <th className="w-32 px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {systems.map((system) => (
              editingId === system.id ? (
                <EditableSystemRow
                  key={system.id}
                  configVersionId={configVersionId}
                  system={system}
                  action={updateAction}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <tr key={system.id} className="bg-white">
                  <td className="px-4 py-3 font-medium text-gray-950">{system.displayName}</td>
                  <td className="px-4 py-3 text-gray-700">{templateText(system.standardPs1Template)}</td>
                  <td className="px-4 py-3 text-gray-700">{templateText(system.poolPs1Template)}</td>
                  <td className="px-4 py-3 text-gray-700">{system.isActive ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={!isDraft}
                      onClick={() => setEditingId(system.id)}
                      className="rounded border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              )
            ))}
            {adding ? (
              <NewSystemRow
                configVersionId={configVersionId}
                action={createAction}
                onCancel={() => setAdding(false)}
              />
            ) : null}
          </tbody>
        </table>
      </div>
    </details>
  )
}

function NewSystemRow({
  configVersionId,
  action,
  onCancel,
}: {
  configVersionId: string
  action: (formData: FormData) => void | Promise<void>
  onCancel: () => void
}) {
  return (
    <tr className="bg-sky-50 align-top">
      <td colSpan={5} className="px-4 py-3">
        <form action={action} className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto_auto] md:items-end">
          <input type="hidden" name="configVersionId" value={configVersionId} />
          <label className="text-sm font-medium text-gray-700">
            Name
            <input name="displayName" required className="mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Template
            <input name="standardPs1Template" type="file" accept="application/pdf,.pdf" required className="mt-1 block w-full text-sm text-gray-700" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Pool template
            <input name="poolPs1Template" type="file" accept="application/pdf,.pdf" className="mt-1 block w-full text-sm text-gray-700" />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm font-medium text-gray-700">
            <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4 rounded border-gray-300" />
            Active
          </label>
          <span className="flex gap-2">
            <button type="submit" className="rounded bg-gray-950 px-3 py-2 text-sm font-semibold text-white">Save</button>
            <button type="button" onClick={onCancel} className="rounded border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700">Cancel</button>
          </span>
        </form>
      </td>
    </tr>
  )
}

function EditableSystemRow({
  configVersionId,
  system,
  action,
  onCancel,
}: {
  configVersionId: string
  system: PsConfigurationSystemRow
  action: (formData: FormData) => void | Promise<void>
  onCancel: () => void
}) {
  return (
    <tr className="bg-sky-50 align-top">
      <td colSpan={5} className="px-4 py-3">
        <form action={action} className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto_auto] md:items-end">
          <input type="hidden" name="configVersionId" value={configVersionId} />
          <input type="hidden" name="systemId" value={system.id} />
          <label className="text-sm font-medium text-gray-700">
            Name
            <input name="displayName" required defaultValue={system.displayName} className="mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Template
            <span className="mt-1 block text-xs font-normal text-gray-500">{templateText(system.standardPs1Template)}</span>
            <input name="standardPs1Template" type="file" accept="application/pdf,.pdf" className="mt-1 block w-full text-sm text-gray-700" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Pool template
            <span className="mt-1 block text-xs font-normal text-gray-500">{templateText(system.poolPs1Template)}</span>
            <input name="poolPs1Template" type="file" accept="application/pdf,.pdf" className="mt-1 block w-full text-sm text-gray-700" />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm font-medium text-gray-700">
            <input type="checkbox" name="isActive" defaultChecked={system.isActive} className="h-4 w-4 rounded border-gray-300" />
            Active
          </label>
          <span className="flex gap-2">
            <button type="submit" className="rounded bg-gray-950 px-3 py-2 text-sm font-semibold text-white">Save</button>
            <button type="button" onClick={onCancel} className="rounded border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700">Cancel</button>
          </span>
        </form>
      </td>
    </tr>
  )
}

function templateText(template: PsConfigurationSystemRow['standardPs1Template']) {
  return template?.originalFilename ?? template?.label ?? 'Not uploaded'
}
