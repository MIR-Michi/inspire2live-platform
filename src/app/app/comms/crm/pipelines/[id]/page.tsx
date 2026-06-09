import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadCrmDirectory, loadCrmPipelineDetail } from '@/lib/comms-crm-data'
import { CommsCrmPipelineBoard } from '@/components/comms/comms-crm-pipeline-board'
import { deletePipeline } from '@/app/app/comms/crm/pipeline-actions'

export default async function CommsCrmPipelineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [pipeline, directory] = await Promise.all([loadCrmPipelineDetail(supabase, id), loadCrmDirectory(supabase)])
  if (!pipeline) notFound()

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link href="/app/comms/crm/pipelines" className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700 hover:text-orange-800">
            ← Pipelines
          </Link>
          <h2 className="text-2xl font-semibold text-neutral-900">{pipeline.name}</h2>
          {pipeline.description && <p className="max-w-2xl text-sm text-neutral-600">{pipeline.description}</p>}
        </div>
        <details className="text-right">
          <summary className="cursor-pointer select-none text-xs font-semibold text-rose-700 hover:text-rose-800">Delete pipeline</summary>
          <form action={deletePipeline} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2">
            <input type="hidden" name="pipeline_id" value={pipeline.id} />
            <span className="text-xs text-rose-800">Remove this pipeline and all its stages and members?</span>
            <button className="shrink-0 rounded-lg bg-rose-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-800">Confirm delete</button>
          </form>
        </details>
      </header>

      <CommsCrmPipelineBoard pipeline={pipeline} records={directory.records} />
    </section>
  )
}
