import { redirect } from 'next/navigation'
import { isPlatformAdmin } from '@/lib/role-access'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isAiEnabled } from '@/lib/ai/feature-flag'
import { DEFAULT_ORG_FEED_CONFIG } from '@/lib/ai/org-feed-config'
import { getRunStatus } from '@/lib/ai/org-newsfeed-run'
import { OrgFeedWizard } from '@/components/admin/org-feed-wizard'

type OrgFeedConfigRow = {
  topics: string[] | null
  themes: string[] | null
  allowed_sources: string[] | null
  blocked_sources: string[] | null
  region: string | null
  cadence: string | null
  enabled: boolean | null
  watch_organization: boolean | null
  organization_aliases: string[] | null
  watch_crm_internal: boolean | null
  watch_people: string[] | null
  updated_at: string | null
}

export const metadata = { title: 'Org News Feed · Admin' }

// The "Run now" server action runs the web-search newsfeed job inline.
export const maxDuration = 300

export default async function AdminOrgFeedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!isPlatformAdmin(profile?.role)) redirect('/app/dashboard')

  const admin = createAdminClient() as unknown as {
    from: (table: string) => {
      select: {
        (columns: string): {
          eq: (column: string, value: boolean) => { maybeSingle: () => Promise<{ data: OrgFeedConfigRow | null }> }
        }
        (columns: string, opts: { count: 'exact'; head: true }): Promise<{ count: number | null }>
      }
    }
  }

  const [{ data: config }, { count }, runStatus] = await Promise.all([
    admin.from('org_feed_config').select('topics, themes, allowed_sources, blocked_sources, region, cadence, enabled, watch_organization, organization_aliases, watch_crm_internal, watch_people, updated_at').eq('singleton', true).maybeSingle(),
    admin.from('news_feed_items').select('id', { count: 'exact', head: true }),
    getRunStatus(createAdminClient()).catch(() => null),
  ])

  const initialConfig = {
    topics: config?.topics ?? DEFAULT_ORG_FEED_CONFIG.topics,
    themes: config?.themes ?? DEFAULT_ORG_FEED_CONFIG.themes,
    allowedSources: config?.allowed_sources ?? DEFAULT_ORG_FEED_CONFIG.allowedSources,
    blockedSources: config?.blocked_sources ?? DEFAULT_ORG_FEED_CONFIG.blockedSources,
    region: config?.region ?? null,
    cadence: config?.cadence ?? DEFAULT_ORG_FEED_CONFIG.cadence,
    enabled: config?.enabled ?? DEFAULT_ORG_FEED_CONFIG.enabled,
    watchOrganization: config?.watch_organization ?? DEFAULT_ORG_FEED_CONFIG.watchOrganization,
    organizationAliases: config?.organization_aliases ?? DEFAULT_ORG_FEED_CONFIG.organizationAliases,
    watchCrmInternal: config?.watch_crm_internal ?? DEFAULT_ORG_FEED_CONFIG.watchCrmInternal,
    watchPeople: config?.watch_people ?? DEFAULT_ORG_FEED_CONFIG.watchPeople,
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Organization news feed</h1>
          <p className="text-sm text-neutral-500">
            Set up what the org-wide Field Newsfeed monitors. A scheduled job uses web search to populate it with citation-backed items for all stakeholders.
          </p>
        </div>
        <a href="/app/admin/ai" className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
          ← AI Settings
        </a>
      </div>

      {!isAiEnabled() && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          AI features are disabled. You can set up the feed now, but it will not generate until <code>NEXT_PUBLIC_FEATURE_AI</code> is enabled.
        </div>
      )}

      <OrgFeedWizard
        initialConfig={initialConfig}
        isConfigured={Boolean(config)}
        itemCount={count ?? 0}
        lastUpdated={config?.updated_at ?? null}
        aiEnabled={isAiEnabled()}
        initialRunStatus={runStatus}
      />
    </div>
  )
}
