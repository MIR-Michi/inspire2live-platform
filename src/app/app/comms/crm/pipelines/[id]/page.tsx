import { redirect } from 'next/navigation'

// Pipelines are now shown one at a time on the main pipelines page, selected via
// the ?pipeline= query and a switcher. Keep this route working for old links.
export default async function CommsCrmPipelineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/app/comms/crm/pipelines?pipeline=${id}`)
}
