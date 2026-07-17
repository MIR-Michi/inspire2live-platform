'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, type CSSProperties } from 'react'
import type { ResolvedField } from '@/kernel/settings'
import { saveSettingsPanel } from '@/modules/settings-actions'
import { SettingsFieldControl } from '@/components/settings/settings-field-control'
import { CollapsibleCard } from '@/components/ui/collapsible-card'

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
  const cardStyle = {
    borderRadius: radius(value(values, 'radiusStyle', 'rounded')),
    boxShadow: shadow(value(values, 'elevationStyle', 'subtle')),
  } as CSSProperties
  const compact = value(values, 'dashboardDensity', 'comfortable') === 'compact'

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
        <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm" aria-label="Design controls">
          {fields.map((field) => (
            <SettingsFieldControl
              key={field.key}
              field={field}
              value={values[field.key]}
              onChange={(next) => {
                setValues((previous) => ({ ...previous, [field.key]: next }))
                setMessage(null)
              }}
            />
          ))}
        </section>

        <section className="space-y-4 rounded-xl border border-neutral-200 bg-neutral-50 p-5" aria-label="Live component preview">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Live preview</p>
            <h2 className="mt-1 text-lg font-semibold text-neutral-900">Production component states</h2>
            <p className="mt-1 text-xs text-neutral-500">The preview uses the same semantic values being edited. It does not allow arbitrary CSS.</p>
          </div>

          <div className={compact ? 'space-y-2' : 'space-y-4'}>
            <div style={cardStyle} className={['border border-neutral-200 bg-white', compact ? 'p-3' : 'p-5'].join(' ')}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Dashboard tile</p>
                  <p className="mt-1 font-semibold text-neutral-900">Needs attention</p>
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">3 items</span>
              </div>
              <p className="mt-3 text-sm text-neutral-600">Cards, badges, spacing and elevation use semantic component-library variants.</p>
            </div>

            <div style={cardStyle} className={['border border-neutral-200 bg-white', compact ? 'p-3' : 'p-5'].join(' ')}>
              <p className="text-sm font-semibold text-neutral-900">Controls</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white">Primary action</button>
                <button type="button" className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700">Secondary</button>
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Saved ✓</span>
              </div>
              <label className="mt-4 block text-sm font-medium text-neutral-800">
                Example field
                <input value="Accessible input" readOnly className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
              </label>
            </div>

            <CollapsibleCard title="Expandable component" defaultCollapsed tone="orange">
              <p className="text-sm text-neutral-600">This is the production CollapsibleCard primitive, shown in its compact catalog state.</p>
            </CollapsibleCard>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-neutral-200 bg-white p-3 text-xs"><strong>Motion</strong><br />{value(values, 'motionProfile', 'balanced')}</div>
            <div className="rounded-lg border border-neutral-200 bg-white p-3 text-xs"><strong>Dashboard</strong><br />{value(values, 'dashboardDefaultPreset', 'balanced')}</div>
            <div className="rounded-lg border border-neutral-200 bg-white p-3 text-xs"><strong>Celebration</strong><br />{Boolean(values.taskCelebration) ? 'enabled' : 'disabled'}</div>
          </div>
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60">
          {pending ? 'Saving…' : 'Save design defaults'}
        </button>
        {message && <span className={`text-sm ${message.ok ? 'text-emerald-700' : 'text-red-700'}`}>{message.text}</span>}
      </div>
    </form>
  )
}
