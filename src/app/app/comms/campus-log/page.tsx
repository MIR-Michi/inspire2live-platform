import { CampusLogShell } from '@/components/comms/campus-log-shell'
import { createClient } from '@/lib/supabase/server'

const CAMPUS_SESSION_LIST_SELECT = 'id, session_date, theme, summary, participating_hub_ids'
const CAMPUS_MEMBER_LIST_SELECT =
  'id, name, country, organisation, role_description, date_welcomed, welcomed_by_peter, last_channel_activity'

export default async function CommsCampusLogPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>
}) {
  const params = (await searchParams) ?? {}
  const tab = params.tab === 'members' ? 'members' : 'sessions'

  const supabase = await createClient()
  const [{ data: sessions }, { data: members }, { data: hubs }, { data: initiatives }] = await Promise.all([
    supabase.from('campus_sessions').select(CAMPUS_SESSION_LIST_SELECT).order('session_date', { ascending: false }),
    supabase
      .from('campus_members')
      .select(CAMPUS_MEMBER_LIST_SELECT)
      .order('date_welcomed', { ascending: false })
      .order('name'),
    supabase.from('hubs').select('id, name').order('name'),
    supabase.from('initiatives').select('id, title').order('title'),
  ])

  const hubMap = new Map((hubs ?? []).map((hub) => [hub.id, hub.name]))

  return (
    <CampusLogShell
      tab={tab}
      sessions={((sessions ?? []) as Array<{
        id: string
        session_date: string
        theme: string | null
        summary: string | null
        participating_hub_ids: string[] | null
      }>).map((session) => ({
        ...session,
        participatingHubLabels: (session.participating_hub_ids ?? [])
          .map((hubId) => hubMap.get(hubId))
          .filter(Boolean) as string[],
      }))}
      members={(members ?? []) as Array<{
        id: string
        name: string
        country: string | null
        organisation: string | null
        role_description: string | null
        date_welcomed: string | null
        welcomed_by_peter: boolean
        last_channel_activity: string | null
      }>}
      hubs={(hubs ?? []).map((hub) => ({ id: hub.id, label: hub.name }))}
      initiatives={(initiatives ?? []).map((initiative) => ({ id: initiative.id, label: initiative.title }))}
    />
  )
}
