'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isAiEnabled } from '@/lib/ai/feature-flag'
import { validateOrgFeedConfig } from '@/lib/ai/org-feed-config'
import { runOrgNewsfeedJob } from '@/lib/ai/org-newsfeed-job'

async function requirePlatformAdmin(): Promise<{ id: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'PlatformAdmin') return null
  return { id: user.id }
}

function go(params: Record<string, string>): never {
  redirect(`/app/admin/org-feed?${new URLSearchParams(params).toString()}`)
}

export async function saveOrgFeedConfig(formData: FormData): Promise<void> {
  const user = await requirePlatformAdmin()
  if (!user) go({ status: 'error', message: 'Forbidden' })

  const validation = validateOrgFeedConfig({
    topics: String(formData.get('topics') ?? ''),
    themes: String(formData.get('themes') ?? ''),
    allowedSources: String(formData.get('allowed_sources') ?? ''),
    blockedSources: String(formData.get('blocked_sources') ?? ''),
    region: String(formData.get('region') ?? ''),
    cadence: String(formData.get('cadence') ?? ''),
    enabled: formData.get('enabled') === 'on',
  })

  if (!validation.ok) go({ status: 'error', message: validation.errors.join(' ').slice(0, 200) })

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
  if (error) go({ status: 'error', message: error.message })

  revalidatePath('/app/admin/org-feed')
  go({ status: 'saved' })
}

export async function runNewsfeedNow(): Promise<void> {
  const user = await requirePlatformAdmin()
  if (!user) go({ status: 'error', message: 'Forbidden' })
  if (!isAiEnabled()) go({ status: 'error', message: 'AI features are disabled for this environment.' })

  try {
    const supabase = createAdminClient()
    const result = await runOrgNewsfeedJob(supabase, { createdBy: user.id, force: true })
    revalidatePath('/app/admin/org-feed')
    revalidatePath('/app/dashboard')
    if (result.skipped === 'no_config') go({ status: 'error', message: 'Save a config before running.' })
    go({ status: 'ran', inserted: String(result.inserted), generated: String(result.generated) })
  } catch (error) {
    go({ status: 'error', message: error instanceof Error ? error.message.slice(0, 200) : 'Run failed.' })
  }
}
