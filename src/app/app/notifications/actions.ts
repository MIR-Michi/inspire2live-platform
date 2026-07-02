'use server'

/**
 * Notification server actions.
 * mark-read, mark-all-read, respond to invite (accept/decline).
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { respondToInvitation } from '@/lib/invitations'

export async function markNotificationRead(notificationId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', user.id)

  revalidatePath('/app/notifications')
}

export async function markAllNotificationsRead(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  revalidatePath('/app/notifications')
}

export interface InviteResponseResult {
  ok: boolean
  error?: string
}

/**
 * Accept an invitation — called from a server form action.
 * Reads invitationId from a hidden <input name="invitationId" />.
 */
export async function acceptInviteAction(formData: FormData): Promise<void> {
  const id = formData.get('invitationId') as string
  if (!id) return
  const supabase = await createClient()

  // Fetch invitation details BEFORE accepting.
  // Once accepted, RLS might no longer allow the invitee to read the invitation row.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inv } = await (supabase as any)
    .from('invitations')
    .select('scope, initiative_id, congress_id')
    .eq('id', id)
    .maybeSingle()

  const result = await respondToInvitation(supabase, id, 'accepted')
  if (!result.ok) {
    // Keep it simple for now: stay on notifications.
    // (We can add a toast/error state later if desired.)
    revalidatePath('/app/notifications')
    return
  }

  revalidatePath('/app/notifications')

  const scope = (inv as { scope?: string } | null)?.scope
  if (scope === 'initiative' && (inv as { initiative_id?: string } | null)?.initiative_id) {
    redirect(`/app/initiatives/${(inv as { initiative_id: string }).initiative_id}`)
  }
  if (scope === 'congress') {
    // Annual Congress space retired (Sprint 15) — land on the dashboard.
    redirect('/app/dashboard')
  }
}

/**
 * Decline an invitation — called from a server form action.
 */
export async function declineInviteAction(formData: FormData): Promise<void> {
  const id = formData.get('invitationId') as string
  if (!id) return
  const supabase = await createClient()
  await respondToInvitation(supabase, id, 'declined')
  revalidatePath('/app/notifications')
}
