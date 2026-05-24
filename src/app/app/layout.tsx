import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopNav } from '@/components/layouts/top-nav'
import { SideNav } from '@/components/layouts/side-nav'
import { canAccessAppPath, normalizeRole } from '@/lib/role-access'
import { resolveAllSpaces } from '@/lib/permissions'
import type { AccessLevel } from '@/lib/permissions'
import { getViewAsRole } from '@/lib/view-as'
import { switchPerspective } from './admin/view-as-action'
import { RoleLayersProvider } from '@/components/roles/role-layers-context'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { applyCanonicalCommsFallback, getUserWorkspaceLabel, isCommsUser } from '@/lib/user-workspace'

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profileWithUserType, error: profileWithUserTypeError } = await supabase
    .from('profiles')
    .select('name, role, onboarding_completed, comms_team, user_type')
    .eq('id', user.id)
    .maybeSingle()
  let profile = profileWithUserType

  if (profileWithUserTypeError) {
    const { data: fallbackProfile } = await supabase
      .from('profiles')
      .select('name, role, onboarding_completed, comms_team')
      .eq('id', user.id)
      .maybeSingle()
    profile = fallbackProfile ? { ...fallbackProfile, user_type: 'default' } : null
  }

  profile = applyCanonicalCommsFallback(profile, user.email)

  if (profile && !profile.onboarding_completed) redirect('/onboarding')

  const { count: unread } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  const name = profile?.name || user.email || 'Unknown'
  const actualRole = normalizeRole(profile?.role)

  // NOTE: Do not mutate platform roles at request-time based on email.
  // Role is a DB-managed attribute (profiles.role) and must be updated only via
  // explicit admin actions / migrations.

  const isAdmin = actualRole === 'PlatformAdmin'

  // Admin perspective switching: read cookie
  const viewAsRole = isAdmin ? await getViewAsRole() : null
  const effectiveRole = viewAsRole ?? actualRole

  const currentAllowed = canAccessAppPath(actualRole, '/app/dashboard')
  if (!currentAllowed) {
    redirect('/app/profile')
  }

  // Resolve effective access levels for all spaces (one DB query).
  // Uses effectiveRole (view-as aware) so preview mode reflects the target role's defaults,
  // but DB overrides are looked up by the actual user's id.
  const effectiveSpaces = await resolveAllSpaces(user.id, effectiveRole, supabase)
  const canUseCommsWorkspace = canAccessCommsWorkspace(actualRole, profile?.comms_team, profile?.user_type)
  const showCommsWorkspace = isCommsUser(profile)
  const workspaceLabel = getUserWorkspaceLabel(profile)
  const effectiveSpacesWithComms = canUseCommsWorkspace
    ? {
        ...effectiveSpaces,
        comms: (isAdmin ? 'manage' : 'edit') as AccessLevel,
      }
    : effectiveSpaces

  const now = new Date()
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
  const { count: commsUnreadCount } = showCommsWorkspace
    ? await supabase
        .from('intake_items')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'unreviewed')
        .gte('captured_at', currentMonthStart)
        .lt('captured_at', nextMonthStart)
    : { count: 0 }

  return (
    <RoleLayersProvider platformRole={effectiveRole}>
      <div className="flex h-screen flex-col overflow-hidden bg-neutral-50">
        {/* Admin preview banner */}
        {isAdmin && viewAsRole && viewAsRole !== 'PlatformAdmin' && (
          <div className="flex items-center justify-center gap-3 bg-amber-100 px-4 py-1.5 text-xs font-medium text-amber-800 border-b border-amber-200">
            <span>👁 Admin preview — viewing as <strong>{viewAsRole}</strong></span>
            <form action={switchPerspective}>
              <input type="hidden" name="role" value="PlatformAdmin" />
              <button
                type="submit"
                className="rounded bg-amber-700 px-2 py-0.5 text-xs font-medium text-white hover:bg-amber-800"
              >
                Exit preview
              </button>
            </form>
          </div>
        )}

        <TopNav
          userName={name}
          userRole={effectiveRole}
          userInitials={getInitials(name)}
          unreadCount={unread ?? 0}
          isAdmin={isAdmin}
          viewAsRole={viewAsRole}
          showCommsNav={showCommsWorkspace}
          workspaceLabel={workspaceLabel}
        />
        <div className="flex min-h-0 flex-1">
          <SideNav
            effectiveSpaces={effectiveSpacesWithComms}
            isAdmin={isAdmin}
            showCommsWorkspace={showCommsWorkspace}
            commsUnreadCount={commsUnreadCount ?? 0}
            workspaceLabel={workspaceLabel}
          />
          <main
            className="flex-1 overflow-y-auto px-3 py-4 md:p-6"
            role="main"
            aria-label="Page content"
          >
            {children}
          </main>
        </div>
      </div>
    </RoleLayersProvider>
  )
}
