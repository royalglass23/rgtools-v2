import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireModule } from '@/lib/guard'
import {
  addWorkOrderTimelineNoteAction,
  generateWorkOrderAiSuggestionAction,
  updateWorkOrderOperationalFieldsAction,
} from '@/modules/work-orders/actions'
import { WORK_ORDER_AI_SUGGESTION_COOLDOWN_MS } from '@/modules/work-orders/domain'
import { getCurrentWorkOrderPermissions } from '@/modules/work-orders/permissions'
import { getWorkOrderDetail, getWorkOrderFilterOptions, type WorkOrderDetail } from '@/modules/work-orders/queries'
import {
  DataPanel,
  PageHeader,
  PrecisionButton,
  StatusBadge,
  precisionControlClassName,
} from '@/components/precision-ui/PrecisionUI'

export default async function WorkOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireModule('work-orders')
  const { id } = await params
  const notices = await searchParams
  const [detail, options, permissions] = await Promise.all([
    getWorkOrderDetail(id),
    getWorkOrderFilterOptions(),
    getCurrentWorkOrderPermissions(),
  ])

  if (!detail) notFound()
  const aiCooldownUntil = detail.aiSuggestionAt
    ? new Date(detail.aiSuggestionAt.getTime() + WORK_ORDER_AI_SUGGESTION_COOLDOWN_MS)
    : null
  const aiCooldownActive = Boolean(aiCooldownUntil && aiCooldownUntil > new Date())
  const redirectedCooldownUntil = typeof notices.aiRefreshCooldownUntil === 'string'
    ? formatDateTime(new Date(notices.aiRefreshCooldownUntil))
    : null

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Work Order detail"
        title={detail.clientName}
        description={<>
          <Link href="/work-orders" className="font-medium text-brand hover:underline">Back to Work Orders</Link>
          {detail.companyName && <span className="ml-3 text-text-muted">{detail.companyName}</span>}
        </>}
        actions={<div className="flex flex-wrap gap-2">
          <StatusBadge tone={detail.isCurrent ? 'positive' : 'muted'}>{detail.isCurrent ? 'Current' : 'Non-current'}</StatusBadge>
          <StatusBadge tone={detail.servicem8Active ? 'info' : 'muted'}>{detail.servicem8Active ? 'ServiceM8 active' : 'ServiceM8 inactive'}</StatusBadge>
        </div>}
      />

      <Section title="Job Summary">
        <dl className="grid gap-4 sm:grid-cols-4">
          <Field label="Job number" value={detail.jobNumber} />
          <Field label="Address" value={detail.jobAddress} />
          <Field label="Status" value={detail.servicem8Status} />
          <Field label="Lead score" value={detail.leadScore?.toString() ?? null} />
          <Field label="Description" value={detail.jobDescription} className="sm:col-span-2" />
        </dl>
      </Section>

      <Section title="Operational State">
        <dl className="grid gap-4 sm:grid-cols-4">
          <Field label="Installer" value={detail.installerName} />
          <Field label="Stage" value={detail.stageName} />
          <Field label="Hardware" value={detail.hardwareStatusName} />
          <Field label="Maintenance Program" value={detail.maintenanceProgram ? 'Yes' : 'No'} />
          <Field label="Install date" value={formatNullableDate(detail.installDate)} />
          <Field label="Date completed" value={formatNullableDate(detail.dateCompleted)} />
          <Field label="Risk" value={sourceLabel(detail.riskLevel, detail.riskSource)} />
          <Field label="Importance" value={sourceLabel(detail.importance, detail.importanceSource)} />
        </dl>
      </Section>

      {permissions.canManage && (
        <DataPanel title="Manage Work Order" eyebrow="Operations">
          <form action={updateWorkOrderOperationalFieldsAction.bind(null, detail.id)} className="mt-4 grid gap-3 md:grid-cols-4">
            <Select name="installerId" label="Installer" options={options.installers} />
            <Select name="stageOptionId" label="Stage" options={options.stages} />
            <Select name="hardwareStatusOptionId" label="Hardware" options={options.hardwareStatuses} />
            <RadioGroup name="maintenanceProgram" label="Maintenance Program" value={detail.maintenanceProgram ? 'yes' : 'no'} />
            <Input name="installDate" label="Install date" type="date" />
            <Input name="dateCompleted" label="Date completed" type="date" />
            <LevelSelect name="riskLevel" label="Risk" />
            <LevelSelect name="importance" label="Importance" />
            <div className="md:col-span-4">
              <PrecisionButton type="submit">
                Save changes
              </PrecisionButton>
            </div>
          </form>
        </DataPanel>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <DataPanel
          title="Client Context"
          eyebrow="Relationship"
          actions={permissions.canManage && (
              <form action={generateWorkOrderAiSuggestionAction.bind(null, detail.id)}>
                <PrecisionButton
                  type="submit"
                  disabled={aiCooldownActive}
                  tone="secondary"
                >
                  {aiCooldownActive ? `Available ${formatRelativeCooldown(aiCooldownUntil)}` : 'Refresh AI Suggestion'}
                </PrecisionButton>
              </form>
            )}
        >
          {redirectedCooldownUntil && (
            <p className="mt-3 rounded-[var(--radius-control)] border border-[var(--state-warning)] bg-[var(--state-warning-soft)] px-3 py-2 text-xs text-[var(--state-warning)]">
              AI suggestion was refreshed recently. Try again after {redirectedCooldownUntil}.
            </p>
          )}
          <dl className="mt-4 space-y-3">
            <Field label="Client notes" value={detail.clientNotes} />
            <Field label="Client Context Summary" value={detail.clientContextSummary} />
            <Field label="AI Suggestion" value={detail.aiSuggestion} />
          </dl>
          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-text-muted">Contacts</h3>
          <ul className="mt-2 divide-y divide-border">
            {detail.contacts.map((contact) => (
              <li key={contact.id} className="py-2 text-sm">
                <span className="font-medium text-text-primary">{contact.name ?? 'Unnamed contact'}</span>
                {contact.isJobContact && <span className="ml-2"><StatusBadge tone="info">Job contact</StatusBadge></span>}
                <span className="block text-text-secondary">{contact.phone ?? 'No phone'} · {contact.email ?? 'No email'}</span>
              </li>
            ))}
            {detail.contacts.length === 0 && <li className="py-3 text-sm text-text-muted">No linked client contacts yet.</li>}
          </ul>
        </DataPanel>

        <DataPanel title="Project Timeline" eyebrow="Activity">
          {permissions.canManage && (
            <form action={addWorkOrderTimelineNoteAction.bind(null, detail.id)} className="mt-4 flex gap-2">
              <input name="note" className={`${precisionControlClassName} min-w-0 flex-1`} placeholder="Add timeline note" />
              <PrecisionButton type="submit">
                Add note
              </PrecisionButton>
            </form>
          )}
          <ul className="mt-4 divide-y divide-border">
            {detail.timeline.map((event) => (
              <li key={event.id} className="py-3 text-sm">
                <span className="font-medium text-text-primary">{eventLabel(event.fieldName)}</span>
                <span className="ml-2 text-xs text-text-muted">{formatDateTime(event.createdAt)}</span>
                <span className="block text-text-secondary">{String(event.note ?? event.newValue ?? '-')}</span>
                {event.isClientVisibleCandidate && event.portalTitle && (
                  <span className="mt-1 block text-xs font-medium text-[var(--state-positive)]">Portal candidate: {event.portalTitle}</span>
                )}
              </li>
            ))}
            {detail.timeline.length === 0 && <li className="py-3 text-sm text-text-muted">No timeline entries yet.</li>}
          </ul>
        </DataPanel>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <DataPanel title={title}>{children}</DataPanel>
}

function Field({ label, value, className }: { label: string; value: string | null | undefined; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm text-text-primary">{value || '-'}</dd>
    </div>
  )
}

function Select({ name, label, options }: { name: string; label: string; options: Array<{ id: string; label: string }> }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      <select name={name} className={`${precisionControlClassName} mt-1`}>
        <option value="">Unassigned</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </label>
  )
}

