import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { QueryDiagnostics } from '@/components/ui/query-diagnostics'

type PublicStory = {
  id: string
  title: string
  summary: string | null
  slug: string
  published_at: string | null
  display_name: string | null
  is_anonymous: boolean
  tags: string[]
}

export default async function PublicStoriesPage() {
  // Public page: Supabase anon key is fine. If DB/RLS denies, diagnostics will show.
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data: rows, error } = await sb
    .from('patient_stories')
    .select('id, title, summary, slug, published_at, display_name, is_anonymous, tags')
    .eq('status', 'published')
    .not('slug', 'is', null)
    .order('published_at', { ascending: false })

  const issues = [] as Array<{ scope: string; message: string; code?: string; hint?: string }>
  if (error) issues.push({ scope: 'patient_stories.select_public', message: error.message, code: error.code, hint: (error as unknown as { hint?: string }).hint })

  const stories = (rows ?? []) as PublicStory[]

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <QueryDiagnostics issues={issues} />

      <header className="space-y-3">
        <h1 className="text-3xl font-bold text-neutral-900">Patient Stories</h1>
        <p className="max-w-3xl text-neutral-700">
          Lived experience is central to Inspire2Live. These stories are reviewed and published to keep patient voice at the centre of decisions.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/app/stories" className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700">
            Share your story
          </Link>
        </div>
      </header>

      {stories.length === 0 && (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
          No published stories yet.
        </div>
      )}

      {stories.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {stories.map((s) => (
            <Link
              key={s.id}
              href={`/stories/${s.slug}`}
              className="group rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-orange-200 hover:shadow"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {s.is_anonymous ? 'Anonymous' : (s.display_name ?? 'Patient')}
              </p>
              <h2 className="mt-2 text-lg font-bold text-neutral-900 group-hover:text-orange-700">
                {s.title}
              </h2>
              {s.summary && (
                <p className="mt-2 text-sm text-neutral-700">
                  {s.summary}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {(s.tags ?? []).slice(0, 4).map((t) => (
                  <span key={t} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                    {t}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
