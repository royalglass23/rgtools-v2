import { requireModule } from '@/lib/guard'
import {
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
      <div className="grid gap-3">
        {keys.map((key) => (
          <SettingToggle key={key} settingKey={key} enabled={settings[key]} />
        ))}
      </div>
    </section>
  )
}

export default async function TrackingAdminPage() {
  await requireModule('admin')

  const settings = await getTrackingSettings()

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Tracking Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Control quote viewer tracking signals and the customer-facing viewer actions.
        </p>
      </div>

      <form action={saveTrackingSettings} className="space-y-8">
        <SettingsSection title="Tracking signals" keys={trackSettingKeys} settings={settings} />
        <SettingsSection title="Viewer features" keys={viewerSettingKeys} settings={settings} />

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
