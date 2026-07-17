'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from 'react'
import type { ResolvedField } from '@/kernel/settings'
import { saveSettingsPanel } from '@/modules/settings-actions'
import { SettingsFieldControl } from '@/components/settings/settings-field-control'
import { CollapsibleCard } from '@/components/ui/collapsible-card'

const FIELD_GROUPS = [
  {
    id: 'foundations',
    title: 'Foundations',
    description: 'Spacing density, card shape and elevation used by new shared surfaces.',
    keys: ['dashboardDensity', 'radiusStyle', 'elevationStyle'],
  },
  {
    id: 'motion',
    title: 'Motion & Feedback',
    description: 'Purposeful transition pace and completion acknowledgement.',
    keys: ['motionProfile', 'taskCelebration'],
  },
  {
    id: 'dashboard',
    title: 'Dashboard Defaults',
    description: 'Starting layout for users who have not saved a personal arrangement.',
    keys: ['dashboardDefaultPreset', 'dashboardDefaultSplitRatio'],
  },
] as const

const COMPONENT_CATALOG = [
  { name: 'AdaptiveDashboard', owner: 'Kernel UI', maturity: 'Production' },
  { name: 'ResizableSplit', owner: 'Shared UI', maturity: 'Production' },
  { name: 'CollapsibleCard', owner: 'Shared UI', maturity: 'Production' },
  { name: 'ConfettiBurst', owner: 'Shared UI', maturity: 'Production' },
]

function value(values: Record<string, unknown>, key: string, fallback: string): string {
  return typeof values[key] === 'string' ? String(values[key]) : fallback
}

