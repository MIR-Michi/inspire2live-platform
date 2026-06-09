import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { loadCrmPipelines } from '@/lib/comms-crm-data'
import { formatCrmDate } from '@/lib/comms-crm'
import { createPipeline } from '@/app/app/comms/crm/pipeline-actions'

export default async function CommsCrmPipelinesPage() {
  const supabase = await createClient()
  const pipelines = await loadCrmPipelines(supabase)

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <Link href="/app/comms/crm" className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700 hover:text-orange-800">
          ← CRM
        </Link>
        <h2 className="text-2xl font-semibold text-neutral-900">Pipelines</h2>
        <p className="max-w-2xl text-sm text-neutral-600">
          Build a named pipeline, define its stages, and move people through it as relationships develop.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          {pipelines.length === 0 && (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-sm text-neutral-600">
              No pipelines yet. Create your first one to start moving people through stages.
            </div>
          )}

          {pipelines.map((pipeline) => (
            <Link
              key={pipeline.id}
              href={`/app/comms/crm/pipelines/${pipeline.id}`}
              className="block rounded-lg border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-300 hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-950">{pipeline.name}</h3>
                  {pipeline.description && <p className="mt-1 max-w-xl text-sm text-neutral-600">{pipeline.description}</p>}
                </div>
                <p className="shrink-0 text-xs font-semibold uppercase tracking-[0.1em] text-neutral-400">
                  Updated {formatCrmDate(pipeline.updatedAt)}
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.1em]">
                <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-violet-700">
                  {pipeline.stageCount === 1 ? '1 stage' : `${pipeline.stageCount} stages`}
                </span>
                <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-orange-700">
                  {pipeline.memberCount === 1 ? '1 person' : `${pipeline.memberCount} people`}
                </span>
              </div>
            </Link>
          ))}
        </div>

        <aside className="h-fit space-y-4 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-500">Create a pipeline</h3>
          <form action={createPipeline} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-neutral-800">Pipeline name</span>
              <input
                name="name"
                required
                placeholder="e.g. Conference speaker outreach"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-neutral-800">Description</span>
              <textarea
                name="description"
                rows={2}
                placeholder="What is this funnel for?"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-neutral-800">Stages</span>
              <textarea
                name="stage_names"
                rows={4}
                placeholder={'One stage per line, e.g.\nIdentified\nContacted\nConfirmed\nFollowed up'}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              />
              <span className="text-xs text-neutral-500">One stage per line (or comma-separated). You can adjust these later.</span>
            </label>
            <button className="w-full rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
              Create pipeline
            </button>
          </form>
        </aside>
      </div>
    </section>
  )
}
