import { requireModule } from '@/lib/guard'
import {
  getExpirySettings,
  getNotificationSettings,
  getTrackingSettings,
  trackSettingKeys,
  viewerSettingKeys,
  type TrackingSettingKey,
} from '@/modules/quote-tracker/settings-query'
import { saveTrackingSettings } from '@/modules/quote-tracker/admin-settings-actions'

const labels: Record<TrackingSettingKey, string> = {
  'track.ip': 'Raw IP address',
  'track.geo': 'Cloudflare location and ISP',
  'track.page_completion': 'Page completion',
  'track.return_visits': 'Return visits',
  'track.distinct_viewers': 'Distinct viewers and forwarding',
  'track.download_print': 'Download and print events',
  'track.active_time': 'Focused active time',
  'track.time_to_open': 'Time to first open',
  'track.cta_clicks': 'CTA clicks',
  'viewer.download': 'Download button',
  'viewer.print': 'Print button',
  'viewer.accept': 'Accept button',
  'viewer.contact_us': 'Contact Us button',
}

type TrackingAdminPageProps = {
  searchParams?: Promise<{
    saved?: string
    error?: string
  }>
}

function SettingToggle({ settingKey, enabled }: { settingKey: TrackingSettingKey; enabled: boolean }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded border border-gray-200 bg-white px-4 py-3">
      <span>
        <span className="block text-sm font-medium text-gray-900">{labels[settingKey]}</span>
        <span className="mt-0.5 block font-mono text-xs text-gray-500">{settingKey}</span>
      </span>
      <input
        type="checkbox"
        name={settingKey}
        defaultChecked={enabled}
        className="h-5 w-5 rounded border-gray-300 text-[#142B3A]"
      />
    </label>
  )
}

function SettingsSection({
  title,
  keys,
  settings,
}: {
  title: string
  keys: TrackingSettingKey[]
  settings: Record<TrackingSettingKey, boolean>
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {keys.map((key) => (
          <SettingToggle key={key} settingKey={key} enabled={settings[key]} />
        ))}
      </div>
    </section>
  )
}

export default async function TrackingAdminPage({ searchParams }: TrackingAdminPageProps) {
  await requireModule('admin')

  const params = await searchParams
  const settings = await getTrackingSettings()
  const notificationSettings = await getNotificationSettings()
  const expirySettings = await getExpirySettings()

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Tracking Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Control quote viewer tracking signals and the customer-facing viewer actions.
        </p>
      </div>

      {params?.saved === '1' ? (
        <div className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Tracking settings saved.
        </div>
      ) : null}

      {params?.error ? (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Tracking settings could not be saved. Ref: {params.error}
        </div>
      ) : null}

      <form action={saveTrackingSettings} className="space-y-8">
        <SettingsSection title="Tracking signals" keys={trackSettingKeys} settings={settings} />
        <SettingsSection title="Viewer features" keys={viewerSettingKeys} settings={settings} />

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-900">Auto-minted links</h2>
          <label className="grid gap-2 rounded border border-gray-200 bg-white p-4">
            <span>
              <span className="block text-sm font-medium text-gray-900">Default expiration</span>
              <span className="mt-0.5 block font-mono text-xs text-gray-500">expiry.default</span>
            </span>
            <select
              name="expiry.default"
              defaultValue={expirySettings.defaultPreset}
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950"
            >
              <option value="1h">1 hour</option>
              <option value="3h">3 hours</option>
              <option value="12h">12 hours</option>
              <option value="1d">1 day</option>
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
            </select>
          </label>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-900">Open notifications</h2>
          <div className="grid gap-3 rounded border border-gray-200 bg-white p-4 md:grid-cols-2">
            <label className="flex items-center justify-between gap-4">
              <span>
                <span className="block text-sm font-medium text-gray-900">Email notifications</span>
                <span className="mt-0.5 block font-mono text-xs text-gray-500">notifications.enabled</span>
              </span>
              <input
                type="checkbox"
                name="notifications.enabled"
                defaultChecked={notificationSettings.enabled}
                className="h-5 w-5 rounded border-gray-300 text-[#142B3A]"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-900">Send notifications to</span>
              <span className="mt-0.5 block font-mono text-xs text-gray-500">notifications.to</span>
              <textarea
                name="notifications.to"
                rows={2}
                defaultValue={notificationSettings.to.join(', ')}
                placeholder="support@royalglass.co.nz, sales@royalglass.co.nz"
                className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950"
              />
            </label>
          </div>
        </section>

        <div className="flex justify-end border-t border-gray-200 pt-4">
          <button
            type="submit"
            className="rounded bg-[#142B3A] px-5 py-2.5 text-sm font-medium text-white shadow-sm"
          >
            Save tracking settings
          </button>
        </div>
      </form>
    </div>
  )
}
