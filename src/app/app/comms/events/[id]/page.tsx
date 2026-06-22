import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  linkEventInitiative,
  saveEventDetails,
  togglePodcastWorkflowItem,
  toggleEventOutputItem,
  transitionEventStage,
} from '@/app/app/comms/events/actions'
import { triggerEventTeamsStub } from '@/app/app/comms/integration-actions'
import { IntegrationStubForm } from '@/components/comms/integration-stub-form'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  ATTENDANCE_KIND_OPTIONS,
  EVENT_TYPE_OPTIONS,
  PODCAST_DISTRIBUTION_CHANNEL_OPTIONS,
  PODCAST_RECORDING_MODE_OPTIONS,
  PODCAST_WORKFLOW_SECTIONS,
  formatDelimitedList,
  formatTokenLabel,
  getEventTypeLabel,
  getEventSetupContent,
  getPodcastWorkflowProgress,
  isI2LOwnedEvent,
  isPodcastEventType,
} from '@/lib/comms-events'
import { getIntegrationStubFlags } from '@/lib/comms-integrations'
import { EVENT_STAGE_META, type EventStage } from '@/lib/comms-workflow'
import { createClient } from '@/lib/supabase/server'

const EVENT_DETAIL_SELECT =
  'id, name, event_type, start_date, end_date, location_city, location_country, organiser, owner_id, stage, is_annual_congress, is_i2l_organised, attendance_kind, presentation_summary, presentation_asset_url, event_image_url, event_website_url, push_to_group_calendar, initiative_ids, i2l_representatives, output_report_drafted, output_linkedin_published, output_newsletter_mentioned, output_media_stored, notes, podcast_series_name, podcast_episode_title, podcast_hosts, podcast_guests, podcast_recording_mode, podcast_distribution_channels, podcast_recording_link, podcast_preparation_notes, podcast_run_of_show, podcast_followup_notes, podcast_guest_confirmed, podcast_brief_ready, podcast_release_form_ready, podcast_equipment_ready, podcast_recording_completed, podcast_backup_completed, podcast_edit_completed, podcast_transcript_completed, podcast_show_notes_completed, podcast_published, podcast_followup_completed'
const EVENT_DETAIL_FALLBACK_SELECT =
  'id, name, event_type, start_date, end_date, location_city, location_country, organiser, stage, is_annual_congress, initiative_ids, i2l_representatives, output_report_drafted, output_linkedin_published, output_newsletter_mentioned, output_media_stored, notes'

function formatDateRange(startDate: string, endDate: string | null) {
  const fmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' })
  if (!endDate || endDate === startDate) return fmt.format(new Date(startDate))
  const start = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(startDate))
  return `${start} – ${fmt.format(new Date(endDate))}`
}

const OUTPUT_FIELDS = [
  { field: 'output_report_drafted', label: 'Report' },
  { field: 'output_linkedin_published', label: 'LinkedIn' },
  { field: 'output_newsletter_mentioned', label: 'Newsletter' },
  { field: 'output_media_stored', label: 'Media' },
] as const

