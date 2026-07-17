import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { isAiEnabled } from '@/lib/ai/feature-flag'
import { executeAndRecordConferenceRun, markConferenceRunStarted } from '@/lib/ai/conference-run'
import type { ConferenceDiscoveryTuning } from '@/modules/ai-features/domain/conference-discovery-job'
import { resolveSetting } from '@/kernel/settings'
import { findSettingsPanel } from '@/modules/settings-registry'

export const maxDuration = 300

type DiscoverySettings = {
  enabled: boolean
  intervalDays: number
  tuning: ConferenceDiscoveryTuning
}

const num = (value: unknown, fallback: number): number => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}
const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : value === 'true' ? true : value === 'false' ? false : fallback

/**
 * Resolve the operator-tunable discovery settings from the events component
 * panel (Platform Settings). Uses the service-role client so the scheduled job
 * — which has no user session — can still read the configured values.
 */
async function resolveDiscoverySettings(): Promise<DiscoverySettings> {
  const panel = findSettingsPanel('component:events')
  if (!panel) {
    return { enabled: true, intervalDays: 7, tuning: {} }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const read = (key: string) => resolveSetting(admin, panel, key)
  const [enabled, intervalDays, monthsAhead, maxSearchesPerLane, maxLanesPerRegion, existingNamesCap] = await Promise.all([
    read('discoveryEnabled'),
    read('discoveryIntervalDays'),
    read('discoveryMonthsAhead'),
    read('discoveryMaxSearchesPerLane'),
    read('discoveryMaxLanesPerRegion'),
    read('discoveryExistingNamesCap'),
  ])
  return {
    enabled: bool(enabled, true),
    intervalDays: num(intervalDays, 7),
    tuning: {
      monthsAhead: num(monthsAhead, 12),
      maxSearchesPerLane: num(maxSearchesPerLane, 4),
      maxLanesPerRegion: num(maxLanesPerRegion, 6),
      existingNamesCap: num(existingNamesCap, 50),
    },
  }
}

/** Was there a successful refresh within the last `intervalDays` days? */
async function refreshedRecently(intervalDays: number): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any
    const { data } = await admin
      .from('conference_discovery_status')
      .select('last_run_status, last_run_finished_at')
      .eq('singleton', true)
      .maybeSingle()
    if (!data?.last_run_finished_at || data.last_run_status !== 'success') return false
    const ageMs = Date.now() - new Date(data.last_run_finished_at as string).getTime()
    return ageMs < intervalDays * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

/**
 * Scheduled cache refresh: collect upcoming oncology conferences globally and
 * save them to Supabase. The page itself only reads saved rows, so users do not
 * wait for AI/web-search work during normal browsing. Honours the configured
 * enable flag + minimum interval so the daily cron respects the operator's
 * chosen cadence.
 */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''

  if (expected && provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const settings = await resolveDiscoverySettings()
  if (!settings.enabled) {
    return NextResponse.json({ ok: true, skipped: 'discovery_disabled' })
  }
  if (await refreshedRecently(settings.intervalDays)) {
    return NextResponse.json({ ok: true, skipped: 'interval_not_elapsed' })
  }

  return runDiscovery(null, settings.tuning)
}

/**
 * Manual admin override for the same cache refresh. This is not part of the page
 * read path: existing saved conferences remain visible while the refresh runs.
 * Bypasses the interval gate — an admin asking for a refresh means now.
 */
export async function POST() {
  const supabase = await createClient()
  const auth = await supabase.auth.getUser()
  const user = auth.data.user
  if (!user) return NextResponse.json({ ok: false, error: 'Not authenticated.' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCommsWorkspace(profile?.role)) {
    return NextResponse.json({ ok: false, error: 'You do not have access to the Conferences workspace.' }, { status: 403 })
  }

  const settings = await resolveDiscoverySettings()
  return runDiscovery(user.id, settings.tuning)
}

async function runDiscovery(userId: string | null, tuning: ConferenceDiscoveryTuning) {
  if (!isAiEnabled()) {
    return NextResponse.json({ ok: false, error: 'AI features are disabled.' }, { status: 503 })
  }

  try {
    const claim = await markConferenceRunStarted()
    if (!claim.started) {
      return NextResponse.json({ ok: true, skipped: 'already_running' })
    }
    await executeAndRecordConferenceRun(userId, tuning)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Conference discovery job failed.' },
      { status: 500 }
    )
  }
}
