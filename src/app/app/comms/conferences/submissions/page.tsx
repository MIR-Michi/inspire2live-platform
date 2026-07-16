import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { isPlatformAdmin, normalizeRole } from '@/lib/role-access'
import { GuestSubmissionsShell } from '@/app/app/admin/guest-submissions/guest-submissions-shell'
import {
  AccessRequestsPanel,
  type GuestAccessRequestView,
} from '@/app/app/admin/guest-submissions/access-requests-panel'

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
  const db = supabase as any
  const [{ data: submissions }, { data: rawAccessRequests }] = await Promise.all([
    db
      .from('conference_guest_submissions')
      .select(`
        id, submitter_name, submitter_email, submitter_phone, submitter_organisation,
        conference_name, conference_start_date, conference_location, role_at_conference,
        notes, status, review_notes, created_at,
        conference_guest_tokens!inner(contact_name, contact_email)
      `)
      .order('created_at', { ascending: false })
      .limit(200),
    db
      .from('conference_guest_access_requests')
      .select(`
        id, contact_name, contact_email, message, status, requested_role,
        response_message, created_at, reviewed_at,
        conference_guest_submissions(conference_name, submitter_name, submitter_email)
      `)
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const accessRequests: GuestAccessRequestView[] = (rawAccessRequests ?? []).map((row: Record<string, unknown>) => {
    const relation = row.conference_guest_submissions
    const submission = Array.isArray(relation)
      ? relation[0] as Record<string, unknown> | undefined
      : relation as Record<string, unknown> | null
    const rawStatus = String(row.status ?? 'pending')
    const status: GuestAccessRequestView['status'] = ['pending', 'granted', 'declined'].includes(rawStatus)
      ? rawStatus as GuestAccessRequestView['status']
      : 'pending'

    return {
      id: String(row.id),
      contactName: String(row.contact_name ?? submission?.submitter_name ?? 'Conference guest'),
      contactEmail: (row.contact_email as string | null) ?? (submission?.submitter_email as string | null) ?? null,
      conferenceName: String(submission?.conference_name ?? 'Conference'),
      message: (row.message as string | null) ?? null,
      status,
      requestedRole: String(row.requested_role ?? 'PatientAdvocate'),
      responseMessage: (row.response_message as string | null) ?? null,
      createdAt: String(row.created_at),
      reviewedAt: (row.reviewed_at as string | null) ?? null,
    }
  })

  return (
    <div className="space-y-10">
      <AccessRequestsPanel
        requests={accessRequests}
        canManage={isPlatformAdmin(normalizeRole(profile?.role))}
      />
      <GuestSubmissionsShell submissions={submissions ?? []} />
    </div>
  )
}
