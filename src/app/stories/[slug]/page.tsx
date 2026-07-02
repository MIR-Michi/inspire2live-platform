import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { QueryDiagnostics } from '@/components/ui/query-diagnostics'

type Story = {
  title: string
  summary: string | null
  body: string
  display_name: string | null
  is_anonymous: boolean
  published_at: string | null
  tags: string[]
}

export default async function PublicStoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data: row, error } = await sb
    .from('patient_stories')
    .select('title, summary, body, display_name, is_anonymous, published_at, tags')
    .eq('status', 'published')
    .eq('slug', slug)
    .maybeSingle()

  const issues = [] as Array<{ scope: string; message: string; code?: string; hint?: string }>
  if (error) issues.push({ scope: 'patient_stories.select_public_one', message: error.message, code: error.code, hint: (error as unknown as { hint?: string }).hint })

  const story = row as Story | null
  if (!story) {
    if (issues.length === 0) return notFound()
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <QueryDiagnostics issues={issues} />

      {!story ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
          Story not found.
        </div>
      ) : (
        <article className="space-y-6">
          <header className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {story.is_anonymous ? 'Anonymous' : (story.display_name ?? 'Patient')}
              {story.published_at ? ` · Published ${new Date(story.published_at).toLocaleDateString('en-GB')}` : ''}
            </p>
            <h1 className="text-3xl font-bold text-neutral-900">{story.title}</h1>
            {story.summary && <p className="text-neutral-700">{story.summary}</p>}
            <p className="text-sm text-neutral-600">
              These stories are reviewed and published to keep lived experience at the centre of Inspire2Live decisions.
            </p>
          </header>

          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="prose prose-neutral max-w-none">
              {story.body.split('\n').map((p, idx) => (
                <p key={idx}>{p}</p>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(story.tags ?? []).map((t) => (
              <span key={t} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                {t}
              </span>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <Link href="/stories" className="text-sm font-semibold text-neutral-700 hover:underline">
              ← Back to Stories
            </Link>
            <Link href="/app/stories" className="text-sm font-semibold text-orange-700 hover:underline">
              Share your story →
            </Link>
          </div>
        </article>
      )}
    </div>
  )
}
