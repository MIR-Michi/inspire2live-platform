import { createClient } from '@/lib/supabase/server'
import { ContentCalendarShell } from '@/components/comms/content-calendar-shell'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { getIntegrationStubFlags } from '@/lib/comms-integrations'
import type { CalendarStatus } from '@/lib/comms-workflow'

const VALID_VIEWS = new Set(['month', 'list', 'drafts', 'my_items'])
const VALID_STATUSES = new Set<CalendarStatus>(['draft', 'in_review', 'scheduled', 'published', 'archived'])

export default async function CommsPlannerPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string; status?: string }>
}) {
  const params = (await searchParams) ?? {}
  const view = VALID_VIEWS.has(params.view ?? '') ? (params.view as 'month' | 'list' | 'drafts' | 'my_items') : 'month'
  const statusFilter =
    params.status === 'all' || !params.status
      ? 'all'
      : VALID_STATUSES.has(params.status as CalendarStatus)
        ? (params.status as CalendarStatus)
        : 'all'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: entriesData }, { data: authorsData }, { data: currentProfile }] = await Promise.all([
    supabase
      .from('content_calendar')
      .select('id, title, channels, status, scheduled_at, published_at, body_draft, author_id, source_intake_id, source_link, attached_media_refs, tags, created_at')
      .order('scheduled_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('id, name, email, role')
      .order('name'),
    user
      ? supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const authors = ((authorsData ?? []) as Array<{
    id: string
    name: string | null
    email: string
    role: string
  }>)
    .filter((author) => canAccessCommsWorkspace(author.role))
    .map((author) => ({
      id: author.id,
      name: author.name ?? author.email,
      email: author.email,
    }))

  return (
    <ContentCalendarShell
      entries={(entriesData ?? []) as Array<{
        id: string
        title: string
        channels: string[]
        status: string
        scheduled_at: string | null
        published_at: string | null
        body_draft: string | null
        author_id: string | null
        source_intake_id: string | null
        source_link?: string | null
        attached_media_refs?: string[] | null
        tags: string[] | null
        created_at: string
      }>}
      authors={authors}
      view={view}
      statusFilter={statusFilter}
      currentUserId={user?.id ?? null}
      basePath="/app/comms/planner"
      canUseWordpressStub={currentProfile?.role === 'PlatformAdmin'}
      stubFlags={getIntegrationStubFlags()}
    />
  )
}
