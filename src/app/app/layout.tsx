import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopNav, type PreviewUserOption } from '@/components/layouts/top-nav'
import { SideNav } from '@/components/layouts/side-nav'
import { canAccessAppPath, normalizeRole, getRoleLabel } from '@/lib/role-access'
import { canAccess, resolveAllSpaces } from '@/lib/permissions'
import { getViewAsRole, getViewAsUserId } from '@/lib/view-as'
import { RoleLayersProvider } from '@/components/roles/role-layers-context'
import { TestModeProvider, FeedbackOverlay } from '@/modules/feedback'
import { ActivityTracker } from '@/components/activity/activity-tracker'

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

type ProfileShell = {
  id: string
  name: string | null
  email: string | null
  role: string | null
  onboarding_completed: boolean | null
  avatar_url: string | null
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, email, role, onboarding_completed, avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  if (profile && !profile.onboarding_completed) redirect('/onboarding')

  const actualProfile = profile as ProfileShell | null
  const actualRole = normalizeRole(actualProfile?.role)

  // NOTE: Do not mutate platform roles at request-time based on email.
  // Role is a DB-managed attribute (profiles.role) and must be updated only via
  // explicit admin actions / migrations.

  const isAdmin = actualRole === 'PlatformAdmin'

  const [viewAsRoleCookie, viewAsUserId] = isAdmin
    ? await Promise.all([getViewAsRole(), getViewAsUserId()])
    : [null, null]

  let viewAsUser: ProfileShell | null = null
  let previewUsers: PreviewUserOption[] = []

  if (isAdmin) {
    const [viewAsUserResult, previewUsersResult] = await Promise.all([
      viewAsUserId
        ? supabase
            .from('profiles')
            .select('id, name, email, role, onboarding_completed, avatar_url')
            .eq('id', viewAsUserId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('profiles')
        .select('id, name, email, role')
        .order('name'),
    ])

    viewAsUser = (viewAsUserResult.data as ProfileShell | null) ?? null
    previewUsers = (previewUsersResult.data ?? []).map((row) => ({
      id: row.id,
      name: row.name ?? 'Unnamed user',
      email: row.email ?? '',
      role: row.role ?? 'PatientAdvocate',
    }))
  }

  // Admin perspective switching: user preview wins over role preview so the
  // selected user's role + DB permission overrides are reflected together.
  const viewAsRole = viewAsUser ? null : viewAsRoleCookie
  const effectiveProfile = viewAsUser ?? actualProfile
  const effectiveUserId = effectiveProfile?.id ?? user.id
  const effectiveRole = viewAsUser ? normalizeRole(viewAsUser.role) : viewAsRole ?? actualRole

  const { count: unread } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', effectiveUserId)
    .eq('is_read', false)

  const name = effectiveProfile?.name || effectiveProfile?.email || user.email || 'Unknown'

  const currentAllowed = canAccessAppPath(actualRole, '/app/dashboard')
  if (!currentAllowed) {
    redirect('/app/profile')
  }

  // Resolve effective access levels for all spaces (one DB query).
  // Uses the previewed user when active, so DB overrides match the user being inspected.
  const effectiveSpaces = await resolveAllSpaces(effectiveUserId, effectiveRole, supabase)
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
      <TestModeProvider>
        <div className="flex h-screen flex-col overflow-hidden bg-neutral-50">
          <TopNav
            userName={name}
            userRole={effectiveRole}
            userInitials={getInitials(name)}
            userAvatarUrl={effectiveProfile?.avatar_url ?? null}
            unreadCount={unread ?? 0}
            isAdmin={isAdmin}
            viewAsRole={viewAsRole}
            viewAsUser={viewAsUser ? {
              id: viewAsUser.id,
              name: viewAsUser.name ?? 'Unnamed user',
              email: viewAsUser.email ?? '',
              role: viewAsUser.role ?? effectiveRole,
            } : null}
            previewUsers={previewUsers}
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
        <FeedbackOverlay />
        <ActivityTracker />
      </TestModeProvider>
    </RoleLayersProvider>
  )
}
