'use client'

import { useState, useTransition } from 'react'
import { saveSettingsPanel } from '@/modules/settings-actions'
import type { ResolvedField } from '@/kernel/settings'
import { SettingsFieldControl } from '@/components/settings/settings-field-control'

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
    () => Object.fromEntries(fields.map((field) => [field.key, field.value])),
  )
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const set = (key: string, value: unknown) => {
    setValues((previous) => ({ ...previous, [key]: value }))
    setMessage(null)
  }

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
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
          <SettingsFieldControl
            key={field.key}
            field={field}
            value={values[field.key]}
            onChange={(value) => set(field.key, value)}
          />
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
