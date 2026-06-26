import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isAiEnabled } from '@/lib/ai/feature-flag'
import { DEFAULT_ORG_FEED_CONFIG, ORG_FEED_CADENCES } from '@/lib/ai/org-feed-config'
import { saveOrgFeedConfig, runNewsfeedNow } from './actions'

type SearchParams = { status?: string; message?: string; inserted?: string; generated?: string }

type OrgFeedConfigRow = {
  topics: string[] | null
  themes: string[] | null
  allowed_sources: string[] | null
  blocked_sources: string[] | null
  region: string | null
  cadence: string | null
  enabled: boolean | null
  updated_at: string | null
}

export const metadata = { title: 'Org News Feed · Admin' }

export default async function AdminOrgFeedPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'PlatformAdmin') redirect('/app/dashboard')

  const db = createAdminClient() as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: boolean) => { maybeSingle: () => Promise<{ data: OrgFeedConfigRow | null }> }
        order?: (column: string, opts: { ascending: boolean }) => Promise<{ data: unknown[] | null }>
      }
    }
  }

  const { data: config } = await db
    .from('org_feed_config')
    .select('topics, themes, allowed_sources, blocked_sources, region, cadence, enabled, updated_at')
    .eq('singleton', true)
    .maybeSingle()

  const itemCountRes = await (createAdminClient() as unknown as {
    from: (table: string) => { select: (columns: string, opts: { count: 'exact'; head: true }) => Promise<{ count: number | null }> }
  })
    .from('news_feed_items')
    .select('id', { count: 'exact', head: true })

  const c = config ?? {
    topics: DEFAULT_ORG_FEED_CONFIG.topics,
    themes: DEFAULT_ORG_FEED_CONFIG.themes,
    allowed_sources: DEFAULT_ORG_FEED_CONFIG.allowedSources,
    blocked_sources: DEFAULT_ORG_FEED_CONFIG.blockedSources,
    region: DEFAULT_ORG_FEED_CONFIG.region,
    cadence: DEFAULT_ORG_FEED_CONFIG.cadence,
    enabled: DEFAULT_ORG_FEED_CONFIG.enabled,
    updated_at: null,
  }

  const lines = (list: string[] | null) => (list ?? []).join('\n')

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Organization news feed</h1>
          <p className="text-sm text-neutral-500">
            Configure what the org-wide Field Newsfeed monitors. A scheduled job uses web search to populate it with citation-backed items for all stakeholders.
          </p>
        </div>
        <a href="/app/admin/ai" className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
          ← AI Settings
        </a>
      </div>

      <StatusBanner params={params} />

      {!isAiEnabled() && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          AI features are disabled. You can edit the config, but the feed will not generate until <code>NEXT_PUBLIC_FEATURE_AI</code> is enabled.
        </div>
      )}

      <form className="space-y-5 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-neutral-700">Topics</span>
            <textarea name="topics" rows={4} defaultValue={lines(c.topics)} placeholder="One per line, e.g. precision oncology" className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            <span className="block text-xs text-neutral-500">One topic per line (or comma-separated).</span>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-neutral-700">Themes</span>
            <textarea name="themes" rows={4} defaultValue={lines(c.themes)} placeholder="One per line, e.g. patient advocacy" className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            <span className="block text-xs text-neutral-500">Broader editorial themes I2L cares about.</span>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-neutral-700">Allowed source domains</span>
            <textarea name="allowed_sources" rows={3} defaultValue={lines(c.allowed_sources)} placeholder="nature.com&#10;who.int" className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            <span className="block text-xs text-neutral-500">Optional. Bare domains; the search prefers these.</span>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-neutral-700">Blocked source domains</span>
            <textarea name="blocked_sources" rows={3} defaultValue={lines(c.blocked_sources)} placeholder="example-tabloid.com" className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            <span className="block text-xs text-neutral-500">Optional. These domains are never used.</span>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-neutral-700">Region focus</span>
            <input name="region" type="text" defaultValue={c.region ?? ''} placeholder="global, Europe, Netherlands…" className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-neutral-700">Cadence</span>
            <select name="cadence" defaultValue={c.cadence ?? 'weekly'} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm">
              {ORG_FEED_CADENCES.map((cadence) => (
                <option key={cadence} value={cadence}>{cadence}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
          <input name="enabled" type="checkbox" defaultChecked={c.enabled ?? true} className="h-4 w-4 rounded border-neutral-300" />
          Feed enabled (the scheduled job will populate items)
        </label>

        <div className="flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-4">
          <button formAction={saveOrgFeedConfig} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
            Save config
          </button>
          <button formAction={runNewsfeedNow} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
            Run now
          </button>
          <span className="text-xs text-neutral-500">
            {itemCountRes.count ?? 0} item{itemCountRes.count === 1 ? '' : 's'} in the feed
            {c.updated_at ? ` · config updated ${new Date(c.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
          </span>
        </div>
      </form>
    </div>
  )
}

function StatusBanner({ params }: { params: SearchParams }) {
  if (!params.status) return null
  if (params.status === 'saved') {
    return <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">Org feed config saved.</div>
  }
  if (params.status === 'ran') {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
        Newsfeed job ran: {params.inserted ?? '0'} new item(s) added from {params.generated ?? '0'} found.
      </div>
    )
  }
  return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{params.message ?? 'Action failed.'}</div>
}
