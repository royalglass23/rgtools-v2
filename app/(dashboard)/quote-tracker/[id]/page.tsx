import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { requireModule } from '@/lib/guard'
import { CopyLinkButton } from '@/modules/quote-tracker/CopyLinkButton'
import { EmailGateSettingsForm } from '@/modules/quote-tracker/EmailGateSettingsForm'
import { getQuoteDetail, setManualTag, updateQuoteEmailGate, updateQuoteScore } from '@/modules/quote-tracker/queries'
import { computeScore, computeStatusTag, type EngagementData, type StatusTag } from '@/modules/quote-tracker/score'

export default async function QuoteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireModule('quote-tracker')
  const { id } = await params
  const notices = await searchParams
  const detail = await getQuoteDetail(id)
  if (!detail) notFound()

  const quoteUrl = detail.quote.shortCode
    ? `https://quotes.royalglass.co.nz/q/${detail.quote.shortCode}`
    : ''
  const engagementData = buildEngagementData(detail)
  const computedScore = computeScore(engagementData)
  const computedTag = computeStatusTag(engagementData)
  const overrideTag = detail.overrides[0]?.newTag ?? null
  const effectiveTag = overrideTag ?? computedTag

  if (detail.quote.aiScore !== computedScore || detail.quote.statusTag !== effectiveTag) {
    await updateQuoteScore(detail.quote.id, computedScore, effectiveTag)
  }

  async function saveManualTag(formData: FormData) {
    'use server'

    await requireModule('quote-tracker')
    const session = await auth()
    const tag = formData.get('tag')
    if (!session?.user?.id || !isStatusTag(tag)) return

    await setManualTag(id, tag, session.user.id)
    revalidatePath(`/quote-tracker/${id}`)
    revalidatePath('/quote-tracker')
  }

  async function saveEmailGate(formData: FormData) {
    'use server'

    await requireModule('quote-tracker')
    const result = await updateQuoteEmailGate(id, {
      enabled: formData.get('emailGateEnabled') === 'on',
      recipientEmails: formData.get('recipientEmails')?.toString() ?? null,
    })

    if (!result.ok) {
      redirect(`/quote-tracker/${id}?gateError=${encodeURIComponent(result.message)}`)
    }

    revalidatePath(`/quote-tracker/${id}`)
    revalidatePath('/quote-tracker')
    redirect(`/quote-tracker/${id}?gateSaved=1`)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/quote-tracker" className="text-sm text-gray-500 hover:text-gray-900">Back to quote tracker</Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-950">{detail.quote.clientName}</h1>
            <StatusBadge tag={effectiveTag} />
          </div>
          {detail.quote.companyName && <p className="mt-1 text-sm text-gray-500">{detail.quote.companyName}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {quoteUrl && <CopyLinkButton value={quoteUrl} label="Copy quote link" />}
        </div>
      </div>

      <Section title="Quote">
        {typeof notices.gateError === 'string' && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {notices.gateError}
          </div>
        )}
        {notices.gateSaved === '1' && (
          <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            Email gate settings saved.
          </div>
        )}
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Job" value={detail.quote.jobDescription ?? '-'} />
          <Field label="Job Address" value={detail.quote.jobAddress ?? '-'} />
          <Field label="Value" value={formatCurrency(detail.quote.quoteValue)} />
          <Field label="Expires" value={formatDateTime(detail.quote.expiresAt)} />
          <Field label="Short code" value={detail.quote.shortCode ?? '-'} />
          <Field label="Link" value={quoteUrl || '-'} />
          <Field label="Email gate" value={detail.quote.emailGateEnabled ? 'Enabled' : 'Disabled'} />
          <Field label="Shared with" value={formatRecipients(detail.recipients)} />
        </dl>
        <EmailGateSettingsForm
          action={saveEmailGate}
          enabled={detail.quote.emailGateEnabled}
          recipientEmails={detail.recipients.map((recipient) => recipient.email).join(', ')}
        />
      </Section>

      <Section title="Engagement">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Total opens" value={String(engagementData.totalOpens)} />
          <Field label="Unique viewers" value={String(engagementData.uniqueSessions)} />
          <Field label="Total time" value={formatDuration(engagementData.totalTimeMs)} />
          <Field label="Max scroll" value={`${engagementData.maxScrollDepth}%`} />
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Forwarding</dt>
            <dd className="mt-1">
              {engagementData.forwardingSuspected ? (
                <span className="inline-flex rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">Suspected</span>
              ) : (
                <span className="text-sm text-gray-950">No signal</span>
              )}
            </dd>
          </div>
        </dl>
        <div className="pt-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-950">Interest score</span>
            <span className="text-gray-600">{computedScore}/100</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded bg-gray-100">
            <div className="h-full rounded bg-[#142B3A]" style={{ width: `${computedScore}%` }} />
          </div>
        </div>
      </Section>

      <Section title="Viewers">
        {detail.quote.emailGateEnabled ? (
          <RecipientAnalyticsTable recipients={detail.recipientAnalytics} />
        ) : (
          <LinkAnalyticsTable sessions={detail.viewerSessions} />
        )}
      </Section>

      <Section title="Event Timeline">
        <div className="divide-y divide-gray-100 rounded border border-gray-200">
          {detail.events.slice(0, 50).map((event) => (
            <div key={event.id} className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[160px_1fr_180px]">
              <span className="font-medium capitalize text-gray-950">{event.eventType.replace('_', ' ')}</span>
              <span className="text-gray-700">
                {event.pageNumber ? `Page ${event.pageNumber} - ` : ''}
                {event.deviceType ?? 'Unknown device'}
                {(event.geoCity || event.geoCountry) ? ` from ${[event.geoCity, event.geoCountry].filter(Boolean).join(', ')}` : ''}
              </span>
              <span className="text-gray-500">{formatDateTime(event.createdAt)}</span>
            </div>
          ))}
          {detail.events.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-500">No events recorded yet.</div>
          )}
        </div>
      </Section>

      <Section title="Manual Status Override">
        <form action={saveManualTag} className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Status</span>
            <select
              name="tag"
              defaultValue={effectiveTag}
              className="mt-1 w-44 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950"
            >
              <option value="hot">Hot</option>
              <option value="warm">Warm</option>
              <option value="cold">Cold</option>
              <option value="dead">Dead</option>
            </select>
          </label>
          <button
            type="submit"
            className="rounded bg-[#142B3A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1d3d52]"
          >
            Save
          </button>
          {overrideTag && <span className="text-sm text-gray-500">Manual override active.</span>}
        </form>
      </Section>
    </div>
  )
}

