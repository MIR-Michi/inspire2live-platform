/**
 * network/ui/introductions-board.tsx — the Introductions screen.
 *
 * Concept §8: "the Introductions screen shows each person's request history, so
 * nobody is quietly over-drawn."
 *
 * The load table is the point of this screen. It is ordered by name, never by
 * doors opened, and it shows availability rather than a score — who opened which
 * door is recorded as **recognition, not a leaderboard**, because ranking people
 * by favours asked would corrode the culture that makes the network work.
 */

import { StatusBadge } from '@/kernel/ui'
import { summariseIntroducerLoad } from '@/modules/network/domain/fatigue'
import type { IntroductionRequest, NetworkConfig } from '@/modules/network/domain/types'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(value),
  )
}

const RESPONSE_LABEL: Record<string, { label: string; tone: 'green' | 'blue' | 'neutral' | 'amber' }> = {
  yes: { label: 'Will introduce', tone: 'green' },
  use_my_name: { label: 'Use my name', tone: 'blue' },
  declined: { label: 'Declined', tone: 'neutral' },
  no_reply: { label: 'No reply', tone: 'neutral' },
}

export function IntroductionsBoard({
  requests,
  memberNames,
  personNames,
  config,
}: {
  requests: IntroductionRequest[]
  memberNames: Record<string, string>
  personNames: Record<string, string>
  config: NetworkConfig
}) {
  const load = summariseIntroducerLoad(requests, { config })
  const open = requests.filter((r) => r.response === null)
  const closed = requests.filter((r) => r.response !== null)

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
          Waiting on an introducer ({open.length})
        </h3>
        {open.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-300 bg-white py-8 text-center text-sm text-neutral-500">
            Nothing outstanding.
          </p>
        ) : (
          <ul className="space-y-2">
            {open.map((request) => (
              <li
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-900">
                    {memberNames[request.introducerProfileId] ?? 'A member'} →{' '}
                    {personNames[request.personId] ?? 'a guest'}
                  </p>
                  <p className="text-xs text-neutral-500">
                    Asked {formatDate(request.requestedAt)}
                    {request.contextSummary ? ` · ${request.contextSummary}` : ''}
                  </p>
                </div>
                <StatusBadge label="Waiting" tone="amber" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
          Who has been asked
        </h3>
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-2 font-semibold">Member</th>
                <th className="px-4 py-2 font-semibold">Asked</th>
                <th className="px-4 py-2 font-semibold">Doors opened</th>
                <th className="px-4 py-2 font-semibold">Available</th>
              </tr>
            </thead>
            <tbody>
              {load.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                    Nobody has been asked for a favour yet.
                  </td>
                </tr>
              ) : (
                load.map((row) => (
                  <tr key={row.profileId} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-neutral-900">
                      {memberNames[row.profileId] ?? 'A member'}
                    </td>
                    <td className="px-4 py-2.5 text-neutral-600">
                      {row.total} time{row.total === 1 ? '' : 's'}
                      {row.lastRequestAt ? ` · last ${formatDate(row.lastRequestAt)}` : ''}
                    </td>
                    <td className="px-4 py-2.5 text-neutral-600">{row.doorsOpened}</td>
                    <td className="px-4 py-2.5">
                      {row.available ? (
                        <StatusBadge label="Available" tone="green" />
                      ) : (
                        <StatusBadge
                          label={`In ${row.daysUntilAvailable} day${row.daysUntilAvailable === 1 ? '' : 's'}`}
                          tone="neutral"
                        />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-neutral-500">
          Nobody receives more than one favour request every {config.introducerCooldownDays} days.
          Declining carries no consequence and is not recorded against anyone — this table exists so
          nobody is quietly over-drawn, not to rank people.
        </p>
      </section>

      {closed.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
            Answered ({closed.length})
          </h3>
          <ul className="space-y-2">
            {closed.slice(0, 20).map((request) => {
              const meta = RESPONSE_LABEL[request.response ?? 'no_reply']
              return (
                <li
                  key={request.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-800">
                      {memberNames[request.introducerProfileId] ?? 'A member'} →{' '}
                      {personNames[request.personId] ?? 'a guest'}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {request.respondedAt ? formatDate(request.respondedAt) : ''}
                      {request.introSentAt ? ' · introduction made' : ''}
                    </p>
                  </div>
                  <StatusBadge label={meta.label} tone={meta.tone} />
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