function numberValue(values: Record<string, unknown>, key: string, fallback: number): number {
  const raw = values[key]
  const numeric = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(numeric) ? numeric : fallback
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

function readableSettingValue(field: ResolvedField | undefined, current: unknown): string {
  if (!field) return String(current ?? '')
  if (field.type === 'boolean') return current ? 'Enabled' : 'Disabled'
  if (field.type === 'number') return `${Math.round(Number(current) * 100)}% primary column`
  return String(current ?? '')
    .replace(/[-_]/g, ' ')
    .replace(/^./, (character) => character.toUpperCase())
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
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(() => new Set())
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [flashKey, setFlashKey] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const flashTimer = useRef<number | null>(null)

  useEffect(() => () => {
    if (flashTimer.current) window.clearTimeout(flashTimer.current)
  }, [])

  const fieldsByKey = useMemo(() => new Map(fields.map((field) => [field.key, field])), [fields])
  const activeField = activeKey ? fieldsByKey.get(activeKey) : undefined
  const cardStyle = {
    borderRadius: radius(value(values, 'radiusStyle', 'rounded')),
    boxShadow: shadow(value(values, 'elevationStyle', 'subtle')),
  } as CSSProperties
  const compact = value(values, 'dashboardDensity', 'comfortable') === 'compact'
  const splitRatio = Math.min(0.78, Math.max(0.42, numberValue(values, 'dashboardDefaultSplitRatio', 0.64)))
  const motionProfile = value(values, 'motionProfile', 'balanced')
  const motionDuration = motionProfile === 'calm' ? '700ms' : motionProfile === 'expressive' ? '220ms' : '420ms'
  const preset = value(values, 'dashboardDefaultPreset', 'balanced')
  const celebration = Boolean(values.taskCelebration)

  const highlightClass = (keys: readonly string[]) => {
    const active = activeKey ? keys.includes(activeKey) : false
    const flashing = flashKey ? keys.includes(flashKey) : false
    return [
      'transition-all duration-300',
      active ? 'ring-2 ring-orange-400 ring-offset-2 ring-offset-neutral-50' : '',
      flashing ? 'i2l-preview-attention' : '',
    ].join(' ')
  }

  const change = (field: ResolvedField, next: unknown) => {
    setValues((previous) => ({ ...previous, [field.key]: next }))
    setDirtyKeys((previous) => {
      const updated = new Set(previous)
      updated.add(field.key)
      return updated
    })
    setMessage(null)
    setActiveKey(field.key)
    setFlashKey(field.key)
    if (flashTimer.current) window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlashKey(null), 1000)
  }

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    if (dirtyKeys.size === 0) return
    const submitted = Object.fromEntries([...dirtyKeys].map((key) => [key, values[key]]))
    startTransition(async () => {
      try {
        const result = await saveSettingsPanel(panelId, submitted)
        if (result.ok) {
          setDirtyKeys(new Set())
          setMessage({ ok: true, text: `Saved ${result.saved} design change${result.saved === 1 ? '' : 's'}.` })
          router.refresh()
        } else {
          setMessage({ ok: false, text: result.error })
        }
      } catch (cause) {
        setMessage({
          ok: false,
          text: cause instanceof Error ? cause.message : 'The design settings could not be saved.',
        })
      }
    })
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">Organization design</p>
          <h1 className="mt-1 text-2xl font-bold text-neutral-900">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-sm text-neutral-500">{description}</p>}
        </div>
        {dirtyKeys.size > 0 && (
          <span className="rounded-full bg-orange-100 px-3 py-1.5 text-xs font-semibold text-orange-800" role="status">
            {dirtyKeys.size} unsaved change{dirtyKeys.size === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(420px,1.08fr)]">
        <div className="space-y-4" aria-label="Design controls">
          {FIELD_GROUPS.map((group) => {
            const groupFields = group.keys
              .map((key) => fieldsByKey.get(key))
              .filter((field): field is ResolvedField => Boolean(field))
            if (groupFields.length === 0) return null
            return (
              <section key={group.id} className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm" aria-labelledby={`design-group-${group.id}`}>
                <div className="mb-4">
                  <h2 id={`design-group-${group.id}`} className="text-base font-semibold text-neutral-900">{group.title}</h2>
                  <p className="mt-1 text-xs text-neutral-500">{group.description}</p>
                </div>
                <div className="space-y-4">
                  {groupFields.map((field) => (
                    <div
                      key={field.key}
                      className={[
                        'rounded-lg border p-3 transition',
                        activeKey === field.key ? 'border-orange-300 bg-orange-50/60' : 'border-transparent',
                      ].join(' ')}
                    >
                      <SettingsFieldControl
                        field={field}
                        value={values[field.key]}
                        onChange={(next) => change(field, next)}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-0" aria-label="Live component preview">
          <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Live preview</p>
                <h2 className="mt-1 text-lg font-semibold text-neutral-900">See each change immediately</h2>
              </div>
              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-600 shadow-sm">Preview only</span>
            </div>

            {activeField ? (
              <div className="mt-4 rounded-lg border border-orange-300 bg-orange-100 px-4 py-3" role="status" aria-live="polite">
                <div className="flex items-start gap-3">
                  <span className="relative mt-1 flex h-3 w-3 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-60 motion-reduce:animate-none" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-orange-600" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-orange-800">Changed now</p>
                    <p className="mt-0.5 text-sm font-semibold text-neutral-900">
                      {activeField.label ?? activeField.key}: {readableSettingValue(activeField, values[activeField.key])}
                    </p>
                    <p className="mt-1 text-xs text-orange-900/80">The affected preview area is outlined in orange.</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-600">
                Change a setting on the left. The matching preview area will light up here.
              </p>
            )}

            <div className="mt-4 space-y-4">
              <section className={`rounded-xl border border-neutral-200 bg-white p-4 ${highlightClass(['dashboardDensity', 'radiusStyle', 'elevationStyle'])}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Foundations</p>
                    <p className="mt-1 text-sm font-semibold text-neutral-900">Card shape, spacing and elevation</p>
                  </div>
                  <span className="text-xs text-neutral-500">{compact ? 'Compact' : 'Comfortable'}</span>
                </div>
                <div style={cardStyle} className={['mt-3 border border-neutral-200 bg-white', compact ? 'p-3' : 'p-5'].join(' ')}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Dashboard tile</p>
                      <p className="mt-1 font-semibold text-neutral-900">Needs attention</p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">3 items</span>
                  </div>
                  <p className={compact ? 'mt-2 text-xs text-neutral-600' : 'mt-4 text-sm text-neutral-600'}>
                    The padding, corner profile and shadow visibly follow the selected foundation values.
                  </p>
                </div>
              </section>

              <section className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Components</p>
                    <p className="mt-1 text-sm font-semibold text-neutral-900">Production component catalog</p>
                  </div>
                  <span className="text-xs text-neutral-500">4 shared primitives</span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {COMPONENT_CATALOG.map((component) => (
                    <div key={component.name} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                      <p className="text-xs font-semibold text-neutral-900">{component.name}</p>
                      <p className="mt-1 text-[11px] text-neutral-500">{component.owner} · {component.maturity}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <CollapsibleCard title="Expandable component" defaultCollapsed tone="orange">
                    <p className="text-sm text-neutral-600">This is the real shared CollapsibleCard primitive.</p>
                  </CollapsibleCard>
                </div>
              </section>

              <section className={`rounded-xl border border-neutral-200 bg-white p-4 ${highlightClass(['motionProfile', 'taskCelebration'])}`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Motion & Feedback</p>
                <div className="mt-3 flex items-center justify-between gap-4 rounded-lg bg-neutral-50 p-3">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{motionProfile[0].toUpperCase() + motionProfile.slice(1)} motion</p>
                    <p className="mt-1 text-xs text-neutral-500">Transition sample and task acknowledgement</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full bg-orange-600 transition-transform motion-reduce:transition-none"
                      style={{ transitionDuration: motionDuration, transform: flashKey === 'motionProfile' ? 'translateX(18px) scale(1.25)' : 'translateX(0)' }}
                    />
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${celebration ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-600'}`}>
                      Celebration {celebration ? 'on' : 'off'}
                    </span>
                  </div>
                </div>
              </section>

              <section className={`rounded-xl border border-neutral-200 bg-white p-4 ${highlightClass(['dashboardDefaultPreset', 'dashboardDefaultSplitRatio'])}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Dashboard Defaults</p>
                    <p className="mt-1 text-sm font-semibold text-neutral-900">{preset[0].toUpperCase() + preset.slice(1)} · {Math.round(splitRatio * 100)}/{Math.round((1 - splitRatio) * 100)}</p>
                  </div>
                  <span className="text-xs text-neutral-500">New or reset dashboards</span>
                </div>
                <div className="mt-3 grid h-28 gap-2 rounded-lg border border-neutral-200 bg-neutral-100 p-2" style={{ gridTemplateColumns: `${splitRatio}fr ${1 - splitRatio}fr` }}>
                  <div className="rounded-md border border-orange-300 bg-orange-100 p-2 text-[11px] font-semibold text-orange-900">Primary work</div>
                  <div className="rounded-md border border-neutral-300 bg-white p-2 text-[11px] font-semibold text-neutral-700">Supporting context</div>
                </div>
              </section>

              <section className="rounded-xl border border-neutral-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Accessibility Preview</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <button type="button" className="min-h-11 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 focus:outline-none focus:ring-4 focus:ring-orange-300">
                    Keyboard focus sample
                  </button>
                  <div className="flex min-h-11 items-center rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-xs text-neutral-600">
                    Reduced motion keeps the same state feedback without large movement.
                  </div>
                </div>
              </section>
            </div>
          </section>
        </aside>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending || dirtyKeys.size === 0}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? 'Saving…' : dirtyKeys.size > 0 ? `Save ${dirtyKeys.size} change${dirtyKeys.size === 1 ? '' : 's'}` : 'No changes to save'}
          </button>
          {message && (
            <div
              className={[
                'min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm font-medium',
                message.ok
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-300 bg-red-50 text-red-800',
              ].join(' ')}
              role={message.ok ? 'status' : 'alert'}
            >
              {message.ok ? 'Saved successfully. ' : 'Could not save design settings. '}{message.text}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes i2l-preview-attention {
          0% { box-shadow: 0 0 0 0 rgb(249 115 22 / 0.45); }
          55% { box-shadow: 0 0 0 10px rgb(249 115 22 / 0); }
          100% { box-shadow: 0 0 0 0 rgb(249 115 22 / 0); }
        }
        .i2l-preview-attention { animation: i2l-preview-attention 900ms ease-out; }
        @media (prefers-reduced-motion: reduce) { .i2l-preview-attention { animation: none; } }
      `}</style>
    </form>
  )
}
