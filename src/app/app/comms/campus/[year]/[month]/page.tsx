import Link from 'next/link'
import { addCampusActionItem, addCampusAgendaItem, addCampusDecisionItem, updateCampusDecisionItem } from '@/app/app/comms/campus-log/actions'
import { deleteIntakeItem, markIntakeReviewed } from '@/app/app/comms/intake/actions'
import { createClient } from '@/lib/supabase/server'

async function markReviewedAction(formData: FormData) {
  'use server'
  await markIntakeReviewed(undefined, formData)
}

async function deleteIntakeAction(formData: FormData) {
  'use server'
  await deleteIntakeItem(undefined, formData)
}

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

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(value))
}

function typeLabel(value: string) {
  return value.replaceAll('_', ' ')
}

function categoryFor(value: string) {
  if (value === 'article_share') return 'Articles and research'
  if (value === 'media_request') return 'Media'
  if (value === 'member_intro') return 'Members'
  if (value === 'noise') return 'Miscellaneous'
  return 'Other incoming'
}

const FILTERS = ['All', 'Articles', 'Media', 'LinkedIn', 'Sessions', 'Members', 'Social']
const ACTION_ITEM_EXAMPLES = [
  'Action: Confirm Nigeria imPACT publication note | Owner: Ifeoma | Due: 2026-06-05',
  'Action: Prepare Monica birthday newsletter item | Owner: Maryana | Due: 2026-06-12',
  'Action: Collect Dr. Mao Mao session assets | Owner: Atefeh | Due: 2026-06-18',
]

function sourceLinkFor(item: { source_url?: string | null; raw_content: string }) {
  if (item.source_url) return item.source_url
  return item.raw_content.match(/https?:\/\/[^\s)]+/i)?.[0] ?? null
}

function cleanAgendaItem(value: string) {
  return value.replace(/^Agenda:\s*/i, '').replace(/^Action:\s*/i, '').split('|')[0].trim()
}

function parseActionItem(value: string) {
  const parts = value.split('|').map((part) => part.trim())
  const action = parts[0]?.replace(/^Action:\s*/i, '').replace(/^Agenda:\s*/i, '').trim() || value
  const owner = parts.find((part) => /^Owner:/i.test(part))?.replace(/^Owner:\s*/i, '').trim() || 'Comms team'
  const due = parts.find((part) => /^Due:/i.test(part))?.replace(/^Due:\s*/i, '').trim() || 'Before next meeting'
  return { action, owner, due }
}

function parseDecisionItem(value: string) {
  const parts = value.split('|').map((part) => part.trim())
  const decision = parts[0]?.replace(/^Decision:\s*/i, '').trim() || value
  const owner = parts.find((part) => /^Owner:/i.test(part))?.replace(/^Owner:\s*/i, '').trim() || 'Unassigned'
  return { decision, owner }
}

function filterKey(value: string | undefined) {
  return FILTERS.find((filter) => filter.toLowerCase() === value?.toLowerCase()) ?? 'All'
}

function matchesFilter(item: { content_type: string; raw_content: string; source_url?: string | null }, filter: string) {
  const haystack = `${item.content_type} ${item.raw_content} ${item.source_url ?? ''}`.toLowerCase()
  if (filter === 'All') return true
  if (filter === 'Articles') return item.content_type === 'article_share'
  if (filter === 'Media') return item.content_type === 'media_request'
  if (filter === 'LinkedIn') return haystack.includes('linkedin')
  if (filter === 'Sessions') return haystack.includes('session') || haystack.includes('world campus')
  if (filter === 'Members') return item.content_type === 'member_intro' || haystack.includes('welcome')
  if (filter === 'Social') return haystack.includes('facebook') || haystack.includes('instagram') || haystack.includes('social')
  return true
}

