'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/kernel/data/admin'
import { createClient } from '@/kernel/data/server'
import type { FeedbackStatus, FeedbackType } from '@/modules/feedback/domain/types'

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'PlatformAdmin') return null
  return user
}

/** Any authenticated user can submit a contextual feedback item. */
export async function createFeedbackItem(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .maybeSingle()

  const feedbackType = (formData.get('feedback_type') as FeedbackType | null) ?? 'bug'
  const message = (formData.get('message') as string | null)?.trim()
  if (!message) return { error: 'Message is required' }

  const admin = createAdminClient()
  const { error } = await admin.from('feedback_items').insert({
    user_id: user.id,
    user_name: profile?.name ?? user.email ?? null,
    user_role: profile?.role ?? null,
    page_url: (formData.get('page_url') as string | null) ?? '',
    page_title: (formData.get('page_title') as string | null) || null,
    element_path: (formData.get('element_path') as string | null) || null,
    element_text: (formData.get('element_text') as string | null) || null,
    feedback_type: feedbackType,
    message,
    status: 'open',
  })

  if (error) return { error: error.message }
  return { ok: true }
}

/** Admin: change an item's status and admin note. */
export async function updateFeedbackStatus(formData: FormData) {
  const admin = requireAdmin()
  if (!(await admin)) return { error: 'Forbidden' }

  const id = formData.get('id') as string
  const status = formData.get('status') as FeedbackStatus
  const adminNote = (formData.get('admin_note') as string | null)?.trim() || null

  const db = createAdminClient()
  const { error } = await db.from('feedback_items').update({ status, admin_note: adminNote }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/app/admin/feedback')
  return { ok: true }
}

/** Admin: delete a feedback item. */
export async function deleteFeedbackItem(formData: FormData): Promise<void> {
  const admin = requireAdmin()
  if (!(await admin)) return

  const id = formData.get('id') as string
  const db = createAdminClient()
  await db.from('feedback_items').delete().eq('id', id)
  revalidatePath('/app/admin/feedback')
}
