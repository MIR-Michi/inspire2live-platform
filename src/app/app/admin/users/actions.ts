'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { normalizeUserType } from '@/lib/user-workspace'

export async function assignUserWorkspace(formData: FormData) {
  const targetUserId = String(formData.get('user_id') ?? '')
  const nextUserType = normalizeUserType(String(formData.get('user_type') ?? 'default'))

  if (!targetUserId) throw new Error('User id is required.')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) throw new Error(profileError.message)
  if (profile?.role !== 'PlatformAdmin') throw new Error('Only PlatformAdmin users can assign workspaces.')

  const { error } = await supabase
    .from('profiles')
    .update({ user_type: nextUserType, comms_team: nextUserType === 'comms' })
    .eq('id', targetUserId)

  if (error) {
    const { error: fallbackError } = await supabase
      .from('profiles')
      .update({ comms_team: nextUserType === 'comms' })
      .eq('id', targetUserId)
    if (fallbackError) throw new Error(fallbackError.message)
  }

  revalidatePath('/app/admin/users')
}
