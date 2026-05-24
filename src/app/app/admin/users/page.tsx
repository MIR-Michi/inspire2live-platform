import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EditRoleButton, InviteUserButton, AssignCongressRolesButton } from '@/components/ui/client-buttons'
import { fetchLatestWorkspaceEvent } from '@/lib/congress-workspace/current-event'
import { getRoleLabel, getRoleBadgeColor } from '@/lib/role-access'
import { assignUserWorkspace } from './actions'
import { getUserWorkspaceLabel, normalizeUserType, type UserType } from '@/lib/user-workspace'

const WORKSPACE_OPTIONS: Array<{ value: UserType; label: string }> = [
  { value: 'default', label: 'Default' },
  { value: 'comms', label: 'Comms' },
  { value: 'board', label: 'Board' },
  { value: 'partner', label: 'Partner' },
]

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

  const { data: dbUsersWithUserType, error: dbUsersWithUserTypeError } = await supabase
    .from('profiles')
    .select('id, name, email, role, country, onboarding_completed, updated_at, user_type, comms_team')
    .order('name')
  let dbUsers = dbUsersWithUserType
  if (dbUsersWithUserTypeError) {
    const { data: fallbackUsers } = await supabase
      .from('profiles')
      .select('id, name, email, role, country, onboarding_completed, updated_at, comms_team')
      .order('name')
    dbUsers = (fallbackUsers ?? []).map((userRow) => ({ ...userRow, user_type: userRow.comms_team ? 'comms' : 'default' }))
  }
  const { event: latestCongress } = await fetchLatestWorkspaceEvent(supabase)

  const users = (dbUsers ?? []).length > 0
    ? dbUsers!.map(u => ({
        id: u.id,
        name: u.name ?? 'Unnamed',
        email: u.email ?? '',
        role: u.role,
        country: u.country ?? '',
        last_active: u.updated_at,
        status: 'active' as const,
        onboarding_completed: u.onboarding_completed,
        user_type: normalizeUserType(u.user_type),
        comms_team: u.comms_team,
      }))
    : []

  const totalActive = users.filter(u => u.status === 'active').length

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">User Management</h1>
          <p className="text-sm text-neutral-500">{users.length} users · {totalActive} active</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/app/admin/permissions"
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            Permissions
          </a>
          <InviteUserButton />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Workspace</th>
              <th className="px-4 py-3 text-left">Country</th>
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
                <td className="px-4 py-3">
                  <form action={assignUserWorkspace} className="flex items-center gap-2">
                    <input type="hidden" name="user_id" value={u.id} />
                    <select
                      name="user_type"
                      defaultValue={u.user_type}
                      aria-label={`Workspace for ${u.name}`}
                      className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-700"
                    >
                      {WORKSPACE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="rounded-lg border border-neutral-200 px-2 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50">
                      Save
                    </button>
                  </form>
                  <p className="mt-1 text-[11px] text-neutral-400">{getUserWorkspaceLabel(u)}</p>
                </td>
                <td className="px-4 py-3 text-neutral-600">{u.country}</td>
                <td className="px-4 py-3">
                  {u.onboarding_completed
                    ? <span className="text-emerald-600">✓ Done</span>
                    : <span className="text-amber-600">Pending</span>
                  }
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <AssignCongressRolesButton
                      userName={u.name}
                      userId={u.id}
                      congressId={latestCongress?.id ?? null}
                      congressTitle={latestCongress?.title}
                    />
                    <EditRoleButton userName={u.name} userId={u.id} currentRole={u.role} />
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
