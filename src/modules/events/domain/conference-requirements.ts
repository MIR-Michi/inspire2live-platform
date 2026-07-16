/**
 * conference-requirements.ts
 *
 * The declarative "what do we need, and is it due yet" model that drives the
 * conference operating page (Sprint 18). It replaces the old static
 * per-stage `STAGE_CHECKLISTS` with requirements that know:
 *
 *   - who they apply to      → `appliesWhen(ctx)`      (e.g. presenter only)
 *   - when they become due   → `dueFrom` (a phase)     (e.g. photos during)
 *   - whether they're done   → `isProvided(inputs)`
 *
 * From those three it derives one of four statuses — provided (green) / due
 * (red) / upcoming (neutral) / na (hidden) — so material is never shown red
 * before its time (e.g. photos before the conference has happened).
 *
 * This module is intentionally pure and free of any server/React imports so it
 * can be shared by the internal operating page, the guest surface, and the unit
 * tests alike.
 */

import type { ConferenceStage } from '@/lib/comms-conferences'
import type { StatusTone } from '@/components/ui/status-badge'

// ── Phase ─────────────────────────────────────────────────────────────────────

/** Where a conference sits in time, relative to today. */
export type ConferencePhase = 'before' | 'during' | 'after'

const PHASE_RANK: Record<ConferencePhase, number> = { before: 0, during: 1, after: 2 }

/** Map a pipeline stage to the phase it implies (fallback when dates are absent). */
function phaseFromStage(stage: ConferenceStage | null): ConferencePhase {
  switch (stage) {
    case 'ongoing':
      return 'during'
    case 'follow_up':
    case 'archived':
      return 'after'
    default:
      return 'before'
  }
}

function dayValue(value: string | null): number | null {
  if (!value) return null
  const ms = Date.parse(value.length <= 10 ? `${value}T00:00:00Z` : value)
  return Number.isNaN(ms) ? null : ms
}

/**
 * Derive the conference phase from its dates and today, reconciled with the
 * pipeline stage. Dates win when present (the honest "are we there yet"
 * signal); the stage is the fallback for conferences without dates.
 */
export function deriveConferencePhase(
  startDate: string | null,
  endDate: string | null,
  stage: ConferenceStage | null,
  today: Date = new Date()
): ConferencePhase {
  const start = dayValue(startDate)
  if (start === null) return phaseFromStage(stage)

  const end = dayValue(endDate) ?? start
  // Inclusive end-of-day so the last day still counts as "during".
  const endOfLastDay = end + 24 * 60 * 60 * 1000 - 1
  const now = today.getTime()

  if (now < start) return 'before'
  if (now > endOfLastDay) return 'after'
  return 'during'
}

export const PHASE_LABELS: Record<ConferencePhase, string> = {
  before: 'Before',
  during: 'During',
  after: 'After',
}

/** A short, human status line for the phase header. */
export function phaseStatusLine(
  phase: ConferencePhase,
  startDate: string | null,
  endDate: string | null,
  today: Date = new Date()
): string {
  const start = dayValue(startDate)
  const end = dayValue(endDate) ?? start
  const dayMs = 24 * 60 * 60 * 1000

  if (phase === 'during') return 'Happening now — capture photos and takeaways on-site.'
  if (phase === 'after') {
    if (end !== null) {
      const daysSince = Math.floor((today.getTime() - end) / dayMs)
      if (daysSince <= 14) return 'Just ended — time to report and amplify.'
    }
    return 'Ended — wrap up the follow-up and amplification.'
  }
  // before
  if (start !== null) {
    const daysUntil = Math.ceil((start - today.getTime()) / dayMs)
    if (daysUntil <= 0) return 'Starting today.'
    if (daysUntil === 1) return 'Starts tomorrow — finalise the presentation.'
    if (daysUntil <= 30) return `Starts in ${daysUntil} days — prepare the presentation and people.`
  }
  return 'Upcoming — plan the visit and the presentation.'
}

// ── Attending type ────────────────────────────────────────────────────────────

/** Unified attending type across the internal prep and guest role vocabularies. */
export type AttendingType = 'attendee' | 'presenter' | 'organizer'

export const ATTENDING_TYPE_LABELS: Record<AttendingType, string> = {
  attendee: 'Attending only',
  presenter: 'Presenting',
  organizer: 'Organising',
}

/**
 * Collapse the two historical vocabularies — the internal `has_presentation`
 * boolean and the guest `role` string — into one attending type.
 */
export function toAttendingType(opts: { hasPresentation?: boolean | null; role?: string | null }): AttendingType {
  const role = (opts.role ?? '').trim().toLowerCase()
  if (role === 'organizer' || role === 'organiser') return 'organizer'
  if (role === 'speaker' || role === 'panelist' || role === 'panellist' || role === 'presenter') return 'presenter'
  if (opts.hasPresentation === true) return 'presenter'
  return 'attendee'
}

/** Whether this attending type presents (drives the presentation requirements). */
export function isPresenting(type: AttendingType): boolean {
  return type === 'presenter' || type === 'organizer'
}

