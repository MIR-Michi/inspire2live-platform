'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isAiEnabled } from '@/lib/ai/feature-flag'
import { validateOrgFeedConfig } from '@/lib/ai/org-feed-config'
import { runOrgNewsfeedJob } from '@/lib/ai/org-newsfeed-job'

export interface OrgFeedActionState {
  ok: boolean
  message?: string
  error?: string
}

export type OrgFeedConfigInput = {
  topics: string[]
  themes: string[]
  allowedSources: string[]
  blockedSources: string[]
  region: string
  cadence: string
  enabled: boolean
}

async function requirePlatformAdmin(): Promise<{ id: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'PlatformAdmin') return null
  return { id: user.id }
}

export async function saveOrgFeedConfig(input: OrgFeedConfigInput): Promise<OrgFeedActionState> {
  try {
    const user = await requirePlatformAdmin()
    if (!user) return { ok: false, error: 'Only a Platform Admin can edit the feed.' }

    // Reuse the shared validator (domain normalization + guardrails) by feeding
    // it newline-joined lists, the same shape the textarea form produced.
    const validation = validateOrgFeedConfig({
      topics: input.topics.join('\n'),
      themes: input.themes.join('\n'),
      allowedSources: input.allowedSources.join('\n'),
      blockedSources: input.blockedSources.join('\n'),
      region: input.region,
      cadence: input.cadence,
      enabled: input.enabled,
    })
    if (!validation.ok) return { ok: false, error: validation.errors.join(' ') }

    const db = createAdminClient() as unknown as {
      from: (table: string) => {
        upsert: (payload: Record<string, unknown>, options: { onConflict: string }) => Promise<{ error: { message: string } | null }>
      }
    }

    const { error } = await db.from('org_feed_config').upsert(
      {
        singleton: true,
        topics: validation.config.topics,
        themes: validation.config.themes,
        allowed_sources: validation.config.allowedSources,
        blocked_sources: validation.config.blockedSources,
        region: validation.config.region,
        cadence: validation.config.cadence,
        enabled: validation.config.enabled,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'singleton' }
    )
    if (error) return { ok: false, error: error.message }

    revalidatePath('/app/admin/org-feed')
    revalidatePath('/app/comms/dashboard')
    return { ok: true, message: 'Feed configuration saved.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not save the configuration.' }
  }
}

export async function runNewsfeedNow(): Promise<OrgFeedActionState> {
  try {
    const user = await requirePlatformAdmin()
    if (!user) return { ok: false, error: 'Only a Platform Admin can run the feed.' }
    if (!isAiEnabled()) return { ok: false, error: 'AI features are disabled for this environment.' }

    const result = await runOrgNewsfeedJob(createAdminClient(), { createdBy: user.id, force: true })
    revalidatePath('/app/admin/org-feed')
    revalidatePath('/app/comms/dashboard')
    revalidatePath('/app/dashboard')
    if (result.skipped === 'no_config') return { ok: false, error: 'Save a config before running.' }
    return {
      ok: true,
      message: result.inserted > 0
        ? `Added ${result.inserted} new item${result.inserted === 1 ? '' : 's'} (from ${result.generated} found).`
        : 'Ran successfully — no new items found this time.',
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message.slice(0, 200) : 'Run failed.' }
  }
}
