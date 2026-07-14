import Link from 'next/link'
import { SETTINGS_SECTIONS } from '@/kernel/shell/settings-nav'

export const metadata = { title: 'Platform Settings' }

/**
 * Platform Settings overview (ADR-0010). A simple landing that names the space
 * and links each section — the sub-nav is always present, this is the "home".
 */
export default function SettingsOverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Platform Settings</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">
          One home for everything that configures how the platform behaves — access, organization
          identity, capabilities, integrations, and observability. Configuration only; operational
          queues and per-user preferences live elsewhere.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {SETTINGS_SECTIONS.map((section) => (
          <div key={section.label} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-neutral-900">{section.label}</h2>
            <ul className="mt-2 space-y-1">
              {section.items.map((item) => (
                <li key={item.id}>
                  {item.planned ? (
                    <span className="text-sm text-neutral-300">{item.label} · soon</span>
                  ) : (
                    <Link href={item.href} className="text-sm text-orange-600 hover:underline">
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
