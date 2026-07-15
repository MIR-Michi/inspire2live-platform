import { redirect } from 'next/navigation'
import { isPlatformAdmin } from '@/lib/role-access'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isAiEnabled } from '@/lib/ai/feature-flag'
import {
  AI_MODEL_CATALOG,
  AI_WORKLOAD_POLICIES,
  DEFAULT_AI_EFFORT,
  DEFAULT_AI_MODEL,
  getAiModelCatalogEntry,
  getAiWorkloadSelection,
  normalizeAiEffort,
  normalizeAiModel,
  normalizeAiWorkloadOverrides,
  type AiModelSelection,
  type AiWorkloadPolicy,
} from '@/lib/ai/models'
import { ResizableSplit } from '@/components/ui/resizable-split'
import { saveAiSettings, testAiSettingsConnection } from './actions'

type SearchParams = {
  status?: string
  message?: string
  model?: string
  source?: string
  latency?: string
}

type AiSettingsRow = {
  api_key_last4: string | null
  model: string | null
  effort: string | null
  model_overrides: unknown
  updated_at: string | null
  updated_by: string | null
}

export const metadata = { title: 'AI Settings · Admin' }

export default async function AdminAiSettingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!isPlatformAdmin(profile?.role)) redirect('/app/dashboard')

  const db = createAdminClient() as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: boolean) => { maybeSingle: () => Promise<{ data: AiSettingsRow | null }> }
      }
    }
  }

  const { data: settings } = await db
    .from('ai_settings')
    .select('api_key_last4, model, effort, model_overrides, updated_at, updated_by')
    .eq('singleton', true)
    .maybeSingle()

  const selectedModel = normalizeAiModel(settings?.model ?? DEFAULT_AI_MODEL)
  const selectedEffort = normalizeAiEffort(selectedModel, settings?.effort ?? DEFAULT_AI_EFFORT)
  const selectedEntry = getAiModelCatalogEntry(selectedModel) ?? AI_MODEL_CATALOG[0]
  const workloadOverrides = normalizeAiWorkloadOverrides(settings?.model_overrides)
  const globalSelection: AiModelSelection = { model: selectedModel, effort: selectedEffort }
  const envFallbackSet = Boolean(process.env.ANTHROPIC_API_KEY?.trim())
  const storedCredentialSet = Boolean(settings?.api_key_last4)

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">AI Settings</h1>
          <p className="text-sm text-neutral-500">
            Org-wide Claude configuration plus task-specific model routing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/app/admin/org-feed"
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Org News Feed →
          </a>
          <a
            href="/app/admin/users"
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            ← User Management
          </a>
        </div>
      </div>

      <StatusBanner params={params} />

      <ResizableSplit
        storageKey="admin-ai"
        defaultRatio={0.6}
        left={
        <form className="space-y-5 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Provider configuration</h2>
            <p className="mt-1 text-sm text-neutral-500">
              The stored credential is encrypted server-side and never rendered back to the browser.
            </p>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Feature flag</p>
                <p className={isAiEnabled() ? 'mt-1 font-medium text-emerald-700' : 'mt-1 font-medium text-amber-700'}>
                  {isAiEnabled() ? 'Enabled' : 'Disabled'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Stored credential</p>
                <p className="mt-1 font-medium text-neutral-900">
                  {storedCredentialSet ? `Set, ending ${settings?.api_key_last4}` : 'Not set'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Env fallback</p>
                <p className="mt-1 font-medium text-neutral-900">{envFallbackSet ? 'Available' : 'Not set'}</p>
              </div>
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-neutral-700">Anthropic credential</span>
            <input
              name="credential"
              type="password"
              autoComplete="off"
              placeholder={storedCredentialSet ? 'Leave blank to keep current credential' : 'Paste credential to store encrypted'}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
            <span className="block text-xs text-neutral-500">
              Write-only field. Use the checkbox below only when rotating back to the environment fallback.
            </span>
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-neutral-600">
            <input name="clearCredential" type="checkbox" className="h-4 w-4 rounded border-neutral-300" />
            Clear stored credential and use ANTHROPIC_API_KEY fallback if present
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-neutral-700">Default model</span>
              <select
                name="model"
                defaultValue={selectedModel}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              >
                {AI_MODEL_CATALOG.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.label}</option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-neutral-700">Default reasoning effort</span>
              <select
                name="effort"
                defaultValue={selectedEffort}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              >
                {selectedEntry.allowedEfforts.map((effort) => (
                  <option key={effort} value={effort}>{effort}</option>
                ))}
              </select>
              <span className="block text-xs text-neutral-500">
                Options are constrained by the current saved model. The server validates the pairing on save.
              </span>
            </label>
          </div>

          <section className="space-y-3 border-t border-neutral-100 pt-5">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">AI model recommendations by section</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Each AI workload can use its recommended model, or an admin can override it for quality, speed, or cost.
              </p>
            </div>
            <div className="grid gap-3">
              {AI_WORKLOAD_POLICIES.map((policy) => (
                <WorkloadModelCard
                  key={policy.id}
                  policy={policy}
                  selection={getAiWorkloadSelection(policy.id, workloadOverrides, globalSelection)}
                />
              ))}
            </div>
          </section>

          <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
            <button
              formAction={saveAiSettings}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              Save settings
            </button>
            <button
              formAction={testAiSettingsConnection}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Test connection
            </button>
          </div>
        </form>
        }
        right={
        <aside className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Current model profile</h2>
            <p className="mt-1 text-sm text-neutral-500">{selectedEntry.description}</p>
          </div>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Default model</dt>
              <dd className="mt-1 font-medium text-neutral-900">{selectedEntry.label}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Allowed efforts</dt>
              <dd className="mt-1 text-neutral-700">{selectedEntry.allowedEfforts.join(', ')}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Usage logging</dt>
              <dd className="mt-1 text-neutral-700">All wrapper calls write feature, tokens, cost, latency, and status to ai_usage_log.</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Routing rule</dt>
              <dd className="mt-1 text-neutral-700">Explicit call settings win first, then workload overrides, then workload recommendations, then the org default.</dd>
            </div>
          </dl>
          <a className="inline-flex text-sm font-medium text-neutral-700 underline underline-offset-2" href="/docs/AI_INTEGRATION.md">
            AI integration guide
          </a>
        </aside>
        }
      />
    </div>
  )
}

