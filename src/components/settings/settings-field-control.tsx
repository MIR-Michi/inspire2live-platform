'use client'

import type { ResolvedField } from '@/kernel/settings'

function humanize(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase())
}

export function SettingsFieldControl({
  field,
  value,
  onChange,
}: {
  field: ResolvedField
  value: unknown
  onChange: (value: unknown) => void
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
        <label className="mt-1.5 inline-flex min-h-11 cursor-pointer items-center gap-2">
          <input
            id={id}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(event.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 text-orange-600 focus:ring-orange-500"
          />
          <span className="text-sm text-neutral-600">Enabled</span>
        </label>
      ) : field.type === 'enum' ? (
        <select id={id} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} className={baseInput}>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      ) : field.type === 'text' ? (
        <textarea id={id} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} rows={3} className={baseInput} />
      ) : field.type === 'color' ? (
        <div className="mt-1 flex items-center gap-2">
          <input
            aria-label={label}
            type="color"
            value={String(value || '#000000')}
            onChange={(event) => onChange(event.target.value)}
            className="h-9 w-12 cursor-pointer rounded border border-neutral-300"
          />
          <input id={id} type="text" value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} className={`${baseInput} mt-0 flex-1`} />
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
          onChange={(event) => onChange(event.target.value)}
          className={baseInput}
        />
      )}

      {field.description && <p className="mt-1 text-xs text-neutral-500">{field.description}</p>}
    </div>
  )
}
