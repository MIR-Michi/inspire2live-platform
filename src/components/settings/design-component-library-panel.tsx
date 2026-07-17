'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, type CSSProperties } from 'react'
import type { ResolvedField } from '@/kernel/settings'
import { saveSettingsPanel } from '@/modules/settings-actions'
import { SettingsFieldControl } from '@/components/settings/settings-field-control'
import { CollapsibleCard } from '@/components/ui/collapsible-card'

const GROUPS = [
  { title: 'Foundations', keys: ['dashboardDensity', 'radiusStyle', 'elevationStyle'] },
  { title: 'Motion & Feedback', keys: ['motionProfile', 'taskCelebration'] },
  { title: 'Dashboard Defaults', keys: ['dashboardDefaultPreset', 'dashboardDefaultSplitRatio'] },
] as const

const COMPONENTS = [
  { name: 'AdaptiveDashboard', owner: 'Kernel UI', maturity: 'Stable', purpose: 'Dashboard composition, personalization and responsive zones' },
  { name: 'ResizableSplit', owner: 'Kernel UI', maturity: 'Stable', purpose: 'Pointer and keyboard adjustable primary/supporting split' },
  { name: 'CollapsibleCard', owner: 'Kernel UI', maturity: 'Stable', purpose: 'Persistent expandable content surface' },
  { name: 'ConfettiBurst', owner: 'Kernel UI', maturity: 'Stable', purpose: 'Reduced-motion-aware localized celebration feedback' },
] as const

function value(values: Record<string, unknown>, key: string, fallback: string): string {
  return typeof values[key] === 'string' ? String(values[key]) : fallback
}

function radius(style: string): string {
  return style === 'crisp' ? '0.5rem' : style === 'soft' ? '1.25rem' : '0.75rem'
}

function shadow(style: string): string {
  return style === 'minimal'
    ? '0 1px 2px rgb(15 23 42 / 0.04)'
    : style === 'layered'
      ? '0 12px 32px rgb(15 23 42 / 0.10)'
      : '0 4px 16px rgb(15 23 42 / 0.07)'
}

