'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  saveOrgFeedConfig,
  runNewsfeedNow,
  type OrgFeedActionState,
} from '@/app/app/admin/org-feed/actions'
import { normalizeDomain } from '@/lib/ai/org-feed-config'
import {
  ALL_SUGGESTED_SOURCES,
  ALL_SUGGESTED_THEMES,
  ALL_SUGGESTED_TOPICS,
  CADENCE_OPTIONS,
  SUGGESTED_REGIONS,
  SUGGESTED_SOURCES,
  SUGGESTED_THEMES,
  SUGGESTED_TOPIC_CATEGORIES,
  splitKnownAndCustom,
} from '@/lib/ai/org-feed-catalog'

type InitialConfig = {
  topics: string[]
  themes: string[]
  allowedSources: string[]
  blockedSources: string[]
  region: string | null
  cadence: string
  enabled: boolean
}

const STEPS = ['Themes', 'Topics', 'Sources', 'Scope', 'Review'] as const
const INITIAL_STATE: OrgFeedActionState = { ok: false }

function toggle(set: Set<string>, value: string): Set<string> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

export function OrgFeedWizard({
  initialConfig,
  isConfigured,
  itemCount,
  lastUpdated,
  aiEnabled,
}: {
  initialConfig: InitialConfig
  isConfigured: boolean
  itemCount: number
  lastUpdated: string | null
  aiEnabled: boolean
}) {
  // Reconcile stored values against the catalog so existing configs (incl. ones
  // made with the old free-text form) round-trip into checkboxes + custom chips.
  const initial = useMemo(() => {
    const themes = splitKnownAndCustom(initialConfig.themes, ALL_SUGGESTED_THEMES)
    const topics = splitKnownAndCustom(initialConfig.topics, ALL_SUGGESTED_TOPICS)
    const sources = splitKnownAndCustom(initialConfig.allowedSources, ALL_SUGGESTED_SOURCES)
    return { themes, topics, sources }
  }, [initialConfig])

  const [step, setStep] = useState(0)
  const [themes, setThemes] = useState<Set<string>>(new Set(initial.themes.known))
  const [customThemes, setCustomThemes] = useState<string[]>(initial.themes.custom)
  const [topics, setTopics] = useState<Set<string>>(new Set(initial.topics.known))
  const [customTopics, setCustomTopics] = useState<string[]>(initial.topics.custom)
  const [sources, setSources] = useState<Set<string>>(new Set(initial.sources.known))
  const [customSources, setCustomSources] = useState<string[]>(initial.sources.custom)
  const [blocked, setBlocked] = useState<string[]>(initialConfig.blockedSources)
  const [region, setRegion] = useState<string>(initialConfig.region ?? 'Global')
  const [cadence, setCadence] = useState<string>(initialConfig.cadence || 'weekly')
  const [enabled, setEnabled] = useState<boolean>(initialConfig.enabled)

  const [state, setState] = useState<OrgFeedActionState>(INITIAL_STATE)
  const [pending, startTransition] = useTransition()

  const allThemes = [...themes, ...customThemes]
  const allTopics = [...topics, ...customTopics]
  const allSources = [...sources, ...customSources]
  const hasFocus = allThemes.length > 0 || allTopics.length > 0

  const save = () => {
    startTransition(async () => {
      const result = await saveOrgFeedConfig({
        themes: allThemes,
        topics: allTopics,
        allowedSources: allSources,
        blockedSources: blocked,
        region,
        cadence,
        enabled,
      })
      setState(result)
    })
  }

  const runNow = () => {
    startTransition(async () => setState(await runNewsfeedNow()))
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      {/* Stepper */}
      <div className="flex flex-wrap gap-1 border-b border-neutral-100 bg-neutral-50/60 px-3 py-3">
        {STEPS.map((label, i) => {
          const active = i === step
          const done = stepHasContent(i, { allThemes, allTopics, allSources, blocked, region, cadence })
          return (
            <button
              key={label}
              type="button"
              onClick={() => setStep(i)}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                active ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${active ? 'bg-white/20' : done ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-200 text-neutral-600'}`}>
                {done && !active ? '✓' : i + 1}
              </span>
              {label}
            </button>
          )
        })}
      </div>

      <div className="space-y-5 p-6">
        {step === 0 && (
          <Section title="What should the feed cover?" hint="Pick the broad editorial themes Inspire2Live cares about. These steer the overall focus.">
            <div className="grid gap-2 sm:grid-cols-2">
              {SUGGESTED_THEMES.map((t) => (
                <CheckCard key={t.label} checked={themes.has(t.label)} onToggle={() => setThemes((s) => toggle(s, t.label))} title={t.label} description={t.description} />
              ))}
            </div>
            <CustomAdder label="Add a custom theme" placeholder="e.g. Health technology assessment" existing={[...themes, ...customThemes]} onAdd={(v) => setCustomThemes((c) => [...c, v])} />
            <ChipRow values={customThemes} onRemove={(v) => setCustomThemes((c) => c.filter((x) => x !== v))} tone="custom" />
          </Section>
        )}

        {step === 1 && (
          <Section title="Get specific" hint="Choose the categories and subtopics to track. Check a whole category, or pick individual subtopics.">
            <div className="space-y-4">
              {SUGGESTED_TOPIC_CATEGORIES.map((cat) => (
                <div key={cat.id} className="rounded-xl border border-neutral-200 p-3">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={topics.has(cat.label)} onChange={() => setTopics((s) => toggle(s, cat.label))} className="h-4 w-4 rounded border-neutral-300" />
                    <span className="text-sm font-semibold text-neutral-900">{cat.emoji} {cat.label}</span>
                    <span className="text-[11px] text-neutral-400">whole category</span>
                  </label>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {cat.subtopics.map((sub) => (
                      <ToggleChip key={sub} active={topics.has(sub)} onClick={() => setTopics((s) => toggle(s, sub))}>{sub}</ToggleChip>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <CustomAdder label="Add a custom topic" placeholder="e.g. Tumor microenvironment" existing={[...topics, ...customTopics]} onAdd={(v) => setCustomTopics((c) => [...c, v])} />
            <ChipRow values={customTopics} onRemove={(v) => setCustomTopics((c) => c.filter((x) => x !== v))} tone="custom" />
          </Section>
        )}

        {step === 2 && (
          <Section title="Trusted sources" hint="Optionally limit the search to reputable domains, and block ones you never want. Leave allowed empty to search the whole web.">
            <p className="text-xs font-semibold text-neutral-700">Preferred sources</p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_SOURCES.map((s) => (
                <ToggleChip key={s.domain} active={sources.has(s.domain)} onClick={() => setSources((set) => toggle(set, s.domain))} title={s.domain}>{s.label}</ToggleChip>
              ))}
            </div>
            <DomainAdder label="Add an allowed domain" existing={[...sources, ...customSources]} onAdd={(d) => setCustomSources((c) => [...c, d])} />
            <ChipRow values={customSources} onRemove={(v) => setCustomSources((c) => c.filter((x) => x !== v))} tone="custom" />

            <div className="mt-4 border-t border-neutral-100 pt-4">
              <p className="text-xs font-semibold text-neutral-700">Blocked sources</p>
              <DomainAdder label="Block a domain" existing={blocked} onAdd={(d) => setBlocked((c) => [...c, d])} />
              <ChipRow values={blocked} onRemove={(v) => setBlocked((c) => c.filter((x) => x !== v))} tone="blocked" />
            </div>
          </Section>
        )}

        {step === 3 && (
          <Section title="Scope & schedule" hint="Where to focus, how often to refresh, and whether the feed is live.">
            <p className="text-xs font-semibold text-neutral-700">Region focus</p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_REGIONS.map((r) => (
                <ToggleChip key={r} active={region === r} onClick={() => setRegion(r)}>{r}</ToggleChip>
              ))}
            </div>
            <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Or type a custom region" className="mt-2 w-full max-w-sm rounded-lg border border-neutral-300 px-3 py-2 text-sm" />

            <div className="mt-4">
              <p className="text-xs font-semibold text-neutral-700">Refresh cadence</p>
              <div className="mt-1 grid gap-2 sm:grid-cols-3">
                {CADENCE_OPTIONS.map((c) => (
                  <CheckCard key={c.value} radio checked={cadence === c.value} onToggle={() => setCadence(c.value)} title={c.label} description={c.description} />
                ))}
              </div>
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-xl border border-neutral-200 p-3">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-neutral-300" />
              <span>
                <span className="text-sm font-semibold text-neutral-900">Feed enabled</span>
                <span className="block text-xs text-neutral-500">The scheduled job populates items only while this is on. Turn it off to pause without losing your config.</span>
              </span>
            </label>
          </Section>
        )}

        {step === 4 && (
          <Section title="Review & save" hint="Here's what the feed will monitor. You can jump back to any step to adjust.">
            <div className="space-y-3">
              <ReviewRow label="Themes" values={allThemes} />
              <ReviewRow label="Topics" values={allTopics} />
              <ReviewRow label="Preferred sources" values={allSources} empty="Whole web" />
              <ReviewRow label="Blocked sources" values={blocked} empty="None" />
              <div className="flex flex-wrap gap-6 text-sm">
                <div><span className="text-neutral-500">Region:</span> <span className="font-medium text-neutral-900">{region || 'Global'}</span></div>
                <div><span className="text-neutral-500">Cadence:</span> <span className="font-medium text-neutral-900">{cadence}</span></div>
                <div><span className="text-neutral-500">Status:</span> <span className={`font-medium ${enabled ? 'text-emerald-700' : 'text-amber-700'}`}>{enabled ? 'Enabled' : 'Disabled'}</span></div>
              </div>
            </div>

            {!hasFocus && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Add at least one theme or topic before enabling the feed.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-4">
              <button type="button" onClick={runNow} disabled={pending || !aiEnabled} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50" title={aiEnabled ? 'Save first, then run the web-search job now' : 'AI features are disabled'}>
                {pending ? 'Working…' : 'Run now'}
              </button>
              <span className="text-xs text-neutral-500">
                {itemCount} item{itemCount === 1 ? '' : 's'} in the feed
                {lastUpdated ? ` · updated ${new Date(lastUpdated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
              </span>
            </div>
          </Section>
        )}

        {(state.error || state.message) && (
          <p className={`text-sm ${state.ok ? 'text-emerald-700' : 'text-red-700'}`}>{state.ok ? state.message : state.error}</p>
        )}

        {/* Footer nav */}
        <div className="flex items-center justify-between border-t border-neutral-100 pt-4">
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="rounded-lg px-3 py-2 text-sm font-semibold text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-40">
            ← Back
          </button>
          <div className="flex items-center gap-2">
            {step < STEPS.length - 1 && (
              <button type="button" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50">
                Next →
              </button>
            )}
            <button type="button" onClick={save} disabled={pending} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:bg-neutral-400">
              {pending ? 'Saving…' : isConfigured ? 'Save changes' : 'Save configuration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function stepHasContent(
  i: number,
  ctx: { allThemes: string[]; allTopics: string[]; allSources: string[]; blocked: string[]; region: string; cadence: string }
): boolean {
  switch (i) {
    case 0: return ctx.allThemes.length > 0
    case 1: return ctx.allTopics.length > 0
    case 2: return ctx.allSources.length > 0 || ctx.blocked.length > 0
    case 3: return Boolean(ctx.region) || Boolean(ctx.cadence)
    default: return false
  }
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
        <p className="mt-0.5 text-sm text-neutral-500">{hint}</p>
      </div>
      {children}
    </div>
  )
}

function CheckCard({ checked, onToggle, title, description, radio = false }: { checked: boolean; onToggle: () => void; title: string; description: string; radio?: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition ${checked ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200 hover:border-neutral-300'}`}
    >
      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border ${radio ? 'rounded-full' : 'rounded'} ${checked ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300'}`}>
        {checked && <span className="text-[10px] leading-none">✓</span>}
      </span>
      <span>
        <span className="block text-sm font-semibold text-neutral-900">{title}</span>
        <span className="block text-xs text-neutral-500">{description}</span>
      </span>
    </button>
  )
}

function ToggleChip({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${active ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400'}`}
    >
      {children}
    </button>
  )
}

function ChipRow({ values, onRemove, tone }: { values: string[]; onRemove: (v: string) => void; tone: 'custom' | 'blocked' }) {
  if (values.length === 0) return null
  const cls = tone === 'blocked' ? 'border-red-200 bg-red-50 text-red-700' : 'border-orange-200 bg-orange-50 text-orange-700'
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((v) => (
        <span key={v} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${cls}`}>
          {v}
          <button type="button" onClick={() => onRemove(v)} className="text-neutral-400 hover:text-neutral-700" aria-label={`Remove ${v}`}>×</button>
        </span>
      ))}
    </div>
  )
}

function CustomAdder({ label, placeholder, existing, onAdd }: { label: string; placeholder: string; existing: string[]; onAdd: (v: string) => void }) {
  const [value, setValue] = useState('')
  const add = () => {
    const v = value.trim()
    if (!v) return
    if (existing.some((e) => e.toLowerCase() === v.toLowerCase())) { setValue(''); return }
    onAdd(v)
    setValue('')
  }
  return (
    <div className="flex max-w-md gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        placeholder={placeholder}
        aria-label={label}
        className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
      />
      <button type="button" onClick={add} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50">Add</button>
    </div>
  )
}

function DomainAdder({ label, existing, onAdd }: { label: string; existing: string[]; onAdd: (v: string) => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const add = () => {
    const domain = normalizeDomain(value)
    if (!domain) { setError('Enter a valid domain, e.g. nature.com'); return }
    setError('')
    if (!existing.some((e) => e.toLowerCase() === domain)) onAdd(domain)
    setValue('')
  }
  return (
    <div className="mt-2 max-w-md">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="example.org"
          aria-label={label}
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
        />
        <button type="button" onClick={add} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50">Add</button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

function ReviewRow({ label, values, empty }: { label: string; values: string[]; empty?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label} {values.length > 0 ? `(${values.length})` : ''}</p>
      {values.length > 0 ? (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span key={v} className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-700">{v}</span>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-sm text-neutral-400">{empty ?? 'None'}</p>
      )}
    </div>
  )
}
