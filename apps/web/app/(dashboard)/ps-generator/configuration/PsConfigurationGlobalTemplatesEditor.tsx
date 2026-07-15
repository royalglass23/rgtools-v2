'use client'

import { useRouter } from 'next/navigation'
import { DismissibleNotice } from '@/modules/ui/DismissibleNotice'
import { type FormEvent, useState } from 'react'

export type PsConfigurationGlobalTemplate = {
  id: string
  label: string
  originalFilename: string | null
  r2ObjectKey: string
} | null

type PsConfigurationGlobalTemplatesEditorProps = {
  configVersionId: string
  ps3Template: PsConfigurationGlobalTemplate
  isDraft: boolean
  updateAction: (formData: FormData) => void | Promise<void>
}

export function PsConfigurationGlobalTemplatesEditor({
  configVersionId,
  ps3Template,
  isDraft,
  updateAction,
}: PsConfigurationGlobalTemplatesEditorProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <details className="rounded border border-gray-200 bg-white shadow-sm" open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 border-b border-gray-100 px-4 py-3">
        <span>
          <span className="block text-base font-semibold text-gray-950">Global templates</span>
          <span className="mt-1 block text-xs text-gray-500">Shared documents used across every system</span>
        </span>
      </summary>
      <form
        onSubmit={(event) => void submitGlobalTemplateForm({
          event,
          action: updateAction,
          configVersionId,
          setSaving,
          setError,
          onSubmitted: () => router.refresh(),
        })}
        className="grid gap-4 px-4 py-4 md:grid-cols-[1fr_auto] md:items-end"
      >
        <input type="hidden" name="configVersionId" value={configVersionId} />
        {ps3Template ? <input type="hidden" name="templateVariantId" value={ps3Template.id} /> : null}
        <label className="text-sm font-medium text-gray-700">
          PS3 template
          <span className="mt-1 block text-xs font-normal text-gray-500">{templateText(ps3Template)}</span>
          <input
            name="ps3Template"
            type="file"
            accept="application/pdf,.pdf"
            required={!ps3Template}
            disabled={!isDraft || saving}
            className="mt-2 block w-full text-sm text-gray-700"
          />
        </label>
        <button
          type="submit"
          disabled={!isDraft || saving}
          className="rounded bg-gray-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {saving ? 'Saving' : 'Save PS3'}
        </button>
        {error ? (
          <div className="md:col-span-2">
            <DismissibleNotice tone="error" noticeKey={error}>{error}</DismissibleNotice>
          </div>
        ) : null}
      </form>
    </details>
  )
}

async function submitGlobalTemplateForm(input: {
  event: FormEvent<HTMLFormElement>
  action: (formData: FormData) => void | Promise<void>
  configVersionId: string
  setSaving: (saving: boolean) => void
  setError: (error: string | null) => void
  onSubmitted: () => void
}) {
  input.event.preventDefault()
  input.setSaving(true)
  input.setError(null)

  const form = input.event.currentTarget
  const formData = new FormData(form)
  appendSelectedFile(form, formData)

  try {
    await prepareDirectPs3Upload(formData, input.configVersionId)
    await input.action(formData)
    input.onSubmitted()
  } catch (error) {
    input.setError(error instanceof Error ? error.message : 'Unable to save PS3 template.')
  } finally {
    input.setSaving(false)
  }
}

function appendSelectedFile(form: HTMLFormElement, formData: FormData) {
  const current = formData.get('ps3Template')
  if (current instanceof File && current.size > 0) return

  const input = form.elements.namedItem('ps3Template')
  if (!(input instanceof HTMLInputElement)) return
  const file = input.files?.[0]
  if (file && file.size > 0) formData.set('ps3Template', file)
}

async function prepareDirectPs3Upload(formData: FormData, configVersionId: string) {
  const value = formData.get('ps3Template')
  if (!(value instanceof File) || value.size === 0) {
    formData.delete('ps3Template')
    return
  }
  if (value.type && value.type !== 'application/pdf') throw new Error('Template upload must be a PDF.')

  const ticketResponse = await fetch('/api/ps-generator/template-upload', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      configVersionId,
      systemPart: 'global',
      variantKind: 'ps3',
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

  formData.delete('ps3Template')
  formData.set('ps3TemplateObjectKey', ticket.objectKey)
  formData.set('ps3TemplateOriginalFilename', ticket.originalFilename)
}

function templateText(template: PsConfigurationGlobalTemplate) {
  return template?.originalFilename ?? template?.label ?? 'Not uploaded'
}
