import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopNav } from '@/components/layouts/top-nav'
import { SideNav } from '@/components/layouts/side-nav'
import { canAccessAppPath, normalizeRole, getRoleLabel } from '@/lib/role-access'
import { canAccess, resolveAllSpaces } from '@/lib/permissions'
import { getViewAsRole } from '@/lib/view-as'
import { RoleLayersProvider } from '@/components/roles/role-layers-context'

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role, onboarding_completed')
    .eq('id', user.id)
    .maybeSingle()

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
  const workspaceLabel = getRoleLabel(effectiveRole)

  // Campus badge: show whenever the user can see the comms space (admins always can).
  const canViewComms = isAdmin || canAccess(effectiveSpaces.comms, 'view')

  const now = new Date()
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
  const { count: commsUnreadCount } = canViewComms
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
        <TopNav
          userName={name}
          userRole={effectiveRole}
          userInitials={getInitials(name)}
          unreadCount={unread ?? 0}
          isAdmin={isAdmin}
          viewAsRole={viewAsRole}
          effectiveSpaces={effectiveSpaces}
        />
        <div className="flex min-h-0 flex-1">
          <SideNav
            role={effectiveRole}
            effectiveSpaces={effectiveSpaces}
            isAdmin={isAdmin}
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
