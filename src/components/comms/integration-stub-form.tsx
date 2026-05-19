'use client'

import { useActionState } from 'react'
import type { StubActionState } from '@/app/app/comms/integration-actions'

const INITIAL_STATE: StubActionState = { ok: false }

export function IntegrationStubForm({
  action,
  entityId,
  buttonLabel,
  className,
  hiddenFields,
}: {
  action: (state: StubActionState, formData: FormData) => Promise<StubActionState>
  entityId: string
  buttonLabel: string
  className: string
  hiddenFields?: Array<{ name: string; value: string }>
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE)

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="entity_id" value={entityId} />
      {hiddenFields?.map((field) => (
        <input key={`${field.name}-${field.value}`} type="hidden" name={field.name} value={field.value} />
      ))}
      <button type="submit" disabled={pending} className={className}>
        {pending ? 'Logging…' : buttonLabel}
      </button>
      {state.error && <p className="text-xs text-red-700">{state.error}</p>}
      {state.ok && state.message && <p className="text-xs text-emerald-700">{state.message}</p>}
    </form>
  )
}
