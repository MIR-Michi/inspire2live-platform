import { saveNotificationPrefs } from '@/app/app/profile/actions'
import { NOTIFICATION_EVENT_META, resolveChannels, type NotificationEvent } from '@/lib/notify'
import type { Database } from '@/types/database'

type RawPrefs = Database['public']['Tables']['profiles']['Row']['notification_prefs']

const CHANNELS: Array<{ key: 'inApp' | 'email' | 'whatsapp'; label: string; soon?: true }> = [
  { key: 'inApp', label: 'In-app' },
  { key: 'email', label: 'Email' },
  { key: 'whatsapp', label: 'WhatsApp', soon: true },
]

export function NotificationPrefsPanel({ notificationPrefs }: { notificationPrefs: RawPrefs }) {
  const events = Object.keys(NOTIFICATION_EVENT_META) as NotificationEvent[]

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="mb-0.5 text-sm font-semibold text-neutral-700">Notification Preferences</h2>
      <p className="mb-4 text-xs text-neutral-500">
        Choose how you want to be notified. WhatsApp delivery is coming once the API is live.
      </p>

      <form action={saveNotificationPrefs}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="pb-2 pr-4 text-left text-xs font-semibold text-neutral-500">
                  Event
                </th>
                {CHANNELS.map((ch) => (
                  <th
                    key={ch.key}
                    className="min-w-[80px] pb-2 text-center text-xs font-semibold text-neutral-500"
                  >
                    {ch.label}
                    {ch.soon && (
                      <span className="ml-1 rounded bg-neutral-100 px-1 py-0.5 text-[10px] font-normal text-neutral-400">
                        soon
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {events.map((event) => {
                const meta = NOTIFICATION_EVENT_META[event]
                const channels = resolveChannels(notificationPrefs, event)
                return (
                  <tr key={event}>
                    <td className="py-3 pr-4">
                      <p className="text-sm font-medium text-neutral-800">{meta.label}</p>
                      <p className="text-xs text-neutral-500">{meta.description}</p>
                    </td>
                    {CHANNELS.map((ch) => {
                      const disabled = ch.key === 'whatsapp'
                      return (
                        <td key={ch.key} className="py-3 text-center">
                          <input
                            type="checkbox"
                            name={`events.${event}.${ch.key}`}
                            defaultChecked={!disabled && channels[ch.key]}
                            disabled={disabled}
                            className="h-4 w-4 rounded border-neutral-300 accent-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
                          />
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
          >
            Save preferences
          </button>
        </div>
      </form>
    </section>
  )
}
