import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { loadCrmDirectory } from '@/lib/comms-crm-data'

type CrmCountClient = {
  // comms_crm_pipelines is not yet present in the generated Database types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any
}

export default async function CommsCrmHubPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>
}) {
  const params = (await searchParams) ?? {}
  const query = params.q?.trim() ?? ''
  const supabase = await createClient()

  const [directory, pipelinesResult] = await Promise.all([
    loadCrmDirectory(supabase),
    (supabase as unknown as CrmCountClient).from('comms_crm_pipelines').select('id', { count: 'exact', head: true }),
  ])

  const { records, crmReady } = directory
  const pipelineCount: number = pipelinesResult.count ?? 0

  const followUpCount = records.filter((record) => record.health === 'follow_up' || Boolean(record.nextFollowUpAt)).length
  const privacyReviewCount = records.filter((record) => record.consentStatus === 'unknown' || Boolean(record.retentionReviewAt)).length
  const internalCount = records.filter((record) => record.segment === 'internal').length
  const externalCount = records.filter((record) => record.segment === 'external').length

  const tiles = [
    {
      href: '/app/comms/crm/people',
      label: 'People',
      value: records.length,
      meta: `${internalCount} internal · ${externalCount} external`,
      tone: 'border-orange-200 bg-orange-50 text-orange-700',
    },
    {
      href: '/app/comms/crm/pipelines',
      label: 'Pipelines',
      value: pipelineCount,
      meta: pipelineCount === 1 ? '1 active funnel' : `${pipelineCount} active funnels`,
      tone: 'border-violet-200 bg-violet-50 text-violet-700',
    },
    {
      href: '/app/comms/crm/people?filter=follow_up',
      label: 'Follow-ups due',
      value: followUpCount,
      meta: 'People waiting on a next step',
      tone: 'border-rose-200 bg-rose-50 text-rose-700',
    },
    {
      href: '/app/comms/crm/people?filter=privacy_review',
      label: 'Privacy review',
      value: privacyReviewCount,
      meta: 'Consent or retention to confirm',
      tone: 'border-sky-200 bg-sky-50 text-sky-700',
    },
  ]

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">Relationships</p>
        <h2 className="text-2xl font-semibold text-neutral-900">CRM</h2>
        <p className="max-w-2xl text-sm text-neutral-600">
          Find a person, manage relationships, or run a pipeline. Everything here spans internal team members and
          external stakeholders in one place.
        </p>
      </header>

      {!crmReady && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          CRM schema migration is not fully applied yet. Existing platform records are visible, but some CRM features
          require migration 00048 and 00052.
        </div>
      )}

      <form action="/app/comms/crm/people" className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-neutral-800">Search people</span>
          <div className="flex flex-wrap gap-2">
            <input
              name="q"
              defaultValue={query}
              placeholder="Search names, organisations, projects, expertise, tags…"
              className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            />
            <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
              Search
            </button>
          </div>
        </label>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            href={tile.href}
            className="group rounded-lg border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-300 hover:shadow-md"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">{tile.label}</p>
            <p className="mt-2 text-3xl font-semibold text-neutral-950">{tile.value}</p>
            <p className="mt-2 text-sm text-neutral-600">{tile.meta}</p>
            <p className={`mt-4 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${tile.tone}`}>
              Open →
            </p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/app/comms/crm/people"
          className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-300 hover:shadow-md"
        >
          <h3 className="text-lg font-semibold text-neutral-950">Browse people</h3>
          <p className="mt-2 text-sm text-neutral-600">
            Search and filter every person comms works with — internal team members and external stakeholders — with
            full profiles, ownership, and follow-up state.
          </p>
        </Link>
        <Link
          href="/app/comms/crm/pipelines"
          className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-300 hover:shadow-md"
        >
          <h3 className="text-lg font-semibold text-neutral-950">Run a pipeline</h3>
          <p className="mt-2 text-sm text-neutral-600">
            Build a named pipeline, define its stages, and move people through it — picking from the CRM, jotting down
            a new name, or bringing someone new onto the platform.
          </p>
        </Link>
      </div>
    </section>
  )
}