function Input({ name, label, type }: { name: string; label: string; type: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      <input name={name} type={type} className={`${precisionControlClassName} mt-1`} />
    </label>
  )
}

function LevelSelect({ name, label }: { name: string; label: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      <select name={name} className={`${precisionControlClassName} mt-1`}>
        <option value="">None</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
    </label>
  )
}

function sourceLabel(value: WorkOrderDetail['riskLevel'], source: WorkOrderDetail['riskSource']) {
  if (!value) return null
  return `${titleCase(value)} (${source ?? 'unknown'})`
}

function formatNullableDate(value: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

function eventLabel(value: string) {
  return value.split('_').map(titleCase).join(' ')
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat('en-NZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function RadioGroup({ name, label, value }: { name: string; label: string; value: 'yes' | 'no' }) {
  return (
    <fieldset className="block">
      <legend className="text-xs font-medium text-text-secondary">{label}</legend>
      <div className="mt-1 flex min-h-10 items-center gap-4 rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-sm text-text-primary">
        <label className="inline-flex items-center gap-2">
          <input type="radio" name={name} value="yes" defaultChecked={value === 'yes'} />
          <span>Yes</span>
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="radio" name={name} value="no" defaultChecked={value === 'no'} />
          <span>No</span>
        </label>
      </div>
    </fieldset>
  )
}

function formatRelativeCooldown(value: Date | null) {
  if (!value) return 'soon'
  const minutes = Math.max(1, Math.ceil((value.getTime() - Date.now()) / 60_000))
  return `in ${minutes} min`
}