function WorkloadModelCard({ policy, selection }: { policy: AiWorkloadPolicy; selection: AiModelSelection }) {
  const selectedEntry = getAiModelCatalogEntry(selection.model) ?? AI_MODEL_CATALOG[0]
  const recommendedEntry = getAiModelCatalogEntry(policy.recommendedModel)

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{policy.section}</p>
          <h3 className="mt-1 text-sm font-semibold text-neutral-900">{policy.label}</h3>
          <p className="mt-1 text-sm text-neutral-600">{policy.description}</p>
        </div>
        <div className="rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-800">
          Recommended: {recommendedEntry?.label ?? policy.recommendedModel}, {policy.recommendedEffort}
        </div>
      </div>

      <p className="mt-3 rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
        {policy.recommendation}
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Model</span>
          <select
            name={`workload_${policy.id}_model`}
            defaultValue={selection.model}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          >
            {AI_MODEL_CATALOG.map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.label}</option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Reasoning effort</span>
          <select
            name={`workload_${policy.id}_effort`}
            defaultValue={selection.effort}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          >
            {selectedEntry.allowedEfforts.map((effort) => (
              <option key={effort} value={effort}>{effort}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}

function StatusBanner({ params }: { params: SearchParams }) {
  if (!params.status) return null

  if (params.status === 'saved') {
    return <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">AI settings saved.</div>
  }

  if (params.status === 'test-ok') {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
        Connection test passed with {params.model} via {params.source} in {params.latency} ms.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
      {params.message ?? 'AI settings action failed.'}
    </div>
  )
}
