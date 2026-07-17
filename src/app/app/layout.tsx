import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { TopNav, type PreviewUserOption } from '@/components/layouts/top-nav'
import { SideNav } from '@/components/layouts/side-nav'
import { canAccessAppPath, normalizeRole, getRoleLabel, isPlatformAdmin, isSuperadmin } from '@/lib/role-access'
import { canAccess, resolveAllSpaces } from '@/lib/permissions'
import { countCurrentCampusIncoming } from '@/lib/campus-metrics'
import { getViewAsRole, getViewAsUserId } from '@/lib/view-as'
import { RoleLayersProvider } from '@/components/roles/role-layers-context'
import { TestModeProvider, FeedbackOverlay } from '@/modules/feedback'
import { ActivityTracker } from '@/components/activity/activity-tracker'
import { resolveDashboardDesignConfig } from '@/kernel/dashboard'
import { DesignSystemProvider } from '@/kernel/ui/design-system-context'
import { TaskCelebrationHost } from '@/kernel/ui/task-celebration-host'

function getInitials(name: string): string {
  return name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()
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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, email, role, onboarding_completed, avatar_url')
    .eq('id', user.id)
    .maybeSingle()
  if (profile && !profile.onboarding_completed) redirect('/onboarding')

  const actualProfile = profile as ProfileShell | null
  const actualRole = normalizeRole(actualProfile?.role)
  const isAdmin = isPlatformAdmin(actualRole)
  const canPreview = isSuperadmin(actualRole)

  const [viewAsRoleCookie, viewAsUserId] = canPreview
    ? await Promise.all([getViewAsRole(), getViewAsUserId()])
    : [null, null]

  let viewAsUser: ProfileShell | null = null
  let previewUsers: PreviewUserOption[] = []
  if (canPreview) {
    const [viewAsUserResult, previewUsersResult] = await Promise.all([
      viewAsUserId
        ? supabase.from('profiles').select('id, name, email, role, onboarding_completed, avatar_url').eq('id', viewAsUserId).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('profiles').select('id, name, email, role').order('name'),
    ])
    viewAsUser = (viewAsUserResult.data as ProfileShell | null) ?? null
    previewUsers = (previewUsersResult.data ?? []).map((row) => ({
      id: row.id,
      name: row.name ?? 'Unnamed user',
      email: row.email ?? '',
      role: row.role ?? 'PatientAdvocate',
    }))
  }

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
  if (!canAccessAppPath(actualRole, '/app/dashboard')) redirect('/app/profile')

  const effectiveSpaces = await resolveAllSpaces(effectiveUserId, effectiveRole, supabase)
  const workspaceLabel = getRoleLabel(effectiveRole)
  const canViewComms = isAdmin || canAccess(effectiveSpaces.comms, 'view')
  const [commsUnreadCount, designConfig] = await Promise.all([
    canViewComms ? countCurrentCampusIncoming(supabase) : Promise.resolve(0),
    resolveDashboardDesignConfig(supabase as unknown as SupabaseClient),
  ])

  return (
    <RoleLayersProvider platformRole={effectiveRole}>
      <DesignSystemProvider config={designConfig}>
        <TestModeProvider>
          <div className="flex h-dvh min-h-0 w-full max-w-full flex-col overflow-hidden overscroll-none bg-neutral-50">
            <TopNav
              userName={name}
              userRole={effectiveRole}
              userInitials={getInitials(name)}
              userAvatarUrl={effectiveProfile?.avatar_url ?? null}
              unreadCount={unread ?? 0}
              isAdmin={isAdmin}
              canPreview={canPreview}
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
            <div className="flex min-h-0 min-w-0 flex-1">
              <SideNav
                role={effectiveRole}
                effectiveSpaces={effectiveSpaces}
                isAdmin={isAdmin}
                commsUnreadCount={commsUnreadCount ?? 0}
                workspaceLabel={workspaceLabel}
              />
              <main className="min-w-0 flex-1 overflow-y-auto overscroll-contain bg-neutral-50 px-3 py-4 md:p-6" role="main" aria-label="Page content">
                {children}
              </main>
            </div>
          </div>
          <TaskCelebrationHost />
          <FeedbackOverlay />
          <ActivityTracker />
        </TestModeProvider>
      </DesignSystemProvider>
    </RoleLayersProvider>
  )
}