export function DesignComponentLibraryPanel({
  panelId,
  title,
  description,
  fields,
}: {
  panelId: string
  title: string
  description?: string
  fields: ResolvedField[]
}) {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, unknown>>(
    () => Object.fromEntries(fields.map((field) => [field.key, field.value])),
  )
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const byKey = new Map(fields.map((field) => [field.key, field]))
  const cardStyle = {
    borderRadius: radius(value(values, 'radiusStyle', 'rounded')),
    boxShadow: shadow(value(values, 'elevationStyle', 'subtle')),
  } as CSSProperties
  const compact = value(values, 'dashboardDensity', 'comfortable') === 'compact'

  const setValue = (key: string, next: unknown) => {
    setValues((previous) => ({ ...previous, [key]: next }))
    setMessage(null)
  }

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    startTransition(async () => {
      const result = await saveSettingsPanel(panelId, values)
      if (result.ok) {
        setMessage({ ok: true, text: `Saved ${result.saved} design setting${result.saved === 1 ? '' : 's'}. The current shell now uses these defaults.` })
        router.refresh()
      } else {
        setMessage({ ok: false, text: result.error })
      }
    })
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">Organization design</p>
        <h1 className="mt-1 text-2xl font-bold text-neutral-900">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-neutral-500">{description}</p>}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-4">
          {GROUPS.map((group) => (
            <section key={group.title} className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm" aria-labelledby={`design-${group.title.replaceAll(' ', '-').toLowerCase()}`}>
              <div>
                <h2 id={`design-${group.title.replaceAll(' ', '-').toLowerCase()}`} className="text-base font-semibold text-neutral-900">{group.title}</h2>
                <p className="mt-1 text-xs text-neutral-500">
                  {group.title === 'Foundations' && 'Semantic density, radius and elevation profiles used by component-library surfaces.'}
                  {group.title === 'Motion & Feedback' && 'Bounded organization defaults; operating-system reduced-motion remains authoritative.'}
                  {group.title === 'Dashboard Defaults' && 'Starting values for users who have not personalized a dashboard. Existing layouts are never overwritten.'}
                </p>
              </div>
              {group.keys.map((key) => {
                const field = byKey.get(key)
                return field ? (
                  <SettingsFieldControl key={key} field={field} value={values[key]} onChange={(next) => setValue(key, next)} />
                ) : null
              })}
            </section>
          ))}
        </div>

        <div className="space-y-4">
          <section className="space-y-4 rounded-xl border border-neutral-200 bg-neutral-50 p-5" aria-labelledby="component-preview-title">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Components</p>
              <h2 id="component-preview-title" className="mt-1 text-lg font-semibold text-neutral-900">Live production preview</h2>
              <p className="mt-1 text-xs text-neutral-500">Real production primitives rendered with the semantic values being edited. Arbitrary CSS is not accepted.</p>
            </div>

            <div className={compact ? 'space-y-2' : 'space-y-4'}>
              <div style={cardStyle} className={['border border-neutral-200 bg-white', compact ? 'p-3' : 'p-5'].join(' ')}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Dashboard tile</p><p className="mt-1 font-semibold text-neutral-900">Needs attention</p></div>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">3 items</span>
                </div>
                <p className="mt-3 text-sm text-neutral-600">Cards, badges, spacing and elevation use semantic component-library variants.</p>
              </div>

              <div style={cardStyle} className={['border border-neutral-200 bg-white', compact ? 'p-3' : 'p-5'].join(' ')}>
                <p className="text-sm font-semibold text-neutral-900">Controls and feedback</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="min-h-11 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2">Primary action</button>
                  <button type="button" className="min-h-11 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2">Secondary</button>
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Saved ✓</span>
                </div>
                <label className="mt-4 block text-sm font-medium text-neutral-800">Example field<input value="Accessible input" readOnly className="mt-1 min-h-11 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" /></label>
              </div>

              <CollapsibleCard title="Expandable component" defaultCollapsed tone="orange">
                <p className="text-sm text-neutral-600">The production CollapsibleCard primitive in its catalog state.</p>
              </CollapsibleCard>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {COMPONENTS.map((component) => (
                <div key={component.name} className="rounded-lg border border-neutral-200 bg-white p-3 text-xs">
                  <div className="flex items-center justify-between gap-2"><strong className="text-neutral-900">{component.name}</strong><span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">{component.maturity}</span></div>
                  <p className="mt-1 text-neutral-500">{component.owner}</p>
                  <p className="mt-2 text-neutral-600">{component.purpose}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm" aria-labelledby="accessibility-preview-title">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Accessibility Preview</p>
            <h2 id="accessibility-preview-title" className="mt-1 text-base font-semibold text-neutral-900">Built-in interaction contract</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-neutral-200 p-3 text-xs text-neutral-600"><strong className="text-neutral-900">Keyboard & focus</strong><br />Visible focus rings, keyboard split resizing and tile movement announcements.</div>
              <div className="rounded-lg border border-neutral-200 p-3 text-xs text-neutral-600"><strong className="text-neutral-900">Touch</strong><br />Configuration actions use minimum 44px targets and do not require horizontal drag.</div>
              <div className="rounded-lg border border-neutral-200 p-3 text-xs text-neutral-600"><strong className="text-neutral-900">Reduced motion</strong><br />OS preference removes confetti and large movement while preserving success text.</div>
              <div className="rounded-lg border border-neutral-200 p-3 text-xs text-neutral-600"><strong className="text-neutral-900">State clarity</strong><br />Color is paired with text, icons or accessible labels for every status.</div>
            </div>
          </section>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60">{pending ? 'Saving…' : 'Save design defaults'}</button>
        {message && <span className={`text-sm ${message.ok ? 'text-emerald-700' : 'text-red-700'}`}>{message.text}</span>}
      </div>
    </form>
  )
}
