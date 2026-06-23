import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  linkEventInitiative,
  saveEventSection,
  togglePodcastWorkflowItem,
  transitionEventStage,
} from '@/app/app/comms/events/actions'
import { triggerEventTeamsStub } from '@/app/app/comms/integration-actions'
import { IntegrationStubForm } from '@/components/comms/integration-stub-form'
import { OptionalField } from '@/components/comms/optional-field'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  ATTENDANCE_KIND_OPTIONS,
  EVENT_TYPE_OPTIONS,
  PODCAST_DISTRIBUTION_CHANNEL_OPTIONS,
  PODCAST_RECORDING_MODE_OPTIONS,
  PODCAST_WORKFLOW_SECTIONS,
  formatDelimitedList,
  formatTokenLabel,
  getEventSetupMode,
  getEventTypeLabel,
  getPodcastWorkflowProgress,
  isI2LOwnedEvent,
  isPodcastEventType,
} from '@/lib/comms-events'
import { getIntegrationStubFlags } from '@/lib/comms-integrations'
import { EVENT_STAGE_META, type EventStage } from '@/lib/comms-workflow'
import { createClient } from '@/lib/supabase/server'

// ─── DB select strings ───────────────────────────────────────────────────────

const EVENT_SELECT =
  'id, name, event_type, start_date, end_date, location_city, location_country, organiser, owner_id, stage, is_annual_congress, is_i2l_organised, attendance_kind, presentation_summary, presentation_asset_url, event_image_url, event_website_url, push_to_group_calendar, initiative_ids, i2l_representatives, output_report_drafted, output_linkedin_published, output_newsletter_mentioned, output_media_stored, notes, podcast_series_name, podcast_episode_title, podcast_hosts, podcast_guests, podcast_recording_mode, podcast_distribution_channels, podcast_recording_link, podcast_preparation_notes, podcast_run_of_show, podcast_followup_notes, podcast_guest_confirmed, podcast_brief_ready, podcast_release_form_ready, podcast_equipment_ready, podcast_recording_completed, podcast_backup_completed, podcast_edit_completed, podcast_transcript_completed, podcast_show_notes_completed, podcast_published, podcast_followup_completed'

const EVENT_FALLBACK_SELECT =
  'id, name, event_type, start_date, end_date, location_city, location_country, organiser, stage, is_annual_congress, initiative_ids, i2l_representatives, output_report_drafted, output_linkedin_published, output_newsletter_mentioned, output_media_stored, notes'

// ─── Helpers ─────────────────────────────────────────────────────────────────

type EventRecord = {
  id: string
  name: string
  event_type: string
  start_date: string
  end_date: string | null
  location_city: string | null
  location_country: string | null
  organiser: string | null
  owner_id: string | null
  stage: string
  is_annual_congress: boolean
  is_i2l_organised: boolean
  attendance_kind: string | null
  presentation_summary: string | null
  presentation_asset_url: string | null
  event_image_url: string | null
  event_website_url: string | null
  push_to_group_calendar: boolean
  initiative_ids: string[] | null
  i2l_representatives: string[] | null
  output_report_drafted: boolean
  output_linkedin_published: boolean
  output_newsletter_mentioned: boolean
  output_media_stored: boolean
  notes: string | null
  podcast_series_name: string | null
  podcast_episode_title: string | null
  podcast_hosts: string[]
  podcast_guests: string[]
  podcast_recording_mode: string
  podcast_distribution_channels: string[]
  podcast_recording_link: string | null
  podcast_preparation_notes: string | null
  podcast_run_of_show: string | null
  podcast_followup_notes: string | null
  podcast_guest_confirmed: boolean
  podcast_brief_ready: boolean
  podcast_release_form_ready: boolean
  podcast_equipment_ready: boolean
  podcast_recording_completed: boolean
  podcast_backup_completed: boolean
  podcast_edit_completed: boolean
  podcast_transcript_completed: boolean
  podcast_show_notes_completed: boolean
  podcast_published: boolean
  podcast_followup_completed: boolean
}

