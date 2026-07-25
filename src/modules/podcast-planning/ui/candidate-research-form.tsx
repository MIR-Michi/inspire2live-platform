'use client'

/**
 * podcast-planning/ui/candidate-research-form.tsx — the Research stage, on one card.
 *
 * Concept §3: Research answers four things — is this the right person, is now a
 * good moment for them, do they do this sort of thing, and how would we reach
 * them. Each control here is one of those four, worded as the question rather
 * than as a field name, so filling the form *is* doing the research.
 */

import { useState, useTransition } from 'react'
import { ROUTE_META } from '@/modules/podcast-planning/domain/types'
import type {
  CandidateRoute,
  PriorRefusal,
  QuestionCandidate,
  RecentAppearance,
} from '@/modules/podcast-planning/domain/types'
import { recordResearch } from '@/modules/podcast-planning/domain/actions'

const ROUTES = Object.keys(ROUTE_META) as CandidateRoute[]

const APPEARANCE_LABEL: Record<RecentAppearance, string> = {
  within_12_months: 'Yes, within twelve months',
  older: 'Yes, but longer ago',
  none: 'None found',
}

const REFUSAL_LABEL: Record<PriorRefusal, string> = {
  none: 'Never asked, or never refused',
  not_now: 'A “not now”',
  soft_no: 'A soft no',
  firm_no: 'A firm no',
}

export function CandidateResearchForm({ candidate }: { candidate: QuestionCandidate }) {
  const [angle, setAngle] = useState(candidate.angle ?? '')
  const [route, setRoute] = useState<CandidateRoute | ''>(candidate.route ?? '')
  const [appearance, setAppearance] = useState<RecentAppearance>(candidate.recentAppearance)
  const [goodMoment, setGoodMoment] = useState(candidate.goodMoment)
  const [practicalities, setPracticalities] = useState(candidate.practicalities)
  const [refusal, setRefusal] = useState<PriorRefusal>(candidate.priorRefusal)
  const [audience, setAudience] = useState(candidate.guestAudience)
  const [saved, setSaved] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      const result = await recordResearch(candidate.id, {
        angle: angle.trim() || null,
        route: (route || null) as CandidateRoute | null,
        recentAppearance: appearance,
        goodMoment,
        practicalities,
        priorRefusal: refusal,
        guestAudience: audience,
      })
      setSaved(result.ok ? 'Saved and rescored.' : result.error)
    })
  }

  return (
    <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50/60 p-3">
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-neutral-700">
          What can only this person say?
        </span>
        <textarea
          value={angle}
          onChange={(e) => setAngle(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          placeholder="The angle — not their seniority."
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-neutral-700">How would we reach them?</span>
          <select
            value={route}
            onChange={(e) => setRoute(e.target.value as CandidateRoute | '')}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          >
            <option value="">Not decided</option>
            {ROUTES.map((r) => (
              <option key={r} value={r}>
                {ROUTE_META[r].label} ({ROUTE_META[r].points} pts)
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Do they do this sort of thing?</span>
          <select
            value={appearance}
            onChange={(e) => setAppearance(e.target.value as RecentAppearance)}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          >
            {(Object.keys(APPEARANCE_LABEL) as RecentAppearance[]).map((a) => (
              <option key={a} value={a}>
                {APPEARANCE_LABEL[a]}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-semibold text-neutral-700">
            Is now a good moment for them? (0–3)
          </span>
          <input
            type="number"
            min={0}
            max={3}
            value={goodMoment}
            onChange={(e) => setGoodMoment(Number(e.target.value))}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Practicalities (0–3)</span>
          <input
            type="number"
            min={0}
            max={3}
            value={practicalities}
            onChange={(e) => setPracticalities(Number(e.target.value))}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Their audience (0–8)</span>
          <input
            type="number"
            min={0}
            max={8}
            value={audience}
            onChange={(e) => setAudience(Number(e.target.value))}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Have they said no before?</span>
          <select
            value={refusal}
            onChange={(e) => setRefusal(e.target.value as PriorRefusal)}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          >
            {(Object.keys(REFUSAL_LABEL) as PriorRefusal[]).map((r) => (
              <option key={r} value={r}>
                {REFUSAL_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center justify-between gap-3">
        {saved && <p className="text-xs text-neutral-600">{saved}</p>}
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="ml-auto rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          Save research
        </button>
      </div>
    </div>
  )
}
