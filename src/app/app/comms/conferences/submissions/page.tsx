import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { GuestSubmissionsShell } from '@/app/app/admin/guest-submissions/guest-submissions-shell'

export const dynamic = 'force-dynamic'

export default async function ConferenceSubmissionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCommsWorkspace(profile?.role)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-neutral-900">Access denied</p>
          <p className="text-sm text-neutral-500">Only comms team members can access this page.</p>
        </div>
      </div>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: submissions } = await (supabase as any)
    .from('conference_guest_submissions')
    .select(`
      id, submitter_name, submitter_email, submitter_phone, submitter_organisation,
      conference_name, conference_start_date, conference_location, role_at_conference,
      notes, status, review_notes, created_at,
      conference_guest_tokens!inner(contact_name, contact_email)
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  return <GuestSubmissionsShell submissions={submissions ?? []} />
}