function buildEngagementData(detail: NonNullable<Awaited<ReturnType<typeof getQuoteDetail>>>): EngagementData {
  const openDays = new Set(
    detail.events
      .filter((event) => event.eventType === 'open')
      .map((event) => event.createdAt.toISOString().slice(0, 10)),
  )

  return {
    totalOpens: detail.engagement?.totalOpens ?? detail.events.filter((event) => event.eventType === 'open').length,
    totalTimeMs: detail.engagement?.totalTimeMs ?? detail.events.reduce((sum, event) => sum + (event.durationMs ?? 0), 0),
    maxScrollDepth: detail.engagement?.maxScrollDepth ?? Math.max(0, ...detail.events.map((event) => event.scrollDepth ?? 0)),
    uniqueSessions: detail.engagement?.uniqueSessions ?? detail.viewerSessions.length,
    uniqueDevices: detail.engagement?.uniqueDevices ?? new Set(detail.events.map((event) => event.deviceType).filter(Boolean)).size,
    forwardingSuspected: detail.engagement?.forwardingSuspected ?? detail.viewerSessions.length > 1,
    hasCta: detail.events.some((event) => event.eventType === 'cta'),
    hasReturnVisit: openDays.size >= 2,
    createdAt: detail.quote.createdAt,
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-950">{title}</h2>
      {children}
    </section>
  )
}

