import Link from 'next/link'
import { startCampusMeeting } from '@/app/app/comms/campus-log/actions'
import { CollapsibleCard } from '@/components/ui/collapsible-card'
import { CampusMeetingChecklist } from '@/components/comms/campus-meeting-checklist'
import { CampusHighlight } from '@/components/comms/campus-highlight'
import { CampusDecisionsActions } from '@/components/comms/campus-decisions-actions'
import { MeetingTranscriptPanel } from '@/components/comms/meeting-transcript-panel'
import { CampusBriefingPanel } from '@/components/comms/campus-briefing-panel'
import { loadCampusMeetingTasks, loadCommsTeamMembers } from '@/lib/comms-dashboard-data'
import { loadCampusSessionTranscript } from '@/lib/comms-meeting-transcripts'
import { loadCampusDigest } from '@/modules/ai-features/domain/whatsapp-feed-store'
import { WhatsAppDigestPanel } from '@/modules/intake/ui/whatsapp-digest-panel'
import { deriveMeetingWindow } from '@/modules/ai-features/domain/whatsapp-feed-categorization'
import { campusWindowIso, countCampusIncoming } from '@/lib/campus-metrics'
import { ResizableSplit } from '@/components/ui/resizable-split'
import { isAiEnabled } from '@/lib/ai/feature-flag'
import type { CampusBriefing } from '@/lib/ai/campus-briefing'
import { normalizeRole } from '@/lib/role-access'
import { createClient } from '@/lib/supabase/server'

function monthBounds(year: string, month: string) {
  const numericYear = Number(year)
  const numericMonth = Number(month)
  const safeYear = Number.isFinite(numericYear) ? numericYear : new Date().getFullYear()
  const safeMonth = Number.isFinite(numericMonth) && numericMonth >= 1 && numericMonth <= 12 ? numericMonth : new Date().getMonth() + 1
  const start = new Date(safeYear, safeMonth - 1, 1)
  const end = new Date(safeYear, safeMonth, 1)
  return { start, end }
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(date)
}

function dateOnly(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

// The campus team meets on the last Wednesday of the month — the natural default
// date when starting this month's meeting from the briefing workspace.
function lastWednesdayOf(year: string, month: string) {
  const date = new Date(Number(year), Number(month), 0)
  while (date.getDay() !== 3) date.setDate(date.getDate() - 1)
  return dateOnly(date)
}

function formatDate(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  // Intl.format throws "Invalid time value" on a bad date — guard against it.
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date)
}

const TABS = ['Briefing', 'Field newsfeed', 'WhatsApp'] as const
type IncomingTab = (typeof TABS)[number]

function tabKey(value: string | undefined): IncomingTab {
  return TABS.find((s) => s.toLowerCase() === value?.toLowerCase()) ?? 'Briefing'
}

type CampusMonthPageProps = {
  params: Promise<{ year: string; month: string }>
  searchParams?: Promise<{ source?: string }>
}

export default async function CampusMonthPage(props: CampusMonthPageProps) {
  // Render inside a guard so a single bad row / failed query degrades to a
  // visible message instead of 500-ing the whole route (and showing the
  // generic "unexpected response from the server" boundary).
  try {
    return await CampusMonthView(props)
  } catch (error) {
    console.error('[campus month page] render failed', error)
    const message = error instanceof Error ? error.message : String(error)
    return (
      <div className="mx-auto max-w-2xl py-12">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h1 className="text-lg font-semibold text-amber-900">This month&apos;s campus workspace couldn&apos;t load</h1>
          <p className="mt-1 text-sm text-amber-800">Other pages are unaffected. Technical detail:</p>
          <p className="mt-3 break-words rounded-lg border border-amber-200 bg-white px-3 py-2 font-mono text-xs text-amber-900">{message.slice(0, 400)}</p>
        </div>
      </div>
    )
  }
}

