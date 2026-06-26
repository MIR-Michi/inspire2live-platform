'use client'

import { useState, useTransition } from 'react'
import {
  applyIntakeAiSuggestion,
  dismissIntakeAiSuggestion,
  generateIntakeAiSuggestion,
  type IntakeAiActionState,
} from '@/app/app/comms/intake/ai-actions'
import { CONTENT_TYPE_META } from '@/lib/comms-workflow'

type IntakeAiSuggestion = {
  id: string
  source: 'ai' | 'deterministic_fallback' | 'batch'
  content_type: string
  summary: string
  entities: Array<{ name: string; type: string; value?: string | null }>
  suggested_channel: string | null
  suggested_action: string
  founder_signal: boolean
  confidence: string
  rationale: string | null
  model: string | null
  effort: string | null
  created_at: string
}

const INITIAL_STATE: IntakeAiActionState = { ok: false }

function actionLabel(action: string) {
  return action.replace(/^route_to_/, 'Route to ').replace(/_/g, ' ')
}

function sourceLabel(source: IntakeAiSuggestion['source']) {
  if (source === 'deterministic_fallback') return 'Rules fallback'
  if (source === 'batch') return 'Batch AI'
  return 'Claude AI'
}

export function IntakeAiSuggestionPanel({
  itemId,
  suggestion,
}: {
  itemId: string
  suggestion?: IntakeAiSuggestion | null
}) {
  const [state, setState] = useState<IntakeAiActionState>(INITIAL_STATE)
  const [pending, startTransition] = useTransition()

  const runAction = (action: typeof generateIntakeAiSuggestion | typeof applyIntakeAiSuggestion | typeof dismissIntakeAiSuggestion, key: 'intake_item_id' | 'suggestion_id', value: string) => {
    const formData = new FormData()
    formData.set(key, value)
    startTransition(async () => {
      const result = await action(INITIAL_STATE, formData)
      setState(result)
    })
  }

  if (!suggestion) {
    return (
      <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">AI structure</p>
            <p className="mt-1 text-sm text-blue-900">Generate a reviewable content-type, summary, entity, channel, and action suggestion.</p>
          </div>
          <button
            type="button"
            onClick={() => runAction(generateIntakeAiSuggestion, 'intake_item_id', itemId)}
            disabled={pending}
            className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-60"
          >
            {pending ? 'Generating...' : 'Generate AI suggestion'}
          </button>
        </div>
        {(state.error || state.message) && (
          <p className={`mt-2 text-xs ${state.ok ? 'text-emerald-700' : 'text-red-700'}`}>
            {state.ok ? state.message : state.error}
          </p>
        )}
      </div>
    )
  }

  const meta = CONTENT_TYPE_META[suggestion.content_type as keyof typeof CONTENT_TYPE_META] ?? CONTENT_TYPE_META.noise

  return (
    <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">AI suggestion</p>
          <p className="mt-1 text-sm font-semibold text-blue-950">{meta.label} · {suggestion.confidence} confidence</p>
          <p className="mt-1 text-sm leading-6 text-blue-900">{suggestion.summary}</p>
        </div>
        <span className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-700">
          {sourceLabel(suggestion.source)}
        </span>
      </div>

      <div className="grid gap-2 text-xs text-blue-900 md:grid-cols-3">
        <div className="rounded-lg bg-white/80 px-3 py-2">
          <span className="font-semibold">Action:</span> {actionLabel(suggestion.suggested_action)}
        </div>
        <div className="rounded-lg bg-white/80 px-3 py-2">
          <span className="font-semibold">Channel:</span> {suggestion.suggested_channel ?? 'None'}
        </div>
        <div className="rounded-lg bg-white/80 px-3 py-2">
          <span className="font-semibold">Founder signal:</span> {suggestion.founder_signal ? 'Yes' : 'No'}
        </div>
      </div>

      {suggestion.entities.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {suggestion.entities.slice(0, 6).map((entity) => (
            <span key={`${suggestion.id}-${entity.type}-${entity.name}`} className="rounded-full border border-blue-200 bg-white px-3 py-1 font-medium text-blue-800">
              {entity.name} · {entity.type}
            </span>
          ))}
        </div>
      )}

      {suggestion.rationale && <p className="text-xs text-blue-800">{suggestion.rationale}</p>}

      {(state.error || state.message) && (
        <p className={`text-xs ${state.ok ? 'text-emerald-700' : 'text-red-700'}`}>
          {state.ok ? state.message : state.error}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => runAction(generateIntakeAiSuggestion, 'intake_item_id', itemId)}
          disabled={pending}
          className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-60"
        >
          Regenerate
        </button>
        <button
          type="button"
          onClick={() => runAction(dismissIntakeAiSuggestion, 'suggestion_id', suggestion.id)}
          disabled={pending}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60"
        >
          Dismiss suggestion
        </button>
        <button
          type="button"
          onClick={() => runAction(applyIntakeAiSuggestion, 'suggestion_id', suggestion.id)}
          disabled={pending}
          className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-800 disabled:bg-blue-300"
        >
          {pending ? 'Applying...' : 'Apply suggestion'}
        </button>
      </div>
    </div>
  )
}
