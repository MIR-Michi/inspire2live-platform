'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isAiEnabled } from '@/lib/ai/feature-flag'
import { runOrgNewsfeedJob } from '@/lib/ai/org-newsfeed-job'

export interface NewsfeedActionState {
  ok: boolean
  message?: string
  error?: string
}

const INITIAL_STATE: NewsfeedActionState = { ok: false }

/**
 * Run the org news-feed job from the comms dashboard card. Admin-only;
 * returns a status (no redirect) so the card can show inline feedback.
 */
export async function refreshOrgNewsfeed(
  _prevState: NewsfeedActionState = INITIAL_STATE,
): Promise<NewsfeedActionState> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Not authenticated.' }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'PlatformAdmin') return { ok: false, error: 'Only a Platform Admin can refresh the feed.' }

    if (!isAiEnabled()) return { ok: false, error: 'AI features are disabled for this environment.' }

    const result = await runOrgNewsfeedJob(createAdminClient(), { createdBy: user.id, force: true })
    if (result.skipped === 'no_config') return { ok: false, error: 'Configure the feed before refreshing.' }

    revalidatePath('/app/comms/dashboard')
    revalidatePath('/app/dashboard')
    return { ok: true, message: result.inserted > 0 ? `Added ${result.inserted} new item${result.inserted === 1 ? '' : 's'}.` : 'No new items found.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not refresh the feed.' }
  }
}