function withDefaults(event: Record<string, unknown>): EventRecord {
  return {
    id: (event.id as string) ?? '',
    name: (event.name as string) ?? '',
    event_type: (event.event_type as string) ?? 'conference',
    start_date: (event.start_date as string) ?? '',
    end_date: (event.end_date as string | null) ?? null,
    location_city: (event.location_city as string | null) ?? null,
    location_country: (event.location_country as string | null) ?? null,
    organiser: (event.organiser as string | null) ?? null,
    owner_id: (event.owner_id as string | null) ?? null,
    stage: (event.stage as string) ?? 'announced',
    is_annual_congress: Boolean(event.is_annual_congress),
    is_i2l_organised: Boolean(event.is_i2l_organised),
    attendance_kind: (event.attendance_kind as string | null) ?? 'visitor',
    presentation_summary: (event.presentation_summary as string | null) ?? null,
    presentation_asset_url: (event.presentation_asset_url as string | null) ?? null,
    event_image_url: (event.event_image_url as string | null) ?? null,
    event_website_url: (event.event_website_url as string | null) ?? null,
    push_to_group_calendar: Boolean(event.push_to_group_calendar),
    initiative_ids: (event.initiative_ids as string[] | null) ?? null,
    i2l_representatives: (event.i2l_representatives as string[] | null) ?? null,
    output_report_drafted: Boolean(event.output_report_drafted),
    output_linkedin_published: Boolean(event.output_linkedin_published),
    output_newsletter_mentioned: Boolean(event.output_newsletter_mentioned),
    output_media_stored: Boolean(event.output_media_stored),
    notes: (event.notes as string | null) ?? null,
    podcast_series_name: (event.podcast_series_name as string | null) ?? null,
    podcast_episode_title: (event.podcast_episode_title as string | null) ?? null,
    podcast_hosts: (event.podcast_hosts as string[] | null) ?? [],
    podcast_guests: (event.podcast_guests as string[] | null) ?? [],
    podcast_recording_mode: (event.podcast_recording_mode as string | null) ?? 'remote',
    podcast_distribution_channels: (event.podcast_distribution_channels as string[] | null) ?? [],
    podcast_recording_link: (event.podcast_recording_link as string | null) ?? null,
    podcast_preparation_notes: (event.podcast_preparation_notes as string | null) ?? null,
    podcast_run_of_show: (event.podcast_run_of_show as string | null) ?? null,
    podcast_followup_notes: (event.podcast_followup_notes as string | null) ?? null,
    podcast_guest_confirmed: Boolean(event.podcast_guest_confirmed),
    podcast_brief_ready: Boolean(event.podcast_brief_ready),
    podcast_release_form_ready: Boolean(event.podcast_release_form_ready),
    podcast_equipment_ready: Boolean(event.podcast_equipment_ready),
    podcast_recording_completed: Boolean(event.podcast_recording_completed),
    podcast_backup_completed: Boolean(event.podcast_backup_completed),
    podcast_edit_completed: Boolean(event.podcast_edit_completed),
    podcast_transcript_completed: Boolean(event.podcast_transcript_completed),
    podcast_show_notes_completed: Boolean(event.podcast_show_notes_completed),
    podcast_published: Boolean(event.podcast_published),
    podcast_followup_completed: Boolean(event.podcast_followup_completed),
  }
}

function formatDateRange(startDate: string, endDate: string | null) {
  const fmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' })
  if (!endDate || endDate === startDate) return fmt.format(new Date(startDate + 'T00:00:00'))
  const start = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(
    new Date(startDate + 'T00:00:00')
  )
  return `${start} – ${fmt.format(new Date(endDate + 'T00:00:00'))}`
}

// ─── Sub-components (server) ─────────────────────────────────────────────────

function ChecklistItem({
  eventId,
  field,
  label,
  done,
}: {
  eventId: string
  field: string
  label: string
  done: boolean
}) {
  return (
    <form action={togglePodcastWorkflowItem} className="flex items-center gap-3">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="field" value={field} />
      <input type="hidden" name="next_value" value={done ? 'false' : 'true'} />
      <button
        type="submit"
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition hover:bg-neutral-50 ${
          done ? 'text-emerald-700' : 'text-neutral-600'
        }`}
      >
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
            done
              ? 'border-emerald-400 bg-emerald-50 text-emerald-600'
              : 'border-neutral-300 bg-white text-transparent'
          }`}
        >
          ✓
        </span>
        <span className={done ? 'line-through opacity-60' : ''}>{label}</span>
      </button>
    </form>
  )
}

const FIELD_CLS =
  'w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400'
const LABEL_CLS = 'block space-y-1.5'
const LABEL_TEXT_CLS = 'text-xs font-semibold text-neutral-500 uppercase tracking-wide'

// ─── Phase panels ─────────────────────────────────────────────────────────────

