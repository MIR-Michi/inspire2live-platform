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
          {/* Now a section of the Platform Settings space (ADR-0010) — the old
              header-button hub to AI / Org Feed / Permissions is replaced by the
              settings sub-nav. */}
          <h1 className="text-2xl font-bold text-neutral-900">Users</h1>
          <p className="text-sm text-neutral-500">{users.length} users · {totalActive} active</p>
        </div>
        <div className="flex items-center gap-2">
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
