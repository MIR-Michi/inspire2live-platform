'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { FeedbackType } from '@/lib/feedback'

export async function createFeedbackItem(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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
