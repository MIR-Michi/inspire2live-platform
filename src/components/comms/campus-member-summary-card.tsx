'use client'

import { useState } from 'react'
import { FounderBadge } from '@/components/comms/founder-badge'
import { saveCampusMember } from '@/app/app/comms/campus-log/actions'

type Initiative = { id: string; title: string }

type MemberSummaryProps = {
  id: string
  name: string
  country: string | null
  organisation: string | null
  role_description: string | null
  date_welcomed: string | null
  last_channel_activity: string | null
  welcomed_by_peter: boolean
  initiative_affiliations: string[] | null
  notes: string | null
  initiativeMap: Record<string, string>
  initiatives: Initiative[]
}

function formatDate(value: string | null) {
  if (!value) return 'Not set'
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value))
}

export function CampusMemberSummaryCard(props: MemberSummaryProps) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-neutral-900">Edit campus member</h2>
        <form
          action={saveCampusMember}
          onSubmit={() => setEditing(false)}
          className="grid gap-4 md:grid-cols-2"
        >
          <input type="hidden" name="member_id" value={props.id} />

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-neutral-800">Name</span>
            <input
              name="name"
              defaultValue={props.name}
              required
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-neutral-800">Country</span>
            <input
              name="country"
              defaultValue={props.country ?? ''}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-neutral-800">Organisation</span>
            <input
              name="organisation"
              defaultValue={props.organisation ?? ''}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-neutral-800">Role description</span>
            <input
              name="role_description"
              defaultValue={props.role_description ?? ''}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-neutral-800">Date welcomed</span>
            <input
              name="date_welcomed"
              type="date"
              defaultValue={props.date_welcomed?.slice(0, 10) ?? ''}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-neutral-800">Last channel activity</span>
            <input
              name="last_channel_activity"
              type="date"
              defaultValue={props.last_channel_activity?.slice(0, 10) ?? ''}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              name="welcomed_by_peter"
              value="true"
              defaultChecked={props.welcomed_by_peter}
              className="h-4 w-4"
            />
            <span className="font-semibold text-neutral-800">Welcomed by Peter</span>
          </label>

          {props.initiatives.length > 0 && (
            <fieldset className="space-y-2 md:col-span-2">
              <legend className="text-sm font-semibold text-neutral-800">Initiative affiliations</legend>
              <div className="grid gap-2 md:grid-cols-3">
                {props.initiatives.map((initiative) => (
                  <label
                    key={initiative.id}
                    className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="initiative_affiliations"
                      value={initiative.id}
                      defaultChecked={(props.initiative_affiliations ?? []).includes(initiative.id)}
                      className="h-4 w-4"
                    />
                    {initiative.title}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <label className="block space-y-1 md:col-span-2">
            <span className="text-sm font-semibold text-neutral-800">Notes</span>
            <textarea
              name="notes"
              defaultValue={props.notes ?? ''}
              rows={4}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
          </label>

          <div className="flex gap-2 md:col-span-2">
            <button
              type="submit"
              className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
            >
              Save changes
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {props.welcomed_by_peter && <FounderBadge label="Welcomed by Peter" />}
            {props.country && (
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-700">
                {props.country}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-neutral-900">{props.name}</h1>
            <p className="text-sm text-neutral-500">
              {[props.organisation, props.role_description].filter(Boolean).join(' · ') ||
                'Role details still to be refined'}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-neutral-500">
            <span>Date welcomed: {formatDate(props.date_welcomed)}</span>
            <span>Last channel activity: {formatDate(props.last_channel_activity)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(props.initiative_affiliations ?? []).map((initiativeId) => (
              <span
                key={initiativeId}
                className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700"
              >
                {props.initiativeMap[initiativeId] ?? initiativeId}
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
        >
          Edit
        </button>
      </div>

      {props.notes && (
        <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-sm leading-6 text-neutral-700">{props.notes}</p>
        </div>
      )}
    </div>
  )
}
