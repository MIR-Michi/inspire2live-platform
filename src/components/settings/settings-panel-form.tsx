'use client'

/**
 * settings-panel-form.tsx
 *
 * The single, type-driven renderer for every Platform Settings panel (ADR-0010
 * §5). It draws one control per resolved field based on the field's declared
 * `type` — so adding a `ConfigField` to a manifest (or a kernel panel) surfaces
 * a working control here with no bespoke form code. Kernel and component panels
 * use this same component.
 */

import { useState, useTransition } from 'react'
import { saveSettingsPanel } from '@/modules/settings-actions'
import type { ResolvedField } from '@/kernel/settings'

function humanize(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase())
}

export function SettingsPanelForm({
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
  const [values, setValues] = useState<Record<string, unknown>>(
    () => Object.fromEntries(fields.map((f) => [f.key, f.value])),
  )
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const set = (key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setMessage(null)
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const result = await saveSettingsPanel(panelId, values)
      setMessage(
        result.ok
          ? { ok: true, text: `Saved ${result.saved} setting${result.saved === 1 ? '' : 's'}.` }
          : { ok: false, text: result.error },
      )
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-neutral-500">{description}</p>}
      </div>

      <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        {fields.map((field) => (
          <Field key={field.key} field={field} value={values[field.key]} onChange={(v) => set(field.key, v)} />
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save changes'}
        </button>
        {message && (
          <span className={`text-sm ${message.ok ? 'text-emerald-600' : 'text-red-600'}`}>
            {message.text}
          </span>
        )}
      </div>
    </form>
  )
}

function Field({
  field,
  value,
  onChange,
}: {
  field: ResolvedField
  value: unknown
  onChange: (v: unknown) => void
}) {
  const label = field.label ?? humanize(field.key)
  const id = `setting-${field.key}`
  const baseInput =
    'mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500'

  return (
    <div>
      <label htmlFor={id} className="flex items-center justify-between text-sm font-medium text-neutral-800">
        <span>{label}</span>
        {field.source === 'default' && <span className="text-[11px] font-normal text-neutral-400">default</span>}
        {field.source === 'db' && <span className="text-[11px] font-normal text-emerald-500">overridden</span>}
      </label>

      {field.type === 'boolean' ? (
        <label className="mt-1.5 inline-flex cursor-pointer items-center gap-2">
          <input
            id={id}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 text-orange-600 focus:ring-orange-500"
          />
          <span className="text-sm text-neutral-600">Enabled</span>
        </label>
      ) : field.type === 'enum' ? (
        <select id={id} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className={baseInput}>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : field.type === 'text' ? (
        <textarea id={id} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} rows={3} className={baseInput} />
      ) : field.type === 'color' ? (
        <div className="mt-1 flex items-center gap-2">
          <input
            aria-label={label}
            type="color"
            value={String(value || '#000000')}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded border border-neutral-300"
          />
          <input id={id} type="text" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className={`${baseInput} mt-0 flex-1`} />
        </div>
      ) : field.type === 'secret' ? (
        <div className="mt-1">
          <input id={id} type="text" value={String(value ?? '')} readOnly disabled className={`${baseInput} bg-neutral-50 text-neutral-400`} />
          <p className="mt-1 text-[11px] text-neutral-400">
            Managed as a secret{field.secretRef ? ` (env: ${field.secretRef})` : ''} — never stored in platform settings.
          </p>
        </div>
      ) : (
        <input
          id={id}
          type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
          min={field.type === 'number' ? field.min : undefined}
          max={field.type === 'number' ? field.max : undefined}
          step={field.type === 'number' ? field.step : undefined}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className={baseInput}
        />
      )}

      {field.description && <p className="mt-1 text-xs text-neutral-500">{field.description}</p>}
    </div>
  )
}
