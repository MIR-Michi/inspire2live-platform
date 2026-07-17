import Link from 'next/link'
import { componentManifests } from '@/modules/registry'
import { componentPanel } from '@/kernel/settings'
import { componentSettingsHref } from '@/modules/settings-registry'

export const metadata = { title: 'Capabilities · Platform Settings' }

/**
 * Capabilities → Modules (ADR-0010 §4). The composition layer, made visible: the
 * catalog of components, each with its feature flag and (where declared) a link
 * to its config panel. This is the human view of what a generated-platform
 * blueprint selects and configures (ADR-0009 §11). Toggling flags live is a
 * backlog item (concept §7 #1); today flags are shown read-only.
 */
export default function CapabilitiesPage() {
  const rows = componentManifests.map((m) => ({
    id: m.id,
    title: m.title,
    summary: m.summary,
    flag: m.featureFlag ?? null,
    hasPanel: componentPanel(m) !== null,
    settingsHref: componentSettingsHref(m.id),
  }))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Capabilities</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">
          The components this platform is composed of. Each is independently flaggable; components with
          configurable settings link to their panel. This catalog is what a generated platform selects
          and configures.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 text-left">Component</th>
              <th className="px-4 py-3 text-left">Feature flag</th>
              <th className="px-4 py-3 text-left">Settings</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-neutral-900">{r.title}</p>
                  <p className="max-w-md text-xs text-neutral-500">{r.summary}</p>
                </td>
                <td className="px-4 py-3">
                  {r.flag ? (
                    <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-700">{r.flag}</code>
                  ) : (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">always on</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.hasPanel ? (
                    <Link href={r.settingsHref} className="text-sm font-medium text-orange-600 hover:underline">
                      Configure →
                    </Link>
                  ) : (
                    <span className="text-xs text-neutral-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
