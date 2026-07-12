'use client'

import { useMemo, useState } from 'react'
import { createEvent } from '@/app/app/comms/events/actions'
import {
  ATTENDANCE_KIND_OPTIONS,
  EVENT_TYPE_OPTIONS,
  getDefaultAttendanceKind,
  getEventSetupContent,
  normalizeI2LOwnedFlag,
  requiresOwnerAssignment,
  supportsAttendanceSetup,
} from '@/lib/comms-events'

type Option = { id: string; label: string }

export function EventCreateForm({ initiatives, people }: { initiatives: Option[]; people: Option[] }) {
  const [eventType, setEventType] = useState('conference')
  const [isI2lOrganised, setIsI2lOrganised] = useState(false)

  const effectiveI2lOwned = normalizeI2LOwnedFlag({
    eventType,
    isI2lOrganised,
  })
  const setup = useMemo(
    () =>
      getEventSetupContent({
        eventType,
        isI2lOrganised: effectiveI2lOwned,
      }),
    [eventType, effectiveI2lOwned]
  )
  const showAttendance = supportsAttendanceSetup({
    eventType,
    isI2lOrganised: effectiveI2lOwned,
  })
  const needsOwner = requiresOwnerAssignment({
    eventType,
    isI2lOrganised: effectiveI2lOwned,
  })

  return (
    <form action={createEvent} className="mt-4 grid gap-4 md:grid-cols-2">
      <label className="block space-y-2 md:col-span-2">
        <span className="text-sm font-semibold text-neutral-800">Event name</span>
        <input name="name" required className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-neutral-800">Event type</span>
        <select
          name="event_type"
          value={eventType}
          onChange={(event) => setEventType(event.target.value)}
          className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
        >
          {EVENT_TYPE_OPTIONS.map((eventTypeOption) => (
            <option key={eventTypeOption.value} value={eventTypeOption.value}>
              {eventTypeOption.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-neutral-500">{setup.typeHint}</p>
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-neutral-800">Start date</span>
        <input type="date" name="start_date" required className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-neutral-800">End date</span>
        <input type="date" name="end_date" className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
      </label>

      {eventType === 'podcast' ? (
        <>
          <input type="hidden" name="is_i2l_organised" value="true" />
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
            Podcasts are treated as I2L-owned events automatically.
          </div>
        </>
      ) : (
        <label className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
          <input
            type="checkbox"
            name="is_i2l_organised"
            value="true"
            checked={effectiveI2lOwned}
            onChange={(event) => setIsI2lOrganised(event.target.checked)}
          />
          I2L-organised conference
        </label>
      )}

      {needsOwner && (
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-neutral-800">{setup.ownerLabel}</span>
          <select
            name="owner_id"
            required
            defaultValue=""
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Select owner
            </option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.label}
              </option>
            ))}
          </select>
          {setup.ownerHelp && <p className="text-xs text-neutral-500">{setup.ownerHelp}</p>}
        </label>
      )}

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-neutral-800">{setup.organiserLabel}</span>
        <input
          name="organiser"
          placeholder={setup.organiserPlaceholder}
          className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-neutral-800">
          {eventType === 'podcast' ? 'Recording city' : 'City'}
        </span>
        <input name="location_city" className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-neutral-800">
          {eventType === 'podcast' ? 'Recording country' : 'Country'}
        </span>
        <input name="location_country" className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
      </label>

      {showAttendance ? (
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-neutral-800">{setup.attendanceKindLabel}</span>
          <select name="attendance_kind" defaultValue="visitor" className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm">
            {ATTENDANCE_KIND_OPTIONS.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input
          type="hidden"
          name="attendance_kind"
          value={getDefaultAttendanceKind({
            eventType,
            isI2lOrganised: effectiveI2lOwned,
          })}
        />
      )}

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-neutral-800">{setup.websiteLabel}</span>
        <input
          type="url"
          name="event_website_url"
          placeholder={setup.websitePlaceholder}
          className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
        />
      </label>

      <label className="block space-y-2 md:col-span-2">
        <span className="text-sm font-semibold text-neutral-800">{setup.imageLabel}</span>
        <input
          type="url"
          name="event_image_url"
          placeholder={setup.imagePlaceholder}
          className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
        />
      </label>

      <label className="block space-y-2 md:col-span-2">
        <span className="text-sm font-semibold text-neutral-800">{setup.summaryLabel}</span>
        <textarea
          name="presentation_summary"
          rows={3}
          placeholder={setup.summaryPlaceholder}
          className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
        />
      </label>

      <label className="block space-y-2 md:col-span-2">
        <span className="text-sm font-semibold text-neutral-800">{setup.assetLabel}</span>
        <input
          type="url"
          name="presentation_asset_url"
          placeholder={setup.assetPlaceholder}
          className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
        />
      </label>

      <label className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900">
        <input type="checkbox" name="push_to_group_calendar" value="true" />
        Push to group calendar
      </label>

      {initiatives.length > 0 && (
        <div className="md:col-span-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-sm font-semibold text-neutral-800">Reference initiatives</p>
          <p className="mt-1 text-xs text-neutral-500">
            Linkage happens on the detail page, but these are the current initiatives available for follow-up.
          </p>
        </div>
      )}

      <label className="block space-y-2 md:col-span-2">
        <span className="text-sm font-semibold text-neutral-800">Notes</span>
        <textarea name="notes" rows={4} className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
      </label>

      <div className="md:col-span-2 flex justify-end">
        <button type="submit" className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700">
          Create event
        </button>
      </div>
    </form>
  )
}
