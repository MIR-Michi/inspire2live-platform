'use client'

/**
 * network/ui/affiliation-profile-form.tsx — the opt-in declaration.
 *
 * Concept §8, first mechanism. Members do **not** upload contacts; they tick
 * contexts. That is a very different thing to ask for and a very different thing
 * to store, and the form is written to make the difference obvious.
 *
 * Consent is per item and revocable. "Keep private" is offered next to every
 * entry rather than buried in a settings page, and removing an entry is one
 * click — consent that cannot be withdrawn is not consent.
 */

import { useState, useTransition } from 'react'
import { AFFILIATION_KIND_META } from '@/modules/network/domain/types'
import type { AffiliationKind, MemberAffiliation } from '@/modules/network/domain/types'
import {
  declareMemberAffiliation,
  revokeMemberAffiliation,
  setMemberAffiliationVisibility,
} from '@/modules/network/domain/actions'

const KINDS = Object.keys(AFFILIATION_KIND_META) as AffiliationKind[]

export function AffiliationProfileForm({
  profileId,
  affiliations,
}: {
  profileId: string
  affiliations: MemberAffiliation[]
}) {
  const [items, setItems] = useState(affiliations)
  const [kind, setKind] = useState<AffiliationKind>('institution')
  const [name, setName] = useState('')
  const [fromYear, setFromYear] = useState('')
  const [toYear, setToYear] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function add() {
    if (!name.trim()) return
    startTransition(async () => {
      const result = await declareMemberAffiliation({
        profileId,
        kind,
        name: name.trim(),
        fromYear: fromYear ? Number(fromYear) : null,
        toYear: toYear ? Number(toYear) : null,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setItems((prev) => [
        ...prev,
        {
          id: result.data?.id ?? `tmp-${Date.now()}`,
          profileId,
          kind,
          name: name.trim(),
          fromYear: fromYear ? Number(fromYear) : null,
          toYear: toYear ? Number(toYear) : null,
          visibility: 'network',
        },
      ])
      setName('')
      setFromYear('')
      setToYear('')
      setError(null)
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await revokeMemberAffiliation(id)
      if (result.ok) setItems((prev) => prev.filter((i) => i.id !== id))
      else setError(result.error)
    })
  }

  function toggleVisibility(item: MemberAffiliation) {
    const next = item.visibility === 'network' ? 'private' : 'network'
    startTransition(async () => {
      const result = await setMemberAffiliationVisibility(item.id, next)
      if (result.ok) {
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, visibility: next } : i)))
      } else {
        setError(result.error)
      }
    })
  }

  const showsYears = kind === 'institution' || kind === 'university'

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="text-base font-semibold text-neutral-900">Where you have been</h3>
        <p className="mt-1 text-sm leading-6 text-neutral-600">
          Tick the contexts you have been part of. This is <strong>not</strong> a contact upload —
          nobody sees your address book, and no message is ever sent on your behalf. Overlaps
          suggest that you <em>might</em> have a route to somebody; you are always asked before
          anything happens. Every line is optional, can be kept private, and can be removed at any
          time.
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </p>
      )}

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)_auto]">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-neutral-700">Kind</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as AffiliationKind)}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {AFFILIATION_KIND_META[k].label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold text-neutral-700">
              {AFFILIATION_KIND_META[kind].help}
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            />
          </label>

          <div className="flex items-end gap-2">
            {showsYears && (
              <>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-neutral-700">From</span>
                  <input
                    value={fromYear}
                    onChange={(e) => setFromYear(e.target.value)}
                    inputMode="numeric"
                    placeholder="2014"
                    className="w-20 rounded-lg border border-neutral-200 px-2 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-neutral-700">To</span>
                  <input
                    value={toYear}
                    onChange={(e) => setToYear(e.target.value)}
                    inputMode="numeric"
                    placeholder="2019"
                    className="w-20 rounded-lg border border-neutral-200 px-2 py-2 text-sm"
                  />
                </label>
              </>
            )}
            <button
              type="button"
              onClick={add}
              disabled={pending || !name.trim()}
              className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
        {showsYears && (
          <p className="mt-2 text-xs text-neutral-500">
            Rough years are enough. They are only used so that working somewhere a decade apart does
            not count as a connection.
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white py-8 text-center text-sm text-neutral-500">
          Nothing declared yet. Declining is completely fine and is invisible to everyone else.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-900">{item.name}</p>
                <p className="text-xs text-neutral-500">
                  {AFFILIATION_KIND_META[item.kind].label}
                  {item.fromYear || item.toYear
                    ? ` · ${item.fromYear ?? '…'}–${item.toYear ?? 'now'}`
                    : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleVisibility(item)}
                  disabled={pending}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                >
                  {item.visibility === 'network' ? 'Usable for routes' : 'Kept private'}
                </button>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  disabled={pending}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-neutral-500 hover:text-red-700 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
