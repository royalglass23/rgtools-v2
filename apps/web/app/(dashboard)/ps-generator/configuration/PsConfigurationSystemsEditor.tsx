'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'

export type PsConfigurationSystemRow = {
  id: string
  slug: string
  displayName: string
  isActive: boolean
  heightRules: {
    default: {
      height: string
      heightAboveFix: string
    }
    pool: {
      height: string
      heightAboveFix: string
    }
  }
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
  const router = useRouter()
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
              <th className="px-4 py-3">Height above floor</th>
              <th className="px-4 py-3">Height above fixing</th>
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
                  onSubmitted={() => {
                    setEditingId(null)
                    router.refresh()
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <tr key={system.id} className="bg-white">
                  <td className="px-4 py-3 font-medium text-gray-950">{system.displayName}</td>
                  <td className="px-4 py-3 text-gray-700">{heightText(system.heightRules.default.height)}</td>
                  <td className="px-4 py-3 text-gray-700">{heightText(system.heightRules.default.heightAboveFix)}</td>
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
                onSubmitted={() => {
                  setAdding(false)
                  router.refresh()
                }}
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
  onSubmitted,
  onCancel,
}: {
  configVersionId: string
  action: (formData: FormData) => void | Promise<void>
  onSubmitted: () => void
  onCancel: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <tr className="bg-sky-50 align-top">
      <td colSpan={7} className="px-4 py-3">
        <form
          onSubmit={(event) => void submitSystemForm({
            event,
            action,
            configVersionId,
            systemPart: (formData) => slugify(String(formData.get('displayName') ?? '')),
            setSaving,
            setError,
            onSubmitted,
          })}
          className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_0.8fr_1fr_1fr_auto_auto] md:items-end"
        >
          <input type="hidden" name="configVersionId" value={configVersionId} />
          <label className="text-sm font-medium text-gray-700">
            Name
            <input name="displayName" required disabled={saving} className="mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950" />
          </label>
          <HeightInput name="defaultHeight" label="Height above floor" disabled={saving} />
          <HeightInput name="defaultHeightAboveFix" label="Height above fixing" disabled={saving} />
          <label className="text-sm font-medium text-gray-700">
            Template
            <input name="standardPs1Template" type="file" accept="application/pdf,.pdf" required disabled={saving} className="mt-1 block w-full text-sm text-gray-700" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Pool template
            <input name="poolPs1Template" type="file" accept="application/pdf,.pdf" disabled={saving} className="mt-1 block w-full text-sm text-gray-700" />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm font-medium text-gray-700">
            <input type="checkbox" name="isActive" defaultChecked disabled={saving} className="h-4 w-4 rounded border-gray-300" />
            Active
          </label>
          <span className="flex gap-2">
            <button type="submit" disabled={saving} className="rounded bg-gray-950 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300">{saving ? 'Saving' : 'Save'}</button>
            <button type="button" disabled={saving} onClick={onCancel} className="rounded border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:bg-gray-100">Cancel</button>
          </span>
          {error ? <p className="text-sm font-medium text-red-700 md:col-span-7">{error}</p> : null}
        </form>
      </td>
    </tr>
  )
}

function EditableSystemRow({
  configVersionId,
  system,
  action,
  onSubmitted,
  onCancel,
}: {
  configVersionId: string
  system: PsConfigurationSystemRow
  action: (formData: FormData) => void | Promise<void>
  onSubmitted: () => void
  onCancel: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <tr className="bg-sky-50 align-top">
      <td colSpan={7} className="px-4 py-3">
        <form
          onSubmit={(event) => void submitSystemForm({
            event,
            action,
            configVersionId,
            systemPart: () => system.id,
            setSaving,
            setError,
            onSubmitted,
          })}
          className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_0.8fr_1fr_1fr_auto_auto] md:items-end"
        >
          <input type="hidden" name="configVersionId" value={configVersionId} />
          <input type="hidden" name="systemId" value={system.id} />
          <label className="text-sm font-medium text-gray-700">
            Name
            <input name="displayName" required defaultValue={system.displayName} disabled={saving} className="mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950" />
          </label>
          <HeightInput name="defaultHeight" label="Height above floor" defaultValue={system.heightRules.default.height} disabled={saving} />
          <HeightInput name="defaultHeightAboveFix" label="Height above fixing" defaultValue={system.heightRules.default.heightAboveFix} disabled={saving} />
          <label className="text-sm font-medium text-gray-700">
            Template
            <span className="mt-1 block text-xs font-normal text-gray-500">{templateText(system.standardPs1Template)}</span>
            <input name="standardPs1Template" type="file" accept="application/pdf,.pdf" disabled={saving} className="mt-1 block w-full text-sm text-gray-700" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Pool template
            <span className="mt-1 block text-xs font-normal text-gray-500">{templateText(system.poolPs1Template)}</span>
            <input name="poolPs1Template" type="file" accept="application/pdf,.pdf" disabled={saving} className="mt-1 block w-full text-sm text-gray-700" />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm font-medium text-gray-700">
            <input type="checkbox" name="isActive" defaultChecked={system.isActive} disabled={saving} className="h-4 w-4 rounded border-gray-300" />
            Active
          </label>
          <span className="flex gap-2">
            <button type="submit" disabled={saving} className="rounded bg-gray-950 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300">{saving ? 'Saving' : 'Save'}</button>
            <button type="button" disabled={saving} onClick={onCancel} className="rounded border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:bg-gray-100">Cancel</button>
          </span>
          {error ? <p className="text-sm font-medium text-red-700 md:col-span-7">{error}</p> : null}
        </form>
      </td>
    </tr>
  )
}