function RecipientAnalyticsTable({
  recipients,
}: {
  recipients: NonNullable<Awaited<ReturnType<typeof getQuoteDetail>>>['recipientAnalytics']
}) {
  return (
    <div className="overflow-hidden rounded border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3">Recipient</th>
            <th className="px-4 py-3">Opens</th>
            <th className="px-4 py-3">Last seen</th>
            <th className="px-4 py-3">Time spent</th>
            <th className="px-4 py-3">Max scroll</th>
            <th className="px-4 py-3">Pages seen</th>
            <th className="px-4 py-3">Downloaded</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {recipients.map((recipient) => (
            <tr key={recipient.recipientId}>
              <td className="px-4 py-3 text-gray-700">
                <span className="font-medium text-gray-950">{recipient.email}</span>
                {recipient.name && <span className="block text-xs text-gray-500">{recipient.name}</span>}
              </td>
              <td className="px-4 py-3 text-gray-700">{recipient.opens}</td>
              <td className="whitespace-nowrap px-4 py-3 text-gray-700">{formatDateTime(recipient.lastSeenAt)}</td>
              <td className="px-4 py-3 text-gray-700">{formatDuration(recipient.totalTimeMs)}</td>
              <td className="px-4 py-3 text-gray-700">{recipient.maxScrollDepth}%</td>
              <td className="px-4 py-3 text-gray-700">{recipient.maxPageSeen || '-'}</td>
              <td className="px-4 py-3 text-gray-700">{recipient.downloaded ? 'Yes' : 'No'}</td>
            </tr>
          ))}
          {recipients.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-gray-500">No recipients configured.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function LinkAnalyticsTable({
  sessions,
}: {
  sessions: NonNullable<Awaited<ReturnType<typeof getQuoteDetail>>>['viewerSessions']
}) {
  return (
    <div className="overflow-hidden rounded border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3">IP</th>
            <th className="px-4 py-3">City and ISP</th>
            <th className="px-4 py-3">Device</th>
            <th className="px-4 py-3">Opens</th>
            <th className="px-4 py-3">Time spent</th>
            <th className="px-4 py-3">Pages seen</th>
            <th className="px-4 py-3">CTA</th>
            <th className="px-4 py-3">First seen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sessions.map((session) => (
            <tr key={session.sessionId}>
              <td className="px-4 py-3 text-gray-700">{maskIp(session.ip)}</td>
              <td className="px-4 py-3 text-gray-700">
                <span className="block">{session.geoCity ?? session.geoCountry ?? '-'}</span>
                <span className="block text-xs text-gray-500">{session.geoIsp ?? '-'}</span>
              </td>
              <td className="px-4 py-3 text-gray-700">{session.deviceType ?? '-'}</td>
              <td className="px-4 py-3 text-gray-700">{session.opens}</td>
              <td className="px-4 py-3 text-gray-700">{formatDuration(session.totalTimeMs)}</td>
              <td className="px-4 py-3 text-gray-700">{session.maxPageSeen || '-'}</td>
              <td className="px-4 py-3 text-gray-700">{session.hasCta ? 'Yes' : 'No'}</td>
              <td className="whitespace-nowrap px-4 py-3 text-gray-700">{formatDateTime(session.firstSeenAt)}</td>
            </tr>
          ))}
          {sessions.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-gray-500">No viewer sessions yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-gray-950">{value}</dd>
    </div>
  )
}

function formatRecipients(recipients: Array<{ email: string }>) {
  if (recipients.length === 0) return '-'
  return recipients.map((recipient) => recipient.email).join(', ')
}

function StatusBadge({ tag }: { tag: StatusTag }) {
  const classes: Record<StatusTag, string> = {
    hot: 'bg-red-100 text-red-800',
    warm: 'bg-amber-100 text-amber-800',
    cold: 'bg-blue-100 text-blue-800',
    dead: 'bg-gray-100 text-gray-700',
  }

  return <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold capitalize ${classes[tag]}`}>{tag}</span>
}

function isStatusTag(value: FormDataEntryValue | null): value is StatusTag {
  return value === 'hot' || value === 'warm' || value === 'cold' || value === 'dead'
}

function formatCurrency(value: string | null) {
  return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(Number(value ?? 0))
}

function formatDateTime(value: Date | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value)
}

function formatDuration(ms: number) {
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

function maskIp(ip: string | null) {
  if (!ip) return '-'
  const parts = ip.split('.')
  if (parts.length === 4) return `${parts.slice(0, 3).join('.')}.xxx`
  return `${ip.slice(0, 12)}...`
}