async function CampusMonthView({ params, searchParams }: CampusMonthPageProps) {
  const { year, month } = await params
  const selectedTab = tabKey((await searchParams)?.source)
  const { start, end } = monthBounds(year, month)
  const startDate = dateOnly(start)
  const endDate = dateOnly(end)
  const supabase = await createClient()

  const [{ data: newsfeedData }, { data: sessions }, { data: recentSessionRows }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('news_feed_items')
      .select('id, headline, summary, category, region, source_url, source_name, published_at, created_at')
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('campus_sessions')
      .select('id, session_date, theme, summary, action_items_for_publication, decisions_for_publication')
      .gte('session_date', startDate)
      .lt('session_date', endDate)
      // Stable ordering: monthly meetings share a session_date (the last
      // Wednesday), so without a deterministic tiebreaker Postgres can return
      // tied rows in a different order after any update — making the "primary"
      // session flip between reloads. created_at asc consistently picks the
      // first-created session (the one its checklist was seeded on).
      .order('session_date', { ascending: false })
      .order('created_at', { ascending: true }),
    // Recent session dates to derive this meeting's window (previous → this).
    supabase.from('campus_sessions').select('session_date').order('session_date', { ascending: false }).limit(24),
  ])

  type NewsfeedItem = {
    id: string; headline: string; summary: string | null; category: string | null
    region: string | null; source_url: string | null; source_name: string | null
    published_at: string | null; created_at: string | null
  }
  const newsfeedItems: NewsfeedItem[] = (newsfeedData ?? []) as NewsfeedItem[]
  const recentSessionDates = ((recentSessionRows ?? []) as Array<{ session_date: string | null }>).map((r) => r.session_date)
  const meetingTitle = `${formatMonth(start)} meeting`
  const returnPath = `/app/comms/campus/${year}/${month}`

  const primarySession = sessions?.[0]

  const [teamMembers, meetingTasks, transcript] = primarySession
    ? await Promise.all([
        loadCommsTeamMembers(supabase),
        loadCampusMeetingTasks(supabase, primarySession.id),
        loadCampusSessionTranscript(supabase, primarySession.id),
      ])
    : [[], [], null]
  const transcriptOwners = teamMembers.map((member) => ({ id: member.id, label: member.label }))
  // Shared WhatsApp digest for this meeting — read-only here; generated in the
  // WhatsApp workspace and resolved via campus_session_id. Never re-run here.
  const campusDigest = primarySession ? await loadCampusDigest(supabase, primarySession.id) : null
  // Canonical incoming for this meeting's window (previous → this meeting) —
  // the same number the nav badge and Campus overview show.
  const meetingWindow = primarySession ? deriveMeetingWindow(recentSessionDates, primarySession.session_date) : null
  const incomingCount = meetingWindow ? await countCampusIncoming(supabase, campusWindowIso(meetingWindow)) : 0
  const aiEnabled = isAiEnabled()
  const completedMeetingTasks = meetingTasks.filter((task) => task.status === 'completed').length
  const monthLastWednesday = lastWednesdayOf(year, month)

  // Audience briefing + presenter (highlight of the month). briefing*/presenter*
  // columns are not in the generated Database types yet.
  let briefing: CampusBriefing | null = null
  let briefingGeneratedAt: string | null = null
  let briefingPresenter = ''
  let presenterName: string | null = null
  let presenterAvatarUrl: string | null = null
  let presenterLinkedinUrl: string | null = null
  if (primarySession) {
    // Two separate selects so a missing migration on one feature (e.g. 00105
    // presenter columns) can't break the read of the other (00104 briefing).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { data: briefingRow } = await db
      .from('campus_sessions')
      .select('briefing, briefing_generated_at, briefing_presenter')
      .eq('id', primarySession.id)
      .maybeSingle()
    briefing = (briefingRow?.briefing as CampusBriefing | null) ?? null
    briefingGeneratedAt = (briefingRow?.briefing_generated_at as string | null) ?? null
    briefingPresenter = (briefingRow?.briefing_presenter as string | null) ?? ''

    const { data: presenterRow } = await db
      .from('campus_sessions')
      .select('presenter_name, presenter_avatar_url, presenter_linkedin_url')
      .eq('id', primarySession.id)
      .maybeSingle()
    presenterName = (presenterRow?.presenter_name as string | null) ?? null
    presenterAvatarUrl = (presenterRow?.presenter_avatar_url as string | null) ?? null
    presenterLinkedinUrl = (presenterRow?.presenter_linkedin_url as string | null) ?? null
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  let isAdmin = false
  if (user) {
    const { data: profileRow } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    isAdmin = normalizeRole(profileRow?.role) === 'PlatformAdmin'
  }

  const decisionCount = (transcript?.summary?.decisions.length ?? 0) + (transcript?.followUpProposals.length ?? 0)

  return (
    <div className="space-y-4">
      <header className="grid gap-3 border-b border-neutral-200 pb-4 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        <Link href="/app/comms/campus" className="rounded-lg border border-blue-900 px-3 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-50">
          &lt;- Campus
        </Link>
        <div>
          <h1 className="text-2xl font-semibold leading-tight text-neutral-900">{meetingTitle}</h1>
          <p className="text-sm text-neutral-500">
            {primarySession?.theme || 'Last Wednesday of the month'} - briefing workspace
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/app/comms/intake" className="rounded-lg border border-blue-900 px-4 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-50">
            View raw feed
          </Link>
          <span className="rounded-full bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">Saved</span>
        </div>
      </header>

      <ResizableSplit
        variant="seam"
        storageKey="campus-month"
        defaultRatio={0.7}
        className="min-h-[720px] overflow-hidden rounded-xl border border-neutral-200 bg-white"
        right={
        <section className="border-neutral-200">
          <div className="border-b border-neutral-200 bg-neutral-50 px-5 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-neutral-900">Incoming</h2>
              {selectedTab !== 'Briefing' && (
                <span className="rounded-full bg-orange-600 px-2.5 py-0.5 text-xs font-bold text-white">
                  {selectedTab === 'Field newsfeed' ? newsfeedItems.length : incomingCount}
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {TABS.map((source) => {
                const isActive = selectedTab === source
                const href = `${returnPath}?source=${encodeURIComponent(source)}#raw-feed`
                return (
                  <Link
                    key={source}
                    href={href}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${isActive ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-300 bg-white text-neutral-950 hover:bg-neutral-100'}`}
                  >
                    {source}
                  </Link>
                )
              })}
            </div>
          </div>

          <div id="raw-feed" className="scroll-mt-24 max-h-[680px] space-y-3 overflow-y-auto px-5 py-4">
            {selectedTab === 'Briefing' && (
              <CampusBriefingPanel
                sessionId={primarySession?.id ?? null}
                returnPath={returnPath}
                briefing={briefing}
                generatedAt={briefingGeneratedAt}
                defaultPresenter={briefingPresenter}
                defaultTopic={primarySession?.theme ?? ''}
                isAdmin={isAdmin}
                aiEnabled={aiEnabled}
              />
            )}

            {selectedTab === 'Field newsfeed' && (
              <>
                {newsfeedItems.map((item) => (
                  <article key={item.id} className="rounded-lg border border-neutral-200 bg-neutral-50">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-4 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.category && (
                          <span className="rounded-full bg-blue-900 px-2 py-0.5 text-xs font-bold text-white">{item.category}</span>
                        )}
                        {item.region && (
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600">{item.region}</span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-neutral-500">
                        {item.source_name ?? ''}{item.published_at ? ` · ${formatDate(item.published_at)}` : ''}
                      </p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-sm font-semibold text-neutral-950">{item.headline}</p>
                      {item.summary && (
                        <p className="mt-1 line-clamp-3 text-sm leading-5 text-neutral-600">{item.summary}</p>
                      )}
                      {item.source_url && (
                        <div className="mt-3">
                          <a
                            href={item.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-50"
                          >
                            Open link
                          </a>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
                {newsfeedItems.length === 0 && (
                  <p className="rounded-lg border border-dashed border-neutral-300 py-10 text-center text-sm text-neutral-500">
                    No field newsfeed items yet.
                  </p>
                )}
              </>
            )}

            {selectedTab === 'WhatsApp' &&
              (campusDigest ? (
                <WhatsAppDigestPanel summary={campusDigest.summary} items={campusDigest.items} teamMembers={teamMembers} editable={false} />
              ) : (
                <p className="rounded-lg border border-dashed border-neutral-300 py-10 text-center text-sm text-neutral-500">
                  No WhatsApp digest for this meeting yet. Generate it in the{' '}
                  <Link href="/app/comms/whatsapp" className="font-semibold text-orange-600 hover:underline">
                    WhatsApp workspace
                  </Link>{' '}
                  — it will appear here automatically.
                </p>
              ))}
          </div>
        </section>
        }
        left={
        <aside className="bg-white">
          <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-5 py-3">
            <h2 className="text-base font-semibold text-neutral-900">Meeting details</h2>
          </div>

          <div className="max-h-[680px] space-y-4 overflow-y-auto px-5 py-4">
            {!primarySession ? (
              <div className="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-6">
                <p className="text-sm text-neutral-600">No campus meeting exists for this month yet.</p>
                <form action={startCampusMeeting} className="mt-3">
                  <input type="hidden" name="return_path" value={returnPath} />
                  <input type="hidden" name="session_date" value={monthLastWednesday} />
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-900 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                  >
                    Create this month&apos;s meeting
                  </button>
                </form>
              </div>
            ) : (
              <>
                {/* Highlight of the month — presenter + highlight text */}
                <CampusHighlight
                  sessionId={primarySession.id}
                  year={year}
                  month={month}
                  uploaderId={user?.id ?? ''}
                  summary={primarySession.summary ?? null}
                  editHref={`/app/comms/campus-log/sessions/${primarySession.id}`}
                  presenterName={presenterName}
                  presenterAvatarUrl={presenterAvatarUrl}
                  presenterLinkedinUrl={presenterLinkedinUrl}
                />

                {/* Campus checklist */}
                <CollapsibleCard
                  title="Meeting checklist"
                  storageKey="campus-checklist"
                  bodyClassName="px-0 pb-0"
                  actions={
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                      {completedMeetingTasks}/{meetingTasks.length} done
                    </span>
                  }
                >
                  <CampusMeetingChecklist
                    sessionId={primarySession.id}
                    year={year}
                    month={month}
                    tasks={meetingTasks}
                    teamMembers={teamMembers}
                  />
                </CollapsibleCard>

                {/* Meeting AI summary with transcript */}
                <CollapsibleCard
                  title="Meeting AI summary & transcript"
                  storageKey="campus-transcript"
                  bodyClassName="px-0 pb-0"
                  actions={
                    <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">
                      {transcript?.summary ? 'Summary ready' : transcript ? 'Transcript uploaded' : 'No transcript'}
                    </span>
                  }
                >
                  <div className="border-t border-neutral-200 px-4 py-3">
                    <MeetingTranscriptPanel
                      context={{ kind: 'campus', campusSessionId: primarySession.id }}
                      transcript={transcript}
                      owners={transcriptOwners}
                      aiEnabled={aiEnabled}
                    />
                  </div>
                </CollapsibleCard>

                {/* Decisions & action items (AI-extracted from the transcript) */}
                <CollapsibleCard
                  title="Decisions & action items"
                  storageKey="campus-decisions"
                  bodyClassName="px-0 pb-0"
                  actions={
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600">
                      {decisionCount} items
                    </span>
                  }
                >
                  <CampusDecisionsActions
                    summary={transcript?.summary ?? null}
                    proposals={transcript?.followUpProposals ?? []}
                  />
                </CollapsibleCard>
              </>
            )}
          </div>
        </aside>
        }
      />
    </div>
  )
}