function PodcastSetupPanel({
  event,
  profiles,
}: {
  event: EventRecord
  profiles: { id: string; name: string | null; email: string }[]
}) {
  const setupItems = PODCAST_WORKFLOW_SECTIONS[0].items
  const hasImage = Boolean(event.event_image_url)
  const hasAsset = Boolean(event.presentation_asset_url)
  const hasPrep = Boolean(event.podcast_preparation_notes)

  return (
    <div className="space-y-6">
      {/* Checklist */}
      <div>
        <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Checklist</p>
        <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
          {setupItems.map((item) => (
            <ChecklistItem
              key={item.field}
              eventId={event.id}
              field={item.field}
              label={item.label}
              done={Boolean(event[item.field as keyof EventRecord])}
            />
          ))}
        </div>
      </div>

      {/* Save form for all setup fields */}
      <form action={saveEventSection} className="space-y-5 rounded-xl border border-neutral-200 bg-white p-5">
        <input type="hidden" name="event_id" value={event.id} />
        <input type="hidden" name="section" value="podcast_setup" />

        {/* Event basics */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={`${LABEL_CLS} col-span-full`}>
            <span className={LABEL_TEXT_CLS}>Episode / event name</span>
            <input name="name" defaultValue={event.name} required className={FIELD_CLS} />
          </label>
          <label className={LABEL_CLS}>
            <span className={LABEL_TEXT_CLS}>Date</span>
            <input type="date" name="start_date" defaultValue={event.start_date} required className={FIELD_CLS} />
          </label>
          <label className={LABEL_CLS}>
            <span className={LABEL_TEXT_CLS}>End date</span>
            <input type="date" name="end_date" defaultValue={event.end_date ?? ''} className={FIELD_CLS} />
          </label>
          <label className={LABEL_CLS}>
            <span className={LABEL_TEXT_CLS}>City</span>
            <input name="location_city" defaultValue={event.location_city ?? ''} className={FIELD_CLS} />
          </label>
          <label className={LABEL_CLS}>
            <span className={LABEL_TEXT_CLS}>Country</span>
            <input name="location_country" defaultValue={event.location_country ?? ''} className={FIELD_CLS} />
          </label>
          <label className={`${LABEL_CLS} col-span-full`}>
            <span className={LABEL_TEXT_CLS}>Publishing partner</span>
            <input
              name="organiser"
              defaultValue={event.organiser ?? ''}
              placeholder="Studio, platform, or distribution partner"
              className={FIELD_CLS}
            />
          </label>
        </div>

        <hr className="border-neutral-100" />

        {/* People */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={LABEL_CLS}>
            <span className={LABEL_TEXT_CLS}>Owner</span>
            <select name="owner_id" defaultValue={event.owner_id ?? ''} className={FIELD_CLS}>
              <option value="">Unassigned</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name ?? p.email}
                </option>
              ))}
            </select>
          </label>
          <label className={LABEL_CLS}>
            <span className={LABEL_TEXT_CLS}>Series name</span>
            <input
              name="podcast_series_name"
              defaultValue={event.podcast_series_name ?? ''}
              placeholder="e.g. Inspire2Live Conversations"
              className={FIELD_CLS}
            />
          </label>
          <label className={LABEL_CLS}>
            <span className={LABEL_TEXT_CLS}>Host(s)</span>
            <input
              name="podcast_hosts"
              defaultValue={formatDelimitedList(event.podcast_hosts)}
              placeholder="Comma-separated"
              className={FIELD_CLS}
            />
          </label>
          <label className={LABEL_CLS}>
            <span className={LABEL_TEXT_CLS}>Guest(s)</span>
            <input
              name="podcast_guests"
              defaultValue={formatDelimitedList(event.podcast_guests)}
              placeholder="Comma-separated"
              className={FIELD_CLS}
            />
          </label>
        </div>

        <hr className="border-neutral-100" />

        {/* Recording */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={LABEL_CLS}>
            <span className={LABEL_TEXT_CLS}>Recording mode</span>
            <select name="podcast_recording_mode" defaultValue={event.podcast_recording_mode} className={FIELD_CLS}>
              {PODCAST_RECORDING_MODE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className={LABEL_CLS}>
            <span className={LABEL_TEXT_CLS}>Recording room / link</span>
            <input
              type="url"
              name="podcast_recording_link"
              defaultValue={event.podcast_recording_link ?? ''}
              placeholder="Riverside, Zoom, Teams…"
              className={FIELD_CLS}
            />
          </label>
        </div>

        <hr className="border-neutral-100" />

        {/* Optional fields */}
        <div className="flex flex-wrap gap-4">
          <label className={`${LABEL_CLS} ${hasImage ? 'w-full' : 'hidden'}`} id="field-image">
            <span className={LABEL_TEXT_CLS}>Cover art / guest image</span>
            <input type="url" name="event_image_url" defaultValue={event.event_image_url ?? ''} className={FIELD_CLS} />
          </label>
          {!hasImage && <input type="hidden" name="event_image_url" value="" />}

          <label className={`${LABEL_CLS} ${hasAsset ? 'w-full' : 'hidden'}`} id="field-asset">
            <span className={LABEL_TEXT_CLS}>Brief / script / asset link</span>
            <input
              type="url"
              name="presentation_asset_url"
              defaultValue={event.presentation_asset_url ?? ''}
              className={FIELD_CLS}
            />
          </label>
          {!hasAsset && <input type="hidden" name="presentation_asset_url" value="" />}

          <label className={`${LABEL_CLS} ${hasPrep ? 'w-full' : 'hidden'}`} id="field-prep">
            <span className={LABEL_TEXT_CLS}>Prep notes</span>
            <textarea
              name="podcast_preparation_notes"
              rows={3}
              defaultValue={event.podcast_preparation_notes ?? ''}
              className={FIELD_CLS}
            />
          </label>
          {!hasPrep && <input type="hidden" name="podcast_preparation_notes" value="" />}
        </div>

        {/* "+ Add" affordances for empty optional fields */}
        <div className="flex flex-wrap gap-4">
          {!hasImage && (
            <OptionalField label="Add cover art" hasValue={false}>
              <label className={`${LABEL_CLS} w-full`}>
                <span className={LABEL_TEXT_CLS}>Cover art / guest image</span>
                <input type="url" name="event_image_url" defaultValue="" className={FIELD_CLS} />
              </label>
            </OptionalField>
          )}
          {!hasAsset && (
            <OptionalField label="Add brief / script link" hasValue={false}>
              <label className={`${LABEL_CLS} w-full`}>
                <span className={LABEL_TEXT_CLS}>Brief / script / asset link</span>
                <input type="url" name="presentation_asset_url" defaultValue="" className={FIELD_CLS} />
              </label>
            </OptionalField>
          )}
          {!hasPrep && (
            <OptionalField label="Add prep notes" hasValue={false}>
              <label className={`${LABEL_CLS} w-full`}>
                <span className={LABEL_TEXT_CLS}>Prep notes</span>
                <textarea name="podcast_preparation_notes" rows={3} defaultValue="" className={FIELD_CLS} />
              </label>
            </OptionalField>
          )}
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-neutral-700">
          <input
            type="checkbox"
            name="push_to_group_calendar"
            value="true"
            defaultChecked={event.push_to_group_calendar}
            className="h-4 w-4 rounded accent-emerald-600"
          />
          Push to group calendar
        </label>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            className="rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  )
}

function PodcastRunPanel({ event }: { event: EventRecord }) {
  const runItems = PODCAST_WORKFLOW_SECTIONS[1].items
  const hasRunOfShow = Boolean(event.podcast_run_of_show)

  return (
    <div className="space-y-6">
      {/* Checklist */}
      <div>
        <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Checklist</p>
        <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
          {runItems.map((item) => (
            <ChecklistItem
              key={item.field}
              eventId={event.id}
              field={item.field}
              label={item.label}
              done={Boolean(event[item.field as keyof EventRecord])}
            />
          ))}
        </div>
      </div>

      {/* Quick-access recording link */}
      {event.podcast_recording_link && (
        <a
          href={event.podcast_recording_link}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700 hover:bg-violet-100"
        >
          Recording room ↗
        </a>
      )}

      {/* Save form */}
      <form action={saveEventSection} className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
        <input type="hidden" name="event_id" value={event.id} />
        <input type="hidden" name="section" value="podcast_run" />

        {hasRunOfShow ? (
          <label className={LABEL_CLS}>
            <span className={LABEL_TEXT_CLS}>Run of show</span>
            <textarea
              name="podcast_run_of_show"
              rows={5}
              defaultValue={event.podcast_run_of_show ?? ''}
              className={FIELD_CLS}
            />
          </label>
        ) : (
          <>
            <input type="hidden" name="podcast_run_of_show" value="" />
            <OptionalField label="Add run of show" hasValue={false}>
              <label className={LABEL_CLS}>
                <span className={LABEL_TEXT_CLS}>Run of show</span>
                <textarea name="podcast_run_of_show" rows={5} defaultValue="" className={FIELD_CLS} />
              </label>
            </OptionalField>
          </>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  )
}

function PodcastAfterPanel({ event }: { event: EventRecord }) {
  const followupItems = PODCAST_WORKFLOW_SECTIONS[2].items
  const podcastDistributionSet = new Set(event.podcast_distribution_channels)
  const hasFollowupNotes = Boolean(event.podcast_followup_notes)
  const hasSummary = Boolean(event.presentation_summary)

  const OUTPUT_FIELDS = [
    { field: 'output_report_drafted', label: 'Report drafted' },
    { field: 'output_linkedin_published', label: 'LinkedIn published' },
    { field: 'output_newsletter_mentioned', label: 'Newsletter mentioned' },
    { field: 'output_media_stored', label: 'Media stored' },
  ] as const

  return (
    <div className="space-y-6">
      {/* Checklist */}
      <div>
        <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Checklist</p>
        <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
          {followupItems.map((item) => (
            <ChecklistItem
              key={item.field}
              eventId={event.id}
              field={item.field}
              label={item.label}
              done={Boolean(event[item.field as keyof EventRecord])}
            />
          ))}
        </div>
      </div>

      {/* Save form */}
      <form action={saveEventSection} className="space-y-5 rounded-xl border border-neutral-200 bg-white p-5">
        <input type="hidden" name="event_id" value={event.id} />
        <input type="hidden" name="section" value="podcast_after" />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={`${LABEL_CLS} col-span-full`}>
            <span className={LABEL_TEXT_CLS}>Final episode title</span>
            <input
              name="podcast_episode_title"
              defaultValue={event.podcast_episode_title ?? ''}
              placeholder="Title used for publishing"
              className={FIELD_CLS}
            />
          </label>
        </div>

        <fieldset>
          <legend className={`mb-2 ${LABEL_TEXT_CLS}`}>Distribution channels</legend>
          <div className="flex flex-wrap gap-2">
            {PODCAST_DISTRIBUTION_CHANNEL_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  podcastDistributionSet.has(opt.value)
                    ? 'border-violet-200 bg-violet-100 text-violet-800'
                    : 'border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50'
                }`}
              >
                <input
                  type="checkbox"
                  name="podcast_distribution_channels"
                  value={opt.value}
                  defaultChecked={podcastDistributionSet.has(opt.value)}
                  className="sr-only"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>

        <hr className="border-neutral-100" />

        {/* Outputs */}
        <div>
          <p className={`mb-2 ${LABEL_TEXT_CLS}`}>Outputs</p>
          <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-100">
            {OUTPUT_FIELDS.map((item) => (
              <div key={item.field} className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    name={item.field}
                    value="true"
                    defaultChecked={Boolean(event[item.field as keyof EventRecord])}
                    className="h-4 w-4 rounded accent-emerald-600"
                  />
                  <span className="text-sm text-neutral-700">{item.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <hr className="border-neutral-100" />

        {/* Optional fields */}
        {hasSummary ? (
          <label className={LABEL_CLS}>
            <span className={LABEL_TEXT_CLS}>Episode summary</span>
            <textarea
              name="presentation_summary"
              rows={3}
              defaultValue={event.presentation_summary ?? ''}
              className={FIELD_CLS}
            />
          </label>
        ) : (
          <>
            <input type="hidden" name="presentation_summary" value="" />
            <OptionalField label="Add episode summary" hasValue={false}>
              <label className={LABEL_CLS}>
                <span className={LABEL_TEXT_CLS}>Episode summary</span>
                <textarea name="presentation_summary" rows={3} defaultValue="" className={FIELD_CLS} />
              </label>
            </OptionalField>
          </>
        )}

        {hasFollowupNotes ? (
          <label className={LABEL_CLS}>
            <span className={LABEL_TEXT_CLS}>Follow-up notes</span>
            <textarea
              name="podcast_followup_notes"
              rows={3}
              defaultValue={event.podcast_followup_notes ?? ''}
              className={FIELD_CLS}
            />
          </label>
        ) : (
          <>
            <input type="hidden" name="podcast_followup_notes" value="" />
            <OptionalField label="Add follow-up notes" hasValue={false}>
              <label className={LABEL_CLS}>
                <span className={LABEL_TEXT_CLS}>Follow-up notes</span>
                <textarea name="podcast_followup_notes" rows={3} defaultValue="" className={FIELD_CLS} />
              </label>
            </OptionalField>
          </>
        )}

        <input type="hidden" name="notes" value={event.notes ?? ''} />

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  )
}

function EventPreparePanel({
  event,
  profiles,
  section,
}: {
  event: EventRecord
  profiles: { id: string; name: string | null; email: string }[]
  section: 'event_prepare' | 'event_attend'
}) {
  const isAttendance = section === 'event_attend'
  const representativeSet = new Set(event.i2l_representatives ?? [])
  const hasImage = Boolean(event.event_image_url)
  const hasSummary = Boolean(event.presentation_summary)
  const hasAsset = Boolean(event.presentation_asset_url)

  return (
    <form action={saveEventSection} className="space-y-5 rounded-xl border border-neutral-200 bg-white p-5">
      <input type="hidden" name="event_id" value={event.id} />
      <input type="hidden" name="section" value={section} />

      {/* Core details */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={`${LABEL_CLS} col-span-full`}>
          <span className={LABEL_TEXT_CLS}>Event name</span>
          <input name="name" defaultValue={event.name} required className={FIELD_CLS} />
        </label>
        <label className={LABEL_CLS}>
          <span className={LABEL_TEXT_CLS}>Type</span>
          <select name="event_type" defaultValue={event.event_type} className={FIELD_CLS}>
            {EVENT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className={LABEL_CLS}>
          <span className={LABEL_TEXT_CLS}>{isAttendance ? 'External organiser' : 'Lead organiser / team'}</span>
          <input
            name="organiser"
            defaultValue={event.organiser ?? ''}
            placeholder={isAttendance ? 'Conference host or partner org' : 'Inspire2Live events team'}
            className={FIELD_CLS}
          />
        </label>
        <label className={LABEL_CLS}>
          <span className={LABEL_TEXT_CLS}>Start date</span>
          <input type="date" name="start_date" defaultValue={event.start_date} required className={FIELD_CLS} />
        </label>
        <label className={LABEL_CLS}>
          <span className={LABEL_TEXT_CLS}>End date</span>
          <input type="date" name="end_date" defaultValue={event.end_date ?? ''} className={FIELD_CLS} />
        </label>
        <label className={LABEL_CLS}>
          <span className={LABEL_TEXT_CLS}>City</span>
          <input name="location_city" defaultValue={event.location_city ?? ''} className={FIELD_CLS} />
        </label>
        <label className={LABEL_CLS}>
          <span className={LABEL_TEXT_CLS}>Country</span>
          <input name="location_country" defaultValue={event.location_country ?? ''} className={FIELD_CLS} />
        </label>
        <label className={`${LABEL_CLS} col-span-full`}>
          <span className={LABEL_TEXT_CLS}>Event website</span>
          <input
            type="url"
            name="event_website_url"
            defaultValue={event.event_website_url ?? ''}
            placeholder="https://example.org/event"
            className={FIELD_CLS}
          />
        </label>
      </div>

      <hr className="border-neutral-100" />

      {/* Involvement */}
      {isAttendance ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className={LABEL_TEXT_CLS}>How I2L participates</span>
            <select name="attendance_kind" defaultValue={event.attendance_kind ?? 'visitor'} className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-semibold text-neutral-700">
              {ATTENDANCE_KIND_OPTIONS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {profiles.map((p) => {
              const checked = representativeSet.has(p.id)
              return (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                    checked
                      ? 'border-blue-200 bg-blue-50 font-semibold text-blue-800'
                      : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  <input type="checkbox" name="i2l_representatives" value={p.id} defaultChecked={checked} className="sr-only" />
                  <span className="truncate">{p.name ?? p.email}</span>
                </label>
              )
            })}
          </div>
          {/* Hidden fields not needed for attendance */}
          <input type="hidden" name="is_i2l_organised" value="false" />
          <input type="hidden" name="is_annual_congress" value="false" />
        </div>
      ) : (
        <div className="space-y-3">
          <label className={LABEL_CLS}>
            <span className={LABEL_TEXT_CLS}>Responsible owner</span>
            <select name="owner_id" defaultValue={event.owner_id ?? ''} className={FIELD_CLS}>
              <option value="">Unassigned</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name ?? p.email}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
              <input
                type="checkbox"
                name="is_i2l_organised"
                value="true"
                defaultChecked={event.is_i2l_organised}
                className="h-4 w-4 rounded accent-orange-600"
              />
              I2L-organised
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100">
              <input
                type="checkbox"
                name="push_to_group_calendar"
                value="true"
                defaultChecked={event.push_to_group_calendar}
                className="h-4 w-4 rounded accent-emerald-600"
              />
              Group calendar
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-800 hover:bg-violet-100">
              <input
                type="checkbox"
                name="is_annual_congress"
                value="true"
                defaultChecked={event.is_annual_congress}
                className="h-4 w-4 rounded accent-violet-600"
              />
              Annual Congress
            </label>
          </div>
          {/* Hidden fields for attendance mode (not applicable) */}
          <input type="hidden" name="attendance_kind" value="organiser" />
        </div>
      )}

      <hr className="border-neutral-100" />

      {/* Optional fields */}
      <div className="flex flex-col gap-4">
        {hasImage ? (
          <label className={LABEL_CLS}>
            <span className={LABEL_TEXT_CLS}>Event image</span>
            <input type="url" name="event_image_url" defaultValue={event.event_image_url ?? ''} className={FIELD_CLS} />
          </label>
        ) : (
          <>
            <input type="hidden" name="event_image_url" value="" />
            <OptionalField label="Add event image" hasValue={false}>
              <label className={LABEL_CLS}>
                <span className={LABEL_TEXT_CLS}>Event image</span>
                <input type="url" name="event_image_url" defaultValue="" className={FIELD_CLS} />
              </label>
            </OptionalField>
          </>
        )}

        {hasSummary ? (
          <label className={LABEL_CLS}>
            <span className={LABEL_TEXT_CLS}>{isAttendance ? 'Presentation summary' : 'Event brief / summary'}</span>
            <textarea name="presentation_summary" rows={3} defaultValue={event.presentation_summary ?? ''} className={FIELD_CLS} />
          </label>
        ) : (
          <>
            <input type="hidden" name="presentation_summary" value="" />
            <OptionalField label={isAttendance ? 'Add presentation summary' : 'Add event brief'} hasValue={false}>
              <label className={LABEL_CLS}>
                <span className={LABEL_TEXT_CLS}>{isAttendance ? 'Presentation summary' : 'Event brief / summary'}</span>
                <textarea name="presentation_summary" rows={3} defaultValue="" className={FIELD_CLS} />
              </label>
            </OptionalField>
          </>
        )}

        {hasAsset ? (
          <label className={LABEL_CLS}>
            <span className={LABEL_TEXT_CLS}>{isAttendance ? 'Slide deck / presentation' : 'Runbook / deck'}</span>
            <input type="url" name="presentation_asset_url" defaultValue={event.presentation_asset_url ?? ''} className={FIELD_CLS} />
          </label>
        ) : (
          <>
            <input type="hidden" name="presentation_asset_url" value="" />
            <OptionalField label={isAttendance ? 'Add slide deck link' : 'Add runbook / deck link'} hasValue={false}>
              <label className={LABEL_CLS}>
                <span className={LABEL_TEXT_CLS}>{isAttendance ? 'Slide deck / presentation' : 'Runbook / deck'}</span>
                <input type="url" name="presentation_asset_url" defaultValue="" className={FIELD_CLS} />
              </label>
            </OptionalField>
          </>
        )}
      </div>

      <div className="flex justify-end pt-1">
        <button type="submit" className="rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700">
          Save
        </button>
      </div>
    </form>
  )
}

function EventAfterPanel({ event }: { event: EventRecord }) {
  const hasNotes = Boolean(event.notes)

  const OUTPUT_FIELDS = [
    { field: 'output_report_drafted' as const, label: 'Report drafted' },
    { field: 'output_linkedin_published' as const, label: 'LinkedIn published' },
    { field: 'output_newsletter_mentioned' as const, label: 'Newsletter mentioned' },
    { field: 'output_media_stored' as const, label: 'Media stored' },
  ]

  return (
    <form action={saveEventSection} className="space-y-5 rounded-xl border border-neutral-200 bg-white p-5">
      <input type="hidden" name="event_id" value={event.id} />
      <input type="hidden" name="section" value="event_after" />

      <div>
        <p className={`mb-3 ${LABEL_TEXT_CLS}`}>Outputs</p>
        <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-100">
          {OUTPUT_FIELDS.map((item) => (
            <div key={item.field} className="flex items-center gap-3 px-3 py-2.5">
              <input
                type="checkbox"
                id={`output-${item.field}`}
                name={item.field}
                value="true"
                defaultChecked={Boolean(event[item.field])}
                className="h-4 w-4 rounded accent-emerald-600"
              />
              <label htmlFor={`output-${item.field}`} className="cursor-pointer text-sm text-neutral-700">
                {item.label}
              </label>
            </div>
          ))}
        </div>
      </div>

      <hr className="border-neutral-100" />

      {hasNotes ? (
        <label className={LABEL_CLS}>
          <span className={LABEL_TEXT_CLS}>Notes</span>
          <textarea name="notes" rows={4} defaultValue={event.notes ?? ''} className={FIELD_CLS} />
        </label>
      ) : (
        <>
          <input type="hidden" name="notes" value="" />
          <OptionalField label="Add notes" hasValue={false}>
            <label className={LABEL_CLS}>
              <span className={LABEL_TEXT_CLS}>Notes</span>
              <textarea name="notes" rows={4} defaultValue="" className={FIELD_CLS} />
            </label>
          </OptionalField>
        </>
      )}

      <div className="flex justify-end">
        <button type="submit" className="rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700">
          Save
        </button>
      </div>
    </form>
  )
}

// ─── Phase stepper ────────────────────────────────────────────────────────────

function PhaseStepper({
  phases,
  activePhase,
  eventId,
  podcastProgress,
}: {
  phases: { key: string; label: string; done?: number; total?: number }[]
  activePhase: string
  eventId: string
  podcastProgress?: { bySection: { done: number; total: number }[] }
}) {
  return (
    <nav className="flex items-center gap-1 rounded-xl border border-neutral-200 bg-white p-1">
      {phases.map((phase, i) => {
        const isActive = phase.key === activePhase
        const sectionProgress = podcastProgress?.bySection[i]
        const allDone = sectionProgress ? sectionProgress.done === sectionProgress.total : false
        return (
          <Link
            key={phase.key}
            href={`/app/comms/events/${eventId}?phase=${phase.key}`}
            className={`relative flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              isActive
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'
            }`}
          >
            {allDone && !isActive && (
              <span className="text-emerald-500">✓</span>
            )}
            {phase.label}
            {sectionProgress && !allDone && (
              <span
                className={`rounded-full px-1.5 text-[11px] font-bold tabular-nums ${
                  isActive ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-400'
                }`}
              >
                {sectionProgress.done}/{sectionProgress.total}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CommsEventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const sp = await searchParams
  const supabase = await createClient()

  const { data: rawEvent, error: eventError } = await supabase
    .from('events')
    .select(EVENT_SELECT)
    .eq('id', id)
    .maybeSingle()

  let event = rawEvent ? withDefaults(rawEvent) : null
  if (eventError || !event) {
    const { data: fallback } = await supabase
      .from('events')
      .select(EVENT_FALLBACK_SELECT)
      .eq('id', id)
      .maybeSingle()
    event = fallback
      ? withDefaults({
          ...fallback,
          owner_id: null,
          is_i2l_organised: false,
          attendance_kind: 'visitor',
          presentation_summary: null,
          presentation_asset_url: null,
          event_image_url: null,
          event_website_url: null,
          push_to_group_calendar: false,
        })
      : null
  }

  if (!event) notFound()

  const [{ data: profiles }, { data: initiatives }, { data: linkedCalendar }] = await Promise.all([
    supabase.from('profiles').select('id, name, email').order('name'),
    supabase.from('initiatives').select('id, title').order('title'),
    supabase
      .from('content_calendar')
      .select('id, title, status, scheduled_at')
      .eq('source_event_id', id)
      .order('scheduled_at', { ascending: false }),
  ])

  const isPodcast = isPodcastEventType(event.event_type)
  const setupMode = getEventSetupMode({
    eventType: event.event_type,
    isI2lOrganised: event.is_i2l_organised,
    isAnnualCongress: event.is_annual_congress,
  })
  const effectiveOwned = isI2LOwnedEvent({
    eventType: event.event_type,
    isI2lOrganised: event.is_i2l_organised,
    isAnnualCongress: event.is_annual_congress,
  })
  const podcastProgress = getPodcastWorkflowProgress(event)
  const stageMeta = EVENT_STAGE_META[event.stage as EventStage]
  const stubFlags = getIntegrationStubFlags()

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p.name ?? p.email ?? 'Unknown'])
  )
  const linkedInitiativeSet = new Set(event.initiative_ids ?? [])
  const linkedInitiatives = (initiatives ?? []).filter((i) => linkedInitiativeSet.has(i.id))
  const ownerName = event.owner_id ? profileMap.get(event.owner_id) ?? null : null
  const attendeeNames = (event.i2l_representatives ?? [])
    .map((rid) => profileMap.get(rid))
    .filter(Boolean) as string[]

  // Phase definitions per mode
  type PhaseConfig = { key: string; label: string }
  const phaseConfigs: PhaseConfig[] = isPodcast
    ? [
        { key: 'setup', label: 'Setup' },
        { key: 'run', label: 'Run' },
        { key: 'after', label: 'Follow-up' },
      ]
    : setupMode === 'i2l_owned'
    ? [
        { key: 'prepare', label: 'Preparing' },
        { key: 'after', label: 'After' },
      ]
    : [
        { key: 'attend', label: 'Attending' },
        { key: 'after', label: 'After' },
      ]

  const defaultPhase = phaseConfigs[0].key
  const activePhase = (typeof sp.phase === 'string' ? sp.phase : null) ?? defaultPhase

  const podcastSectionProgress = isPodcast
    ? {
        bySection: PODCAST_WORKFLOW_SECTIONS.map((section) => ({
          done: section.items.filter((item) => Boolean(event![item.field as keyof typeof event])).length,
          total: section.items.length,
        })),
      }
    : undefined

  const dateRange = formatDateRange(event.start_date, event.end_date)
  const location = [event.location_city, event.location_country].filter(Boolean).join(', ')

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-16">
      {/* Back nav */}
      <Link
        href="/app/comms/events"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-700 hover:text-orange-800"
      >
        ← Events
      </Link>

      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {stageMeta && <StatusBadge label={stageMeta.label} tone={stageMeta.tone} />}
            <StatusBadge label={getEventTypeLabel(event.event_type)} tone="blue" />
            {effectiveOwned && !isPodcast && <StatusBadge label="I2L own" tone="green" />}
            {event.is_annual_congress && <StatusBadge label="Annual Congress" tone="violet" />}
          </div>
          <h1 className="text-2xl font-semibold text-neutral-900">{event.name}</h1>
          <p className="text-sm text-neutral-500">
            {dateRange}
            {location && <> · {location}</>}
          </p>
          {effectiveOwned && ownerName && (
            <p className="text-sm font-medium text-emerald-700">Owner: {ownerName}</p>
          )}
          {!effectiveOwned && attendeeNames.length > 0 && (
            <p className="text-sm font-medium text-blue-700">
              {formatTokenLabel(event.attendance_kind ?? 'visitor')}: {attendeeNames.join(', ')}
            </p>
          )}
          {isPodcast && (
            <div className="flex items-center gap-2 pt-0.5">
              <div className="flex gap-0.5">
                {Array.from({ length: podcastProgress.total }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full ${
                      i < podcastProgress.completed ? 'bg-emerald-500' : 'bg-neutral-200'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs text-neutral-400">
                {podcastProgress.completed}/{podcastProgress.total} steps
              </span>
            </div>
          )}
        </div>

        {/* Stage transition */}
        {!event.is_annual_congress && (
          <form action={transitionEventStage} className="flex items-center gap-2">
            <input type="hidden" name="event_id" value={event.id} />
            <label className="sr-only" htmlFor="next_stage">Move to stage</label>
            <select
              id="next_stage"
              name="next_stage"
              defaultValue={event.stage}
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-700"
            >
              {(Object.keys(EVENT_STAGE_META) as EventStage[]).map((stage) => (
                <option key={stage} value={stage}>
                  {EVENT_STAGE_META[stage].label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Move
            </button>
          </form>
        )}
      </div>

      {event.is_annual_congress && (
        <div className="flex items-center justify-between rounded-xl border border-violet-200 bg-violet-50 px-5 py-4">
          <p className="text-sm text-violet-900">Linked to the Annual Congress workspace.</p>
          <Link
            href="/app/congress"
            className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800"
          >
            Open Congress
          </Link>
        </div>
      )}

      {/* Phase stepper */}
      <PhaseStepper
        phases={phaseConfigs}
        activePhase={activePhase}
        eventId={event.id}
        podcastProgress={podcastSectionProgress}
      />

      {/* Main two-column layout */}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">

        {/* ── Left: active phase content ─────────────────────── */}
        <div>
          {isPodcast && activePhase === 'setup' && (
            <PodcastSetupPanel event={event} profiles={profiles ?? []} />
          )}
          {isPodcast && activePhase === 'run' && (
            <PodcastRunPanel event={event} />
          )}
          {isPodcast && activePhase === 'after' && (
            <PodcastAfterPanel event={event} />
          )}
          {!isPodcast && (activePhase === 'prepare' || activePhase === 'attend') && (
            <EventPreparePanel
              event={event}
              profiles={profiles ?? []}
              section={setupMode === 'attendance' ? 'event_attend' : 'event_prepare'}
            />
          )}
          {!isPodcast && activePhase === 'after' && (
            <EventAfterPanel event={event} />
          )}
        </div>

        {/* ── Right: sidebar ─────────────────────────────────── */}
        <div className="space-y-4">

          {/* Quick links */}
          {(event.event_website_url || event.presentation_asset_url || event.podcast_recording_link) && (
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Links</h3>
              <div className="space-y-1.5">
                {event.event_website_url && (
                  <a
                    href={event.event_website_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                  >
                    {isPodcast ? 'Episode page' : 'Event website'}
                    <span className="text-neutral-400">↗</span>
                  </a>
                )}
                {event.podcast_recording_link && (
                  <a
                    href={event.podcast_recording_link}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100"
                  >
                    Recording room
                    <span>↗</span>
                  </a>
                )}
                {event.presentation_asset_url && (
                  <a
                    href={event.presentation_asset_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                  >
                    {isPodcast ? 'Brief / script' : 'Runbook / deck'}
                    <span className="text-neutral-400">↗</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Initiatives */}
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Initiatives</h3>
            {linkedInitiatives.length > 0 ? (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {linkedInitiatives.map((initiative) => (
                  <span
                    key={initiative.id}
                    className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700"
                  >
                    {initiative.title}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mb-3 text-xs text-neutral-400">None linked yet.</p>
            )}
            <form action={linkEventInitiative} className="flex gap-2">
              <input type="hidden" name="event_id" value={event.id} />
              <select
                name="initiative_id"
                className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs"
              >
                {(initiatives ?? [])
                  .filter((i) => !linkedInitiativeSet.has(i.id))
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.title}
                    </option>
                  ))}
              </select>
              <button
                type="submit"
                className="shrink-0 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Link
              </button>
            </form>
          </div>

          {/* Teams stub */}
          {stubFlags.teams && (
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Integrations</h3>
              <IntegrationStubForm
                action={triggerEventTeamsStub}
                entityId={event.id}
                buttonLabel="Create Teams meeting"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              />
            </div>
          )}

          {/* Calendar entries */}
          {(linkedCalendar ?? []).length > 0 && (
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Calendar entries</h3>
              <div className="space-y-1.5">
                {linkedCalendar?.map((entry) => (
                  <Link
                    key={entry.id}
                    href="/app/comms/calendar"
                    className="block rounded-lg border border-neutral-200 px-3 py-2 hover:bg-neutral-50"
                  >
                    <p className="text-sm font-semibold text-neutral-900">{entry.title}</p>
                    <p className="text-xs text-neutral-500">
                      {entry.status} ·{' '}
                      {entry.scheduled_at
                        ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(
                            new Date(entry.scheduled_at)
                          )
                        : 'Unscheduled'}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
