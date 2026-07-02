import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EditRoleButton, InviteUserButton, UserStatusButton, DeleteUserButton, PurgeDemoUsersButton, ResendInviteButton } from '@/components/ui/client-buttons'
import { DEMO_EMAILS } from '@/app/app/admin/users/constants'
import { getRoleLabel, getRoleBadgeColor } from '@/lib/role-access'

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'PlatformAdmin') {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-neutral-900">Access Denied</p>
          <p className="text-sm text-neutral-500">Only PlatformAdmin users can access this page.</p>
        </div>
      </div>
    )
  }

  const { data: dbUsersWithStatus, error: statusColError } = await supabase
    .from('profiles')
    .select('id, name, email, role, country, onboarding_completed, status, updated_at')
    .order('name')

  // Fall back gracefully when migration 00053 hasn't been applied yet —
  // PostgREST returns an error if the status column doesn't exist.
  let dbUsers: Array<{
    id: string; name: string; email: string; role: string;
    country: string; onboarding_completed: boolean; status: string | null; updated_at: string
  }> | null = dbUsersWithStatus

  if (statusColError) {
    const { data: fallback } = await supabase
      .from('profiles')
      .select('id, name, email, role, country, onboarding_completed, updated_at')
      .order('name')
    dbUsers = (fallback ?? []).map(u => ({ ...u, status: 'active' }))
  }

  const users = (dbUsers ?? []).map(u => ({
    id: u.id,
    name: u.name ?? 'Unnamed',
    email: u.email ?? '',
    role: u.role,
    country: u.country ?? '',
    last_active: u.updated_at,
    status: (u.status === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
    onboarding_completed: u.onboarding_completed,
  }))

  const totalActive = users.filter(u => u.status === 'active').length
  const demoUsers = users
    .filter(u => (DEMO_EMAILS as readonly string[]).includes(u.email.toLowerCase()))
    .map(u => ({ id: u.id, name: u.name, email: u.email }))

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">User Management</h1>
          <p className="text-sm text-neutral-500">{users.length} users · {totalActive} active</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/app/admin/ai"
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            AI Settings
          </a>
          <a
            href="/app/admin/org-feed"
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Org Feed
          </a>
          <a
            href="/app/admin/permissions"
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            Permissions
          </a>
          <PurgeDemoUsersButton demoUsers={demoUsers} />
          <InviteUserButton />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Country</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Onboarding</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-600">
                      {u.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-medium text-neutral-900">{u.name}</p>
                      <p className="text-xs text-neutral-500">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getRoleBadgeColor(u.role)}`}>
                    {getRoleLabel(u.role)}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-600">{u.country}</td>
                <td className="px-4 py-3">
                  {u.status === 'active'
                    ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Active</span>
                    : <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">Inactive</span>
                  }
                </td>
                <td className="px-4 py-3">
                  {u.onboarding_completed
                    ? <span className="text-emerald-600">✓ Done</span>
                    : <span className="text-amber-600">Pending</span>
                  }
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <EditRoleButton userName={u.name} userId={u.id} currentRole={u.role} />
                    {!u.onboarding_completed && (
                      <ResendInviteButton userId={u.id} userName={u.name} email={u.email} />
                    )}
                    <UserStatusButton userId={u.id} userName={u.name} status={u.status} isSelf={u.id === user.id} />
                    <DeleteUserButton userId={u.id} userName={u.name} isSelf={u.id === user.id} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
