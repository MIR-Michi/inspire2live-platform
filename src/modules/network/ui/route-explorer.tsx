'use client'

/**
 * network/ui/route-explorer.tsx — the two asks, kept apart.
 *
 * Concept §8. The screen makes the distinction the model makes: the **map
 * question** is cheap, commits nobody and can go to several people at once; the
 * **favour** is expensive and goes to one confirmed contact. They are separate
 * controls with separate wording, because collapsing them into one button is
 * exactly how a network gets worn out.
 *
 * A route with an unconfirmed hop is shown as a *guess* and can only be acted on
 * by asking the map question — the platform never offers to trade on a
 * relationship nobody has confirmed.
 */

import { useState, useTransition } from 'react'
import { StatusBadge } from '@/kernel/ui'
import { CONNECTION_TYPE_META } from '@/modules/network/domain/connection-strength'
import type { NamedRoute } from '@/modules/network/domain/routes'
import { askConnectionCheck, requestIntroduction } from '@/modules/network/domain/actions'

type Props = {
  personId: string
  personName: string
  /** Ranked, capped and named by `loadRoutesForPerson`. */
  routes: NamedRoute[]
  /** What the introducer would be asked about, in one line. */
  contextSummary: string
  /** Generic context pointer — `('podcast_candidate', <id>)` for the planner. */
  contextType: string
  contextId?: string | null
  /** Members already asked the map question about this person. */
  alreadyAsked?: string[]
}

function strengthTone(strength: number): 'green' | 'blue' | 'amber' {
  if (strength >= 0.8) return 'green'
  if (strength >= 0.5) return 'blue'
  return 'amber'
}

export function RouteExplorer({
  personId,
  personName,
  routes,
  contextSummary,
  contextType,
  contextId,
  alreadyAsked = [],
}: Props) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [asked, setAsked] = useState<string[]>(alreadyAsked)

  function ask(profileId: string) {
    startTransition(async () => {
      const result = await askConnectionCheck({ profileId, personId, contextNote: contextSummary })
      if (result.ok) {
        setAsked((prev) => [...prev, profileId])
        setMessage({ tone: 'ok', text: 'Asked. It costs them five seconds and commits nobody.' })
      } else {
        setMessage({ tone: 'error', text: result.error })
      }
    })
  }

  function favour(route: NamedRoute) {
    startTransition(async () => {
      const result = await requestIntroduction({
        introducerProfileId: route.introducerProfileId,
        personId,
        contextType,
        contextId,
        contextSummary,
        connectionId: route.connectionId,
      })
      setMessage(
        result.ok
          ? { tone: 'ok', text: `Asked ${route.introducerName}. They write to ${personName} in their own words — nothing is sent for them.` }
          : { tone: 'error', text: result.error },
      )
    })
  }

  if (routes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-4 text-sm text-neutral-600">
        <p className="font-semibold text-neutral-800">No route found.</p>
        <p className="mt-1">
          Nobody in the network has a usable connection to {personName} yet. A cold approach needs a
          public hook — something they just published, a consultation, a stated interest in patient
          involvement.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {message && (
        <p
          role="status"
          className={`rounded-lg px-3 py-2 text-sm ${
            message.tone === 'ok'
              ? 'bg-emerald-50 text-emerald-800'
              : 'bg-amber-50 text-amber-900'
          }`}
        >
          {message.text}
        </p>
      )}

      <ul className="space-y-3">
        {routes.map((route, index) => (
          <li
            key={`${route.introducerProfileId}-${index}`}
            className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <StatusBadge label={`Route ${route.strength.toFixed(2)}`} tone={strengthTone(route.strength)} />
                <StatusBadge
                  label={route.steps === 1 ? 'One introduction' : 'Two steps'}
                  tone="neutral"
                />
                <StatusBadge
                  label={route.confirmed ? 'Confirmed' : 'Guess — not confirmed'}
                  tone={route.confirmed ? 'green' : 'amber'}
                />
              </div>
              <p className="text-sm font-semibold text-neutral-900">{route.introducerName}</p>
            </div>

            <ol className="mt-3 space-y-1.5">
              {route.hops.map((hop, hopIndex) => (
                <li key={hopIndex} className="flex flex-wrap items-baseline gap-x-2 text-sm text-neutral-700">
                  <span className="font-medium text-neutral-900">
                    {route.names[`${hop.fromType}:${hop.fromId}`] ?? 'A member'}
                  </span>
                  <span aria-hidden="true" className="text-neutral-400">→</span>
                  <span className="font-medium text-neutral-900">
                    {route.names[`${hop.toType}:${hop.toId}`] ?? personName}
                  </span>
                  <span className="text-neutral-500">
                    {CONNECTION_TYPE_META[hop.connectionType].label.toLowerCase()} · {hop.strength}
                    {hop.evidenceSummary ? ` · ${hop.evidenceSummary}` : ''}
                  </span>
                </li>
              ))}
            </ol>

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
              {/* The cheap ask. Always available, deliberately not rate-limited. */}
              <button
                type="button"
                disabled={pending || asked.includes(route.introducerProfileId)}
                onClick={() => ask(route.introducerProfileId)}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
              >
                {asked.includes(route.introducerProfileId)
                  ? 'Asked whether they know them'
                  : 'Ask: do you know them?'}
              </button>

              {/* The favour. Only for a confirmed route. */}
              <button
                type="button"
                disabled={pending || !route.confirmed}
                onClick={() => favour(route)}
                title={
                  route.confirmed
                    ? undefined
                    : 'Confirm the connection first — the favour only goes to somebody who said they know them.'
                }
                className="rounded-lg bg-neutral-950 px-3 py-1.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Ask for an introduction
              </button>

              {!route.confirmed && (
                <span className="text-xs text-neutral-500">
                  Ask the cheap question first — a guess is not a relationship.
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
