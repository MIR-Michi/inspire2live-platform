import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { loadCrmDirectory, loadCrmPipelineDetail, loadCrmPipelines } from '@/lib/comms-crm-data'
import { CommsCrmPipelineBoard } from '@/components/comms/comms-crm-pipeline-board'
import { PipelineControls } from '@/components/comms/pipeline-controls'
import { deletePipeline } from '@/app/app/comms/crm/pipeline-actions'

export default async function CommsCrmPipelinesPage({
  searchParams,
}: {
  searchParams?: Promise<{ pipeline?: string }>
}) {
  const params = (await searchParams) ?? {}
  const supabase = await createClient()
  const pipelines = await loadCrmPipelines(supabase)

  // Show exactly one pipeline at a time. The requested one (via ?pipeline=) wins
  // when valid, otherwise default to the most recently updated.
  const requested = params.pipeline
  const activeId =
    requested && pipelines.some((pipeline) => pipeline.id === requested)
      ? requested
      : pipelines[0]?.id ?? null

  const [pipeline, directory] = activeId
    ? await Promise.all([loadCrmPipelineDetail(supabase, activeId), loadCrmDirectory(supabase)])
    : [null, null]

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <Link href="/app/comms/crm" className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700 hover:text-orange-800">
          ← CRM
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold text-neutral-900">{pipeline ? pipeline.name : 'Pipelines'}</h2>
            {pipeline?.description ? (
              <p className="max-w-2xl text-sm text-neutral-600">{pipeline.description}</p>
            ) : (
              <p className="max-w-2xl text-sm text-neutral-600">
                Build a named pipeline, define its stages, and move people through it as relationships develop.
              </p>
            )}
          </div>
          <PipelineControls pipelines={pipelines} activeId={activeId} />
        </div>
      </div>

      {!pipeline ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-10 text-center">
          <p className="text-sm font-semibold text-neutral-900">No pipelines yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
            Create your first pipeline to start moving people through stages. Use the
            <span className="font-semibold text-neutral-800"> Create pipeline </span>
            button above to launch the setup wizard.
          </p>
        </div>
      ) : (
        <>
          <CommsCrmPipelineBoard pipeline={pipeline} records={directory?.records ?? []} />

          <details className="text-sm">
            <summary className="cursor-pointer select-none text-xs font-semibold text-rose-700 hover:text-rose-800">
              Delete this pipeline
            </summary>
            <form action={deletePipeline} className="mt-2 inline-flex flex-wrap items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2">
              <input type="hidden" name="pipeline_id" value={pipeline.id} />
              <span className="text-xs text-rose-800">Remove this pipeline and all its stages and members?</span>
              <button className="shrink-0 rounded-lg bg-rose-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-800">
                Confirm delete
              </button>
            </form>
          </details>
        </>
      )}
    </section>
  )
}