function withPodcastDefaults<T extends Record<string, unknown>>(event: T) {
  return {
    ...event,
    podcast_series_name: (event.podcast_series_name as string | null | undefined) ?? null,
    podcast_episode_title: (event.podcast_episode_title as string | null | undefined) ?? null,
    podcast_hosts: (event.podcast_hosts as string[] | null | undefined) ?? [],
    podcast_guests: (event.podcast_guests as string[] | null | undefined) ?? [],
    podcast_recording_mode: (event.podcast_recording_mode as string | null | undefined) ?? 'remote',
    podcast_distribution_channels: (event.podcast_distribution_channels as string[] | null | undefined) ?? [],
    podcast_recording_link: (event.podcast_recording_link as string | null | undefined) ?? null,
    podcast_preparation_notes: (event.podcast_preparation_notes as string | null | undefined) ?? null,
    podcast_run_of_show: (event.podcast_run_of_show as string | null | undefined) ?? null,
    podcast_followup_notes: (event.podcast_followup_notes as string | null | undefined) ?? null,
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

export default async function CommsEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: eventWithOwnership, error: eventWithOwnershipError } = await supabase
    .from('events')
    .select(EVENT_DETAIL_SELECT)
    .eq('id', id)
    .maybeSingle()
  let event = eventWithOwnership ? withPodcastDefaults(eventWithOwnership) : null
  if (eventWithOwnershipError) {
    const { data: fallbackEvent } = await supabase
      .from('events')
      .select(EVENT_DETAIL_FALLBACK_SELECT)
      .eq('id', id)
      .maybeSingle()
    event = fallbackEvent
      ? withPodcastDefaults({
          ...fallbackEvent,
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

  const representativeSet = new Set(event.i2l_representatives ?? [])
  const linkedInitiativeSet = new Set(event.initiative_ids ?? [])
  const podcastDistributionSet = new Set(event.podcast_distribution_channels ?? [])
  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p.name ?? p.email ?? 'Unknown'])
  )
  const linkedInitiatives = (initiatives ?? []).filter((i) => linkedInitiativeSet.has(i.id))
  const effectiveOwned = isI2LOwnedEvent({
    eventType: event.event_type,
    isI2lOrganised: event.is_i2l_organised,
    isAnnualCongress: event.is_annual_congress,
  })
  const setup = getEventSetupContent({
    eventType: event.event_type,
    isI2lOrganised: effectiveOwned,
    isAnnualCongress: event.is_annual_congress,
  })
  const isPodcast = isPodcastEventType(event.event_type)
  const podcastProgress = getPodcastWorkflowProgress(event)
  const stageMeta = EVENT_STAGE_META[event.stage as EventStage]
  const stubFlags = getIntegrationStubFlags()
  const ownerName = event.owner_id ? profileMap.get(event.owner_id) ?? null : null
  const attendeeNames = (event.i2l_representatives ?? [])
    .map((rid) => profileMap.get(rid))
    .filter(Boolean) as string[]

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Nav */}
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
            {effectiveOwned && <StatusBadge label="I2L own" tone="green" />}
            {event.is_annual_congress && <StatusBadge label="Annual Congress" tone="violet" />}
          </div>
          <h1 className="text-2xl font-semibold text-neutral-900">{event.name}</h1>
          <p className="text-sm text-neutral-500">
            {formatDateRange(event.start_date, event.end_date)}
            {[event.location_city, event.location_country].filter(Boolean).length > 0 && (
              <> · {[event.location_city, event.location_country].filter(Boolean).join(', ')}</>
            )}
          </p>
          {/* Quick context: who is involved */}
          {effectiveOwned && ownerName && (
            <p className="text-sm font-medium text-emerald-700">Owner: {ownerName}</p>
          )}
          {!effectiveOwned && attendeeNames.length > 0 && (
            <p className="text-sm font-medium text-blue-700">
              {formatTokenLabel(event.attendance_kind)}: {attendeeNames.join(', ')}
            </p>
          )}
        </div>

        {/* Stage transition — single dropdown */}
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
          <p className="text-sm text-violet-900">
            This event is linked to the Annual Congress workspace.
          </p>
          <Link
            href="/app/congress"
            className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800"
          >
            Open Congress
          </Link>
        </div>
      )}

      {/* Main two-column layout */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">

        {/* ── Left: event form ────────────────────────────────── */}
        <form action={saveEventDetails} className="space-y-6 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <input type="hidden" name="event_id" value={event.id} />

          {/* Section: Core */}
          <div className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">About</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="col-span-full space-y-1.5">
                <span className="text-sm font-semibold text-neutral-700">Event name</span>
                <input
                  name="name"
                  defaultValue={event.name}
                  required
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-neutral-700">Type</span>
                <select
                  name="event_type"
                  defaultValue={event.event_type}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                >
                  {EVENT_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-neutral-700">{setup.organiserLabel}</span>
                <input
                  name="organiser"
                  defaultValue={event.organiser ?? ''}
                  placeholder={setup.organiserPlaceholder}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-neutral-700">Start date</span>
                <input
                  type="date"
                  name="start_date"
                  defaultValue={event.start_date}
                  required
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-neutral-700">End date</span>
                <input
                  type="date"
                  name="end_date"
                  defaultValue={event.end_date ?? ''}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-neutral-700">City</span>
                <input
                  name="location_city"
                  defaultValue={event.location_city ?? ''}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-neutral-700">Country</span>
                <input
                  name="location_country"
                  defaultValue={event.location_country ?? ''}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>

              <label className="col-span-full space-y-1.5">
                <span className="text-sm font-semibold text-neutral-700">{setup.websiteLabel}</span>
                <input
                  type="url"
                  name="event_website_url"
                  defaultValue={event.event_website_url ?? ''}
                  placeholder={setup.websitePlaceholder}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>
            </div>
          </div>

          <hr className="border-neutral-100" />

          {/* Section: I2L involvement */}
          <div className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">I2L involvement</h2>

            {/* Settings toggles */}
            <div className="flex flex-wrap gap-3">
              {!isPodcast ? (
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
              ) : (
                <input type="hidden" name="is_i2l_organised" value="true" />
              )}

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
            </div>

            {/* Owner (I2L-owned events) */}
            {setup.ownerLabel && (
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-neutral-700">{setup.ownerLabel}</span>
                <select
                  name="owner_id"
                  defaultValue={event.owner_id ?? ''}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                >
                  <option value="">No owner assigned</option>
                  {(profiles ?? []).map((p) => (
                    <option key={p.id} value={p.id}>{p.name ?? p.email}</option>
                  ))}
                </select>
              </label>
            )}

            {/* Who from I2L attends — attendance mode */}
            {setup.attendeeLegend && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-neutral-700">Who from I2L is attending</span>
                  <label className="space-y-1">
                    <span className="sr-only">{setup.attendanceKindLabel}</span>
                    <select
                      name="attendance_kind"
                      defaultValue={event.attendance_kind ?? 'visitor'}
                      className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-semibold text-neutral-700"
                    >
                      {ATTENDANCE_KIND_OPTIONS.map((k) => (
                        <option key={k.value} value={k.value}>{k.label}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {(profiles ?? []).map((p) => {
                    const checked = representativeSet.has(p.id)
                    return (
                      <label
                        key={p.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                          checked
                            ? 'border-blue-200 bg-blue-50 font-semibold text-blue-800'
                            : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          name="i2l_representatives"
                          value={p.id}
                          defaultChecked={checked}
                          className="sr-only"
                        />
                        <span className="truncate">{p.name ?? p.email}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Hidden defaults when not in attendance mode */}
            {!setup.attendeeLegend && (
              <input type="hidden" name="attendance_kind" value={event.attendance_kind ?? 'organiser'} />
            )}
          </div>

          {/* Summary / content section */}
          {(setup.summaryLabel || event.presentation_asset_url !== undefined) && (
            <>
              <hr className="border-neutral-100" />
              <div className="space-y-4">
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Content</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-sm font-semibold text-neutral-700">{setup.imageLabel}</span>
                    <input
                      type="url"
                      name="event_image_url"
                      defaultValue={event.event_image_url ?? ''}
                      placeholder={setup.imagePlaceholder}
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-semibold text-neutral-700">{setup.assetLabel}</span>
                    <input
                      type="url"
                      name="presentation_asset_url"
                      defaultValue={event.presentation_asset_url ?? ''}
                      placeholder={setup.assetPlaceholder}
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                    />
                  </label>
                </div>
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold text-neutral-700">{setup.summaryLabel}</span>
                  <textarea
                    name="presentation_summary"
                    rows={4}
                    defaultValue={event.presentation_summary ?? ''}
                    placeholder={setup.summaryPlaceholder}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>
            </>
          )}

          {/* Podcast production fields */}
          {isPodcast && (
            <>
              <hr className="border-neutral-100" />
              <div className="space-y-4">
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-500">Podcast production</h2>

                {/* Pass podcast workflow values through the save form unchanged */}
                {PODCAST_WORKFLOW_SECTIONS.flatMap((section) =>
                  section.items.map((item) => (
                    <input key={item.field} type="hidden" name={item.field} value={event[item.field] ? 'true' : 'false'} />
                  ))
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-sm font-semibold text-neutral-700">Series name</span>
                    <input
                      name="podcast_series_name"
                      defaultValue={event.podcast_series_name ?? ''}
                      placeholder="e.g. Inspire2Live Conversations"
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-semibold text-neutral-700">Episode title</span>
                    <input
                      name="podcast_episode_title"
                      defaultValue={event.podcast_episode_title ?? ''}
                      placeholder="Title used for publishing"
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-semibold text-neutral-700">Hosts</span>
                    <textarea
                      name="podcast_hosts"
                      rows={2}
                      defaultValue={formatDelimitedList(event.podcast_hosts)}
                      placeholder="One per line or comma-separated"
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-semibold text-neutral-700">Guests</span>
                    <textarea
                      name="podcast_guests"
                      rows={2}
                      defaultValue={formatDelimitedList(event.podcast_guests)}
                      placeholder="One per line or comma-separated"
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-semibold text-neutral-700">Recording mode</span>
                    <select
                      name="podcast_recording_mode"
                      defaultValue={event.podcast_recording_mode}
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                    >
                      {PODCAST_RECORDING_MODE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-semibold text-neutral-700">Recording link</span>
                    <input
                      type="url"
                      name="podcast_recording_link"
                      defaultValue={event.podcast_recording_link ?? ''}
                      placeholder="Riverside, Zoom, Teams, or studio link"
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                    />
                  </label>
                </div>

                <fieldset className="space-y-2">
                  <legend className="text-sm font-semibold text-neutral-700">Distribution channels</legend>
                  <div className="flex flex-wrap gap-2">
                    {PODCAST_DISTRIBUTION_CHANNEL_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                          podcastDistributionSet.has(opt.value)
                            ? 'border-violet-200 bg-violet-100 text-violet-800'
                            : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
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

                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold text-neutral-700">Preparation notes</span>
                  <textarea
                    name="podcast_preparation_notes"
                    rows={3}
                    defaultValue={event.podcast_preparation_notes ?? ''}
                    placeholder="Prep call notes, guest logistics, briefing links, and recording dependencies."
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold text-neutral-700">Run of show</span>
                  <textarea
                    name="podcast_run_of_show"
                    rows={3}
                    defaultValue={event.podcast_run_of_show ?? ''}
                    placeholder="Opening, host handoff, core questions, CTA, and closing structure."
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold text-neutral-700">Follow-up notes</span>
                  <textarea
                    name="podcast_followup_notes"
                    rows={3}
                    defaultValue={event.podcast_followup_notes ?? ''}
                    placeholder="Clip requests, publication notes, guest thank-you, and downstream promotion."
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>
            </>
          )}

          <hr className="border-neutral-100" />

          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-neutral-700">Notes</span>
            <textarea
              name="notes"
              rows={4}
              defaultValue={event.notes ?? ''}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            />
          </label>

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700"
            >
              Save
            </button>
          </div>
        </form>

        {/* ── Right: action sidebar ────────────────────────────── */}
        <div className="space-y-4">

          {/* Output checklist */}
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-neutral-900">Outputs</h3>
            <div className="space-y-1">
              {OUTPUT_FIELDS.map((item) => {
                const done = Boolean(event[item.field])
                return (
                  <form key={item.field} action={toggleEventOutputItem} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-neutral-50">
                    <div className="flex items-center gap-2.5">
                      <span className={`h-2 w-2 rounded-full ${done ? 'bg-emerald-500' : 'bg-neutral-200'}`} />
                      <span className={`text-sm ${done ? 'font-semibold text-emerald-700' : 'text-neutral-600'}`}>
                        {item.label}
                      </span>
                    </div>
                    <input type="hidden" name="event_id" value={event.id} />
                    <input type="hidden" name="field" value={item.field} />
                    <input type="hidden" name="next_value" value={done ? 'false' : 'true'} />
                    <button
                      type="submit"
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition ${
                        done
                          ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          : 'border-neutral-200 text-neutral-500 hover:bg-neutral-100'
                      }`}
                    >
                      {done ? 'Done' : 'Pending'}
                    </button>
                  </form>
                )
              })}
            </div>
          </div>

          {/* Podcast workflow */}
          {isPodcast && (
            <div className="rounded-xl border border-violet-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-neutral-900">Podcast workflow</h3>
                <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                  {podcastProgress.completed}/{podcastProgress.total}
                </span>
              </div>
              <div className="space-y-3">
                {PODCAST_WORKFLOW_SECTIONS.map((section) => (
                  <div key={section.key}>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
                      {section.title}
                    </p>
                    <div className="space-y-1">
                      {section.items.map((item) => {
                        const done = Boolean(event[item.field])
                        return (
                          <form key={item.field} action={togglePodcastWorkflowItem} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-violet-50/40">
                            <div className="flex items-center gap-2.5">
                              <span className={`h-2 w-2 rounded-full ${done ? 'bg-emerald-500' : 'bg-neutral-200'}`} />
                              <span className={`text-xs ${done ? 'font-semibold text-emerald-700' : 'text-neutral-600'}`}>
                                {item.label}
                              </span>
                            </div>
                            <input type="hidden" name="event_id" value={event.id} />
                            <input type="hidden" name="field" value={item.field} />
                            <input type="hidden" name="next_value" value={done ? 'false' : 'true'} />
                            <button
                              type="submit"
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition ${
                                done
                                  ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                                  : 'border-neutral-200 text-neutral-400 hover:bg-neutral-100'
                              }`}
                            >
                              {done ? '✓' : 'Mark'}
                            </button>
                          </form>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Links */}
          {(event.event_website_url || event.presentation_asset_url || (isPodcast && event.podcast_recording_link)) && (
            <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-neutral-900">Links</h3>
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
                {isPodcast && event.podcast_recording_link && (
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
                    {setup.assetLabel}
                    <span className="text-neutral-400">↗</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Initiatives */}
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-neutral-900">Initiatives</h3>
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
              <p className="mb-3 text-xs text-neutral-400">No initiatives linked yet.</p>
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
                    <option key={i.id} value={i.id}>{i.title}</option>
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
            <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-neutral-900">Integrations</h3>
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
            <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-neutral-900">Calendar entries</h3>
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
