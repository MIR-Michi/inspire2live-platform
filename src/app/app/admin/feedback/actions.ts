'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { FeedbackStatus } from '@/lib/feedback'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'PlatformAdmin') return null
  return user
}

export async function updateFeedbackStatus(formData: FormData) {
  const admin = requireAdmin()
  if (!await admin) return { error: 'Forbidden' }

  const id = formData.get('id') as string
  const status = formData.get('status') as FeedbackStatus
  const adminNote = (formData.get('admin_note') as string | null)?.trim() || null

  const db = createAdminClient()
  const { error } = await db.from('feedback_items').update({ status, admin_note: adminNote }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/app/admin/feedback')
  return { ok: true }
}

export async function deleteFeedbackItem(formData: FormData): Promise<void> {
  const admin = requireAdmin()
  if (!await admin) return

  const id = formData.get('id') as string
  const db = createAdminClient()
  await db.from('feedback_items').delete().eq('id', id)
  revalidatePath('/app/admin/feedback')
}
