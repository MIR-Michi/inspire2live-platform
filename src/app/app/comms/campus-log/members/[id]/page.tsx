import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CampusMemberSummaryCard } from '@/components/comms/campus-member-summary-card'
import { memberAppearsInCalendar, memberMatchesSignal } from '@/lib/comms-routing'
import { getIntakeTypeMeta } from '@/lib/comms-workflow'
import { createClient } from '@/lib/supabase/server'

function formatDate(value: string | null) {
  if (!value) return 'Not set'
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value))
}

export default async function CampusMemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: member } = await supabase
    .from('campus_members')
    .select(
      'id, name, country, organisation, role_description, date_welcomed, welcomed_by_peter, initiative_affiliations, notes, last_channel_activity'
    )
    .eq('id', id)
    .maybeSingle()
  if (!member) notFound()

  const [{ data: intakeItems }, { data: calendarEntries }, { data: initiatives }] = await Promise.all([
    supabase
      .from('intake_items')
      .select('id, sender_name, raw_content, content_type, captured_at, status, routed_to_type, routed_to_id')
      .order('captured_at', { ascending: false })
      .limit(200),
    supabase
      .from('content_calendar')
      .select('id, title, body_draft, tags, status, scheduled_at, source_intake_id')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('initiatives').select('id, title').order('title'),
  ])

  const initiativeMap = new Map((initiatives ?? []).map((initiative) => [initiative.id, initiative.title]))
  const relatedIntake = (intakeItems ?? []).filter((item) =>
    memberMatchesSignal(
      {
        id: member.id,
        name: member.name,
      },
      {
        sender_name: item.sender_name,
        raw_content: item.raw_content,
        routed_to_type: item.routed_to_type,
        routed_to_id: item.routed_to_id,
      }
    )
  )
  const relatedIntakeIds = new Set(relatedIntake.map((item) => item.id))
  const relatedCalendar = (calendarEntries ?? []).filter((entry) =>
    memberAppearsInCalendar(
      {
        id: member.id,
        name: member.name,
      },
      {
        title: entry.title,
        body_draft: entry.body_draft,
        tags: entry.tags,
        source_intake_id: entry.source_intake_id,
      },
      relatedIntakeIds
    )
  )

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/app/comms/campus-log?tab=members" className="inline-flex items-center gap-2 text-sm font-semibold text-orange-700 hover:text-orange-800">
        ← Back to campus members
      </Link>

      <CampusMemberSummaryCard
        id={member.id}
        name={member.name}
        country={member.country}
        organisation={member.organisation}
        role_description={member.role_description}
        date_welcomed={member.date_welcomed}
        last_channel_activity={member.last_channel_activity}
        welcomed_by_peter={member.welcomed_by_peter}
        initiative_affiliations={member.initiative_affiliations}
        notes={member.notes}
        initiativeMap={Object.fromEntries(initiativeMap)}
        initiatives={(initiatives ?? []).map((i) => ({ id: i.id, title: i.title }))}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900">Linked intake contributions</h2>
          <div className="mt-4 space-y-3">
            {relatedIntake.length === 0 ? (
              <p className="text-sm text-neutral-500">No linked intake items were found for this member yet.</p>
            ) : (
              relatedIntake.map((item) => {
                const meta = getIntakeTypeMeta(item.content_type)
                return (
                  <article key={item.id} className="rounded-xl border border-neutral-200 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] font-semibold text-neutral-700">
                        {meta.label}
                      </span>
                      <span className="text-xs text-neutral-500">{formatDate(item.captured_at)}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-neutral-900">{item.sender_name}</p>
                    <p className="mt-2 text-sm leading-6 text-neutral-600">{item.raw_content}</p>
                  </article>
                )
              })
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900">Content calendar appearances</h2>
          <div className="mt-4 space-y-3">
            {relatedCalendar.length === 0 ? (
              <p className="text-sm text-neutral-500">No content calendar appearances matched this member yet.</p>
            ) : (
              relatedCalendar.map((entry) => (
                <Link key={entry.id} href="/app/comms/calendar" className="block rounded-xl border border-neutral-200 p-4 hover:bg-neutral-50">
                  <p className="text-sm font-semibold text-neutral-900">{entry.title}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {entry.status} · {formatDate(entry.scheduled_at)}
                  </p>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