// ── Requirements ──────────────────────────────────────────────────────────────

/** The tiles a requirement can belong to on the operating page. */
export type RequirementTile = 'presentation' | 'onsite' | 'amplify'

/** The material presence flags a requirement reads (computed by the caller). */
export type RequirementInputs = {
  hasAbstract: boolean
  hasDeck: boolean
  delivered: boolean
  hasPhotos: boolean
  hasTakeaways: boolean
  reportDone: boolean
}

export type RequirementContext = {
  phase: ConferencePhase
  attendingType: AttendingType
}

export type ConferenceRequirement = {
  key: string
  label: string
  tile: RequirementTile
  appliesWhen: (ctx: RequirementContext) => boolean
  dueFrom: ConferencePhase
  isProvided: (inputs: RequirementInputs) => boolean
}

const always = () => true
const presenterOnly = (ctx: RequirementContext) => isPresenting(ctx.attendingType)

/**
 * The canonical requirement set. Order matters only for display within a tile.
 */
export const CONFERENCE_REQUIREMENTS: ConferenceRequirement[] = [
  { key: 'abstract', label: 'Abstract submitted', tile: 'presentation', appliesWhen: presenterOnly, dueFrom: 'before', isProvided: (i) => i.hasAbstract },
  { key: 'deck', label: 'Presentation deck', tile: 'presentation', appliesWhen: presenterOnly, dueFrom: 'before', isProvided: (i) => i.hasDeck },
  { key: 'delivered', label: 'Presentation delivered', tile: 'presentation', appliesWhen: presenterOnly, dueFrom: 'during', isProvided: (i) => i.delivered },
  { key: 'photos', label: 'Photos from the event', tile: 'onsite', appliesWhen: always, dueFrom: 'during', isProvided: (i) => i.hasPhotos },
  { key: 'takeaways', label: 'Takeaways & quotes', tile: 'onsite', appliesWhen: always, dueFrom: 'during', isProvided: (i) => i.hasTakeaways },
  { key: 'report', label: 'Report / amplification', tile: 'amplify', appliesWhen: always, dueFrom: 'after', isProvided: (i) => i.reportDone },
]

// ── Status derivation ─────────────────────────────────────────────────────────

export type RequirementStatus = 'provided' | 'due' | 'upcoming' | 'na'

/**
 * The heart of the model:
 *   not applicable          → na       (hidden)
 *   material present        → provided (green)
 *   applies and past-due    → due      (red)
 *   applies but not due yet → upcoming (neutral)
 */
export function deriveRequirementStatus(
  req: ConferenceRequirement,
  ctx: RequirementContext,
  inputs: RequirementInputs
): RequirementStatus {
  if (!req.appliesWhen(ctx)) return 'na'
  if (req.isProvided(inputs)) return 'provided'
  if (PHASE_RANK[ctx.phase] >= PHASE_RANK[req.dueFrom]) return 'due'
  return 'upcoming'
}

/** All requirement statuses for a tile, keyed by requirement key. */
export function tileRequirementStatuses(
  tile: RequirementTile,
  ctx: RequirementContext,
  inputs: RequirementInputs
): Array<{ req: ConferenceRequirement; status: RequirementStatus }> {
  return CONFERENCE_REQUIREMENTS.filter((r) => r.tile === tile).map((req) => ({
    req,
    status: deriveRequirementStatus(req, ctx, inputs),
  }))
}

/** A tile's rolled-up status from its requirements' statuses. */
export type TileStatus = 'provided' | 'due' | 'upcoming' | 'empty'

export function rollUpTileStatus(statuses: RequirementStatus[]): TileStatus {
  const applicable = statuses.filter((s) => s !== 'na')
  if (applicable.length === 0) return 'empty'
  if (applicable.some((s) => s === 'due')) return 'due'
  if (applicable.every((s) => s === 'provided')) return 'provided'
  return 'upcoming'
}

/** Provided / total count for a tile (excludes n/a items). */
export function tileProgress(statuses: RequirementStatus[]): { done: number; total: number } {
  const applicable = statuses.filter((s) => s !== 'na')
  return { done: applicable.filter((s) => s === 'provided').length, total: applicable.length }
}

// ── Presentation mapping for the shared status chrome ────────────────────────

const STATUS_TONES: Record<RequirementStatus | TileStatus, StatusTone> = {
  provided: 'green',
  due: 'red',
  upcoming: 'neutral',
  empty: 'neutral',
  na: 'neutral',
}

export function statusTone(status: RequirementStatus | TileStatus): StatusTone {
  return STATUS_TONES[status]
}

/** Accessible label used alongside the colour dot (never colour alone). */
export function statusLabel(status: RequirementStatus | TileStatus): string {
  switch (status) {
    case 'provided':
      return 'Provided'
    case 'due':
      return 'Needed now'
    case 'upcoming':
      return 'Not yet due'
    case 'empty':
      return 'Nothing needed'
    default:
      return ''
  }
}