export default async function CampusMonthPage({
  params,
  searchParams,
}: {
  params: Promise<{ year: string; month: string }>
  searchParams?: Promise<{ filter?: string }>
}) {
  const { year, month } = await params
  const selectedFilter = filterKey((await searchParams)?.filter)
  const { start, end } = monthBounds(year, month)
  const startDate = dateOnly(start)
  const endDate = dateOnly(end)
  const supabase = await createClient()

  const [{ data: intakeItems }, { data: sessions }, { data: members }] = await Promise.all([
    supabase
      .from('intake_items')
      .select('id, sender_name, content_type, raw_content, source_url, status, captured_at')
      .gte('captured_at', start.toISOString())
      .lt('captured_at', end.toISOString())
      .order('captured_at', { ascending: false }),
    supabase
      .from('campus_sessions')
      .select('id, session_date, theme, summary, action_items_for_publication, decisions_for_publication')
      .gte('session_date', startDate)
      .lt('session_date', endDate)
      .order('session_date', { ascending: false }),
    supabase
      .from('campus_members')
      .select('id, name, country, organisation, date_welcomed, notes')
      .gte('date_welcomed', startDate)
      .lt('date_welcomed', endDate)
      .order('date_welcomed', { ascending: false }),
  ])

  const incomingItems = intakeItems ?? []
  const meetingTitle = `${formatMonth(start)} meeting`
  const returnPath = `/app/comms/campus/${year}/${month}`
  const visibleIncomingItems = incomingItems.filter((item) => matchesFilter(item, selectedFilter))
  const groupedIncoming = visibleIncomingItems.reduce<Record<string, typeof visibleIncomingItems>>((groups, item) => {
    const category = categoryFor(item.content_type)
    groups[category] = [...(groups[category] ?? []), item]
    return groups
  }, {})

  const primarySession = sessions?.[0]
  const agendaItems = [
    ...(primarySession?.action_items_for_publication ?? []),
    ...incomingItems.slice(0, 3).map((item) => item.raw_content.slice(0, 96)),
  ].filter((item) => item && !/^Action:/i.test(item))
  const actionItems = [
    ...(primarySession?.action_items_for_publication ?? []).filter((item) => /^Action:/i.test(item)),
    ...ACTION_ITEM_EXAMPLES,
  ].slice(0, 8)
  const decisions = (primarySession?.decisions_for_publication?.length
    ? primarySession.decisions_for_publication
    : (sessions ?? []).flatMap((session) => session.summary ? [`Decision: ${session.summary} | Owner: Session summary`] : []))

  return (
    <div className="mx-auto max-w-6xl space-y-4">
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

      <div className="grid min-h-[720px] overflow-hidden rounded-xl border border-neutral-200 bg-white lg:grid-cols-[1.1fr_0.9fr]">
        <section className="border-r border-neutral-200">
          <div className="border-b border-neutral-200 bg-neutral-50 px-5 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-neutral-900">Incoming this month</h2>
              <span className="rounded-full bg-orange-600 px-2.5 py-0.5 text-xs font-bold text-white">{incomingItems.length}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {FILTERS.map((filter, index) => {
                const isActive = selectedFilter === filter
                const href = filter === 'All' ? `${returnPath}#raw-feed` : `${returnPath}?filter=${encodeURIComponent(filter)}#raw-feed`
                return (
                <Link
                  key={filter}
                  href={href}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${isActive || (index === 0 && selectedFilter === 'All') ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-300 bg-white text-neutral-950 hover:bg-neutral-100'}`}
                >
                  {filter}
                </Link>
                )
              })}
            </div>
          </div>

          <div id="raw-feed" className="scroll-mt-24 max-h-[680px] space-y-5 overflow-y-auto px-5 py-4">
            {Object.entries(groupedIncoming).map(([category, items]) => (
              <section key={category} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-blue-900">{category}</h3>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{items.length}</span>
                </div>
                {items.map((item) => {
                  const sourceLink = sourceLinkFor(item)
                  return (
                  <article key={item.id} className="rounded-lg border border-neutral-200 bg-neutral-50">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-4 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-blue-900 px-2 py-0.5 text-xs font-bold text-white">{typeLabel(item.content_type)}</span>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">{item.status}</span>
                      </div>
                      <p className="text-xs font-medium text-neutral-500">{item.sender_name} - {formatDate(item.captured_at)}</p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-sm font-semibold text-neutral-950">{item.raw_content.slice(0, 90)}</p>
                      <p className="mt-1 line-clamp-3 text-sm leading-5 text-neutral-600">{item.raw_content}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.status === 'unreviewed' && (
                          <form action={markReviewedAction}>
                            <input type="hidden" name="intake_item_id" value={item.id} />
                            <input type="hidden" name="return_path" value={returnPath} />
                            <button type="submit" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                              Review
                            </button>
                          </form>
                        )}
                        {primarySession && (
                          <form action={addCampusAgendaItem}>
                            <input type="hidden" name="session_id" value={primarySession.id} />
                            <input type="hidden" name="agenda_item" value={item.raw_content} />
                            <input type="hidden" name="return_path" value={returnPath} />
                            <button type="submit" className="rounded-lg bg-blue-900 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-800">
                              + Agenda
                            </button>
                          </form>
                        )}
                        {sourceLink && (
                          <a
                            href={sourceLink}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-50"
                          >
                            Open link
                          </a>
                        )}
                        <form action={deleteIntakeAction}>
                          <input type="hidden" name="intake_item_id" value={item.id} />
                          <input type="hidden" name="return_path" value={returnPath} />
                          <button type="submit" className="rounded-lg border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">
                            Delete
                          </button>
                        </form>
                      </div>
                    </div>
                  </article>
                  )
                })}
              </section>
            ))}

            {visibleIncomingItems.length === 0 && (
              <p className="rounded-lg border border-dashed border-neutral-300 py-10 text-center text-sm text-neutral-500">
                No incoming feed items match this filter.
              </p>
            )}
          </div>
        </section>

        <aside className="bg-white">
          <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-5 py-3">
            <h2 className="text-base font-semibold text-neutral-900">Meeting briefing</h2>
            <div className="flex gap-2">
              <span className="rounded-lg border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-700">Export</span>
              <span className="rounded-lg border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-blue-700">Share to Teams</span>
            </div>
          </div>

          <div className="max-h-[680px] space-y-4 overflow-y-auto px-5 py-4">
            <section className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-blue-900">What happened this month</h3>
                <span className="text-xs font-bold uppercase text-blue-900">Edit</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-neutral-900">
                {primarySession?.summary ||
                  incomingItems.slice(0, 3).map((item) => `${item.sender_name} shared ${typeLabel(item.content_type)}`).join('. ') ||
                  'Briefing summary will be built from routed intake, session notes, and member welcomes.'}
              </p>
            </section>

            <section className="rounded-lg border border-neutral-200">
              <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-2">
                <h3 className="text-sm font-semibold text-neutral-900">What happened - {formatMonth(start)}</h3>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  {incomingItems.length + (members?.length ?? 0)} items
                </span>
              </div>
              <ul className="divide-y divide-neutral-100">
                {incomingItems.slice(0, 5).map((item) => (
                  <li key={item.id} className="px-4 py-3 text-sm leading-5 text-neutral-700">
                    {item.sender_name} shared {typeLabel(item.content_type)} - {item.raw_content.slice(0, 88)}
                  </li>
                ))}
                {(members ?? []).slice(0, 3).map((member) => (
                  <li key={member.id} className="px-4 py-3 text-sm leading-5 text-neutral-700">
                    Welcome {member.name}{member.country ? ` from ${member.country}` : ''}
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-lg border border-neutral-200">
              <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-2">
                <h3 className="text-sm font-semibold text-neutral-900">Agenda</h3>
                <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">{agendaItems.length} items</span>
              </div>
              <ol className="divide-y divide-neutral-100">
                {agendaItems.slice(0, 6).map((item, index) => (
                  <li key={`${item}-${index}`} className="grid grid-cols-[24px_1fr] gap-3 px-4 py-3 text-sm leading-5 text-neutral-700">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-50 text-xs font-bold text-orange-700">{index + 1}</span>
                    <span>{cleanAgendaItem(item)}</span>
                  </li>
                ))}
                {agendaItems.length === 0 && (
                  <li className="px-4 py-8 text-center text-sm text-neutral-500">No agenda items yet.</li>
                )}
              </ol>
            </section>

            <section className="rounded-lg border border-neutral-200">
              <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-2">
                <h3 className="text-sm font-semibold text-neutral-900">Action items</h3>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{actionItems.length} items</span>
              </div>
              <ul className="divide-y divide-neutral-100">
                {actionItems.map((item, index) => {
                  const actionItem = parseActionItem(item)
                  return (
                    <li key={`${item}-${index}`} className="px-4 py-3 text-sm leading-5">
                      <p className="font-semibold text-neutral-900">{actionItem.action}</p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {actionItem.owner} - {actionItem.due}
                      </p>
                    </li>
                  )
                })}
              </ul>
              {primarySession && (
                <form action={addCampusActionItem} className="grid gap-3 border-t border-neutral-200 p-4">
                  <input type="hidden" name="session_id" value={primarySession.id} />
                  <input type="hidden" name="return_path" value={returnPath} />
                  <input
                    name="action_item"
                    required
                    placeholder="Action item"
                    className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      name="assigned_to"
                      required
                      placeholder="Assigned person"
                      className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                    />
                    <input
                      type="date"
                      name="due_date"
                      required
                      className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <button type="submit" className="rounded-lg bg-blue-900 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800">
                    Add action item
                  </button>
                </form>
              )}
            </section>

            <section className="rounded-lg border border-neutral-200">
              <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-2">
                <h3 className="text-sm font-semibold text-neutral-900">Decisions</h3>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600">{decisions.length} decisions</span>
              </div>
              <ul className="divide-y divide-neutral-100">
                {decisions.slice(0, 5).map((decision, index) => {
                  const parsedDecision = parseDecisionItem(decision)
                  return (
                    <li key={`${decision}-${index}`} className="px-4 py-3">
                      <p className="text-sm leading-5 text-neutral-800">{parsedDecision.decision}</p>
                      <p className="mt-1 text-xs font-medium text-neutral-500">Decided by: {parsedDecision.owner}</p>
                      {primarySession && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs font-semibold text-blue-700">Edit decision</summary>
                          <form action={updateCampusDecisionItem} className="mt-2 grid gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                            <input type="hidden" name="session_id" value={primarySession.id} />
                            <input type="hidden" name="decision_index" value={String(index)} />
                            <input type="hidden" name="return_path" value={returnPath} />
                            <textarea
                              name="decision_item"
                              rows={3}
                              defaultValue={parsedDecision.decision}
                              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                            />
                            <input
                              name="decision_owner"
                              defaultValue={parsedDecision.owner}
                              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                            />
                            <button type="submit" className="rounded-lg bg-blue-900 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800">
                              Save decision
                            </button>
                          </form>
                        </details>
                      )}
                    </li>
                  )
                })}
                {decisions.length === 0 && (
                  <li className="px-4 py-8 text-center text-sm text-neutral-500">No decisions captured yet.</li>
                )}
              </ul>
              {primarySession && (
                <form action={addCampusDecisionItem} className="grid gap-3 border-t border-neutral-200 p-4">
                  <input type="hidden" name="session_id" value={primarySession.id} />
                  <input type="hidden" name="return_path" value={returnPath} />
                  <textarea
                    name="decision_item"
                    rows={3}
                    required
                    placeholder="Add one decision point"
                    className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  />
                  <input
                    name="decision_owner"
                    required
                    placeholder="Who decided"
                    className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  />
                  <button type="submit" className="rounded-lg bg-blue-900 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800">
                    Add decision
                  </button>
                </form>
              )}
            </section>
          </div>
        </aside>
      </div>
    </div>
  )
}
