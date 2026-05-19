import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DEMO_NOTIFICATIONS } from '@/lib/demo-data'
import { markAllNotificationsRead, markNotificationRead, acceptInviteAction, declineInviteAction } from './actions'

const TYPE_ICON: Record<string, string> = {
  task_assigned: '📋',
  milestone_completed: '✅',
  discussion_reply: '💬',
  member_joined: '👤',
  initiative_update: '📊',
  invite_received: '✉️',
  media_recovery_offer: '🖼️',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch real notifications
  const { data: dbNotifs } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(40)

  // Fetch pending invitations for this user (shown as actionable cards)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pendingInvites } = await (supabase as any)
    .from('invitations')
    .select('id, scope, invitee_role, invited_at, message, initiative_id, initiatives(title), congress_id')
    .eq('invitee_user_id', user.id)
    .eq('status', 'invited')
    .order('invited_at', { ascending: false })
    .limit(10)

  const useDemo = !dbNotifs || dbNotifs.length === 0

  const notifications = useDemo
    ? DEMO_NOTIFICATIONS
      : dbNotifs!.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title ?? '',
        body: n.body ?? '',
        is_read: n.is_read,
        created_at: n.created_at,
        link: (n as unknown as { link_url?: string; link?: string }).link_url ?? (n as unknown as { link?: string }).link ?? null,
        invitation_id: null as string | null,
      }))

  const invites = (pendingInvites ?? []) as Array<{
    id: string
    scope: string
    invitee_role: string
    invited_at: string
    message: string | null
    initiative_id?: string | null
    initiatives?: { title?: string | null } | null
  }>

  const unread = notifications.filter(n => !n.is_read).length

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Notifications</h1>
          <p className="text-sm text-neutral-500">{unread} unread</p>
        </div>
        <form action={markAllNotificationsRead}>
          <button
            type="submit"
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
          >
            Mark all read
          </button>
        </form>
      </div>

      {/* ── Pending invitations (actionable) ── */}
      {invites.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Pending invitations ({invites.length})
          </p>
          {invites.map(inv => (
            <div key={inv.id} className="rounded-xl border border-orange-200 bg-orange-50 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-lg">✉️</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-neutral-900">
                    {inv.scope === 'initiative' ? (
                      <>
                        Invitation to join initiative{' '}
                        <span className="font-bold">{inv.initiatives?.title ?? 'Untitled initiative'}</span> as{' '}
                        <span className="capitalize">{inv.invitee_role}</span>
                      </>
                    ) : (
                      <>
                        Invitation to join a {inv.scope} as{' '}
                        <span className="capitalize">{inv.invitee_role}</span>
                      </>
                    )}
                  </p>
                  {inv.message && (
                    <p className="mt-1 text-xs italic text-neutral-600">&ldquo;{inv.message}&rdquo;</p>
                  )}
                  <p className="mt-1 text-xs text-neutral-400">{timeAgo(inv.invited_at)}</p>
                  {/* Accept / Decline */}
                  <div className="mt-3 flex items-center gap-2">
                    <form action={acceptInviteAction}>
                      <input type="hidden" name="invitationId" value={inv.id} />
                      <button
                        type="submit"
                        className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700"
                      >
                        Accept
                      </button>
                    </form>
                    <form action={declineInviteAction}>
                      <input type="hidden" name="invitationId" value={inv.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
                      >
                        Decline
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ── Notifications list ── */}
      <div className="space-y-2">
        {notifications.map(n => (
          <div
            key={n.id}
            className={`flex items-start gap-3 rounded-xl border p-4 shadow-sm transition-colors
              ${n.is_read ? 'border-neutral-200 bg-white' : 'border-orange-200 bg-orange-50'}`}
          >
            <span className="mt-0.5 text-lg">{TYPE_ICON[n.type] ?? '🔔'}</span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${n.is_read ? 'text-neutral-700' : 'font-semibold text-neutral-900'}`}>
                {String(n.title ?? '')}
              </p>
              <p className="mt-0.5 text-xs text-neutral-500">{String(n.body ?? '')}</p>
              <p className="mt-1 text-xs text-neutral-400">{timeAgo(n.created_at)}</p>
              {'link' in n && typeof n.link === 'string' && n.link && (
                <a href={n.link} className="mt-1 block text-xs text-orange-600 hover:underline">
                  View →
                </a>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              {!n.is_read && <span className="h-2 w-2 rounded-full bg-orange-500" />}
              {!n.is_read && !useDemo && (
                <form action={markNotificationRead.bind(null, n.id)}>
                  <button
                    type="submit"
                    className="text-xs text-neutral-400 hover:text-neutral-700"
                    title="Mark as read"
                  >
                    ✓
                  </button>
                </form>
              )}
            </div>
          </div>
        ))}

        {notifications.length === 0 && invites.length === 0 && (
          <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-8 text-center">
            <p className="text-sm font-semibold text-neutral-700">No notifications yet</p>
            <p className="mt-1 text-xs text-neutral-400">Activity from initiatives and congress will appear here.</p>
          </div>
        )}
      </div>
    </div>
  )
}