async function submitSystemForm(input: {
  event: FormEvent<HTMLFormElement>
  action: (formData: FormData) => void | Promise<void>
  configVersionId: string
  systemPart: (formData: FormData) => string
  setSaving: (saving: boolean) => void
  setError: (error: string | null) => void
  onSubmitted: () => void
}) {
  input.event.preventDefault()
  input.setSaving(true)
  input.setError(null)

  const form = input.event.currentTarget
  const formData = new FormData(form)
  appendSelectedFile(form, formData, 'standardPs1Template')
  appendSelectedFile(form, formData, 'poolPs1Template')
  const systemPart = input.systemPart(formData)

  try {
    if (!systemPart) throw new Error('System name is required.')
    await prepareDirectTemplateUpload(formData, input.configVersionId, systemPart, 'standardPs1Template', 'standard_ps1')
    await prepareDirectTemplateUpload(formData, input.configVersionId, systemPart, 'poolPs1Template', 'pool_ps1')
    await input.action(formData)
    input.onSubmitted()
  } catch (error) {
    input.setError(error instanceof Error ? error.message : 'Unable to save system.')
  } finally {
    input.setSaving(false)
  }
}

function appendSelectedFile(
  form: HTMLFormElement,
  formData: FormData,
  fieldName: 'standardPs1Template' | 'poolPs1Template',
) {
  const current = formData.get(fieldName)
  if (current instanceof File && current.size > 0) return

  const input = form.elements.namedItem(fieldName)
  if (!(input instanceof HTMLInputElement)) return
  const file = input.files?.[0]
  if (file && file.size > 0) formData.set(fieldName, file)
}

async function prepareDirectTemplateUpload(
  formData: FormData,
  configVersionId: string,
  systemPart: string,
  fieldName: 'standardPs1Template' | 'poolPs1Template',
  variantKind: 'standard_ps1' | 'pool_ps1',
) {
  const value = formData.get(fieldName)
  if (!(value instanceof File) || value.size === 0) {
    formData.delete(fieldName)
    return
  }
  if (value.type && value.type !== 'application/pdf') throw new Error('Template upload must be a PDF.')

  const ticketResponse = await fetch('/api/ps-generator/template-upload', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      configVersionId,
      systemPart,
      variantKind,
      filename: value.name,
      contentType: value.type || 'application/pdf',
      size: value.size,
    }),
  })
  const ticket = await ticketResponse.json() as {
    objectKey?: string
    originalFilename?: string
    uploadUrl?: string
    headers?: Record<string, string>
    error?: string
  }
  if (!ticketResponse.ok || !ticket.objectKey || !ticket.originalFilename || !ticket.uploadUrl) {
    throw new Error(ticket.error ?? 'Unable to prepare template upload.')
  }

  const uploadResponse = await fetch(ticket.uploadUrl, {
    method: 'PUT',
    headers: ticket.headers ?? { 'content-type': 'application/pdf' },
    body: value,
  })
  if (!uploadResponse.ok) throw new Error('Unable to upload template PDF.')

  formData.delete(fieldName)
  formData.set(`${fieldName}ObjectKey`, ticket.objectKey)
  formData.set(`${fieldName}OriginalFilename`, ticket.originalFilename)
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function templateText(template: PsConfigurationSystemRow['standardPs1Template']) {
  return template?.originalFilename ?? template?.label ?? 'Not uploaded'
}

function heightText(value: string) {
  return value || 'Not set'
}

function HeightInput({
  name,
  label,
  defaultValue = '',
  disabled,
}: {
  name: string
  label: string
  defaultValue?: string
  disabled: boolean
}) {
  return (
    <label className="text-sm font-medium text-gray-700">
      {label}
      <input
        name={name}
        aria-label={label}
        defaultValue={defaultValue}
        required
        disabled={disabled}
        inputMode="decimal"
        className="mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950"
      />
    </label>
  )
}
