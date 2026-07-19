import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createEvent } from '@/app/app/comms/events/actions'
import { PresenterAvatar } from '@/components/comms/presenter-avatar'
import { getPodcastWorkflowProgress } from '@/lib/comms-events'

function formatEpisodeDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function dateOnly(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function truncate(text: string, max = 180) {
  const t = text.trim()
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t
}

type Episode = {
  id: string
  title: string
  seriesName: string | null
  date: string
  description: string | null
  guestLabel: string | null
  imageUrl: string | null
  published: boolean
  openTasks: number
}

type Guest = {
  name: string
  episodeCount: number
  latestDate: string
  latestTitle: string
}

const SMALL_TILE_LIMIT = 6

const EPISODE_SELECT =
  'id, name, start_date, event_image_url, presentation_summary, podcast_episode_title, podcast_series_name, podcast_guests, podcast_hosts, podcast_published, podcast_brief_ready, podcast_guest_confirmed, podcast_release_form_ready, podcast_equipment_ready, podcast_recording_completed, podcast_backup_completed, podcast_edit_completed, podcast_transcript_completed, podcast_show_notes_completed, podcast_followup_completed'

export default async function CommsPodcastPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; show?: string }>
}) {
  const params = (await searchParams) ?? {}
  const activeTab = params.tab === 'guests' ? 'guests' : 'episodes'
  const showAll = params.show === 'all'
  const supabase = await createClient()

  const [{ data: events }, { data: profiles }] = await Promise.all([
    supabase
      .from('events')
      .select(EPISODE_SELECT)
      .eq('event_type', 'podcast')
      .order('start_date', { ascending: false }),
    supabase.from('profiles').select('id, name, email').order('name'),
  ])

  const people = (profiles ?? []).map((p) => ({ id: p.id, label: p.name ?? p.email ?? 'Unknown' }))

  const episodes: Episode[] = (events ?? []).map((event) => {
    const guests = event.podcast_guests ?? []
    const hosts = event.podcast_hosts ?? []
    const guestLabel = guests.length > 0 ? guests.join(', ') : hosts.length > 0 ? hosts.join(', ') : null
    const { completed, total } = getPodcastWorkflowProgress(event)
    return {
      id: event.id,
      title: event.podcast_episode_title || event.name,
      seriesName: event.podcast_series_name ?? null,
      date: event.start_date,
      description: event.presentation_summary ?? null,
      guestLabel,
      imageUrl: event.event_image_url ?? null,
      published: Boolean(event.podcast_published),
      openTasks: Math.max(total - completed, 0),
    }
  })

  const today = dateOnly(new Date())
  const upcoming = episodes.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  const past = episodes.filter((e) => e.date < today) // already start_date desc
  const nextEpisode = upcoming[0] ?? null
  const previousEpisode = past[0] ?? null
  const olderEpisodes = past.slice(1)
  const smallTiles = showAll ? olderEpisodes : olderEpisodes.slice(0, SMALL_TILE_LIMIT)
  const hasMore = olderEpisodes.length > SMALL_TILE_LIMIT

  // Unique guests aggregated across every episode (podcast guests have no
  // standalone record; they live on each episode's `podcast_guests`).
  const guestMap = new Map<string, Guest>()
  for (const event of events ?? []) {
    const title = event.podcast_episode_title || event.name
    for (const name of event.podcast_guests ?? []) {
      const existing = guestMap.get(name)
      if (!existing) {
        guestMap.set(name, { name, episodeCount: 1, latestDate: event.start_date, latestTitle: title })
      } else {
        existing.episodeCount += 1
        if (event.start_date > existing.latestDate) {
          existing.latestDate = event.start_date
          existing.latestTitle = title
        }
      }
    }
  }
  const guests = Array.from(guestMap.values()).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <section className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Podcast</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">Saved</span>
          <details className="relative">
            <summary className="list-none rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700">
              + New episode
            </summary>
            <form action={createEvent} className="absolute right-0 z-10 mt-2 w-80 space-y-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-lg">
              <input type="hidden" name="event_type" value="podcast" />
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-neutral-700">Episode title</span>
                <input name="name" required className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-neutral-700">Recording date</span>
                <input type="date" name="start_date" required className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-neutral-700">Responsible owner</span>
                <select name="owner_id" required className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm">
                  <option value="">Select owner…</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="w-full rounded-lg bg-neutral-950 px-3 py-2 text-sm font-semibold text-white">
                Create episode
              </button>
            </form>
          </details>
        </div>
      </header>

      <nav className="flex gap-4 border-b border-neutral-200">
        <Link
          href="/app/comms/podcast"
          className={`border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === 'episodes' ? 'border-orange-600 text-orange-700' : 'border-transparent text-neutral-500 hover:text-neutral-900'}`}
        >
          Episodes
        </Link>
        <Link
          href="/app/comms/podcast?tab=guests"
          className={`border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === 'guests' ? 'border-orange-600 text-orange-700' : 'border-transparent text-neutral-500 hover:text-neutral-900'}`}
        >
          Guests
        </Link>
      </nav>

      {activeTab === 'episodes' ? (
        <div className="space-y-6">
          {/* Dominant tiles: previous + next */}
          {previousEpisode || nextEpisode ? (
            <div className="grid gap-4 md:grid-cols-2">
              {previousEpisode && <BigEpisodeTile episode={previousEpisode} label="Last episode" tone="past" />}
              {nextEpisode && <BigEpisodeTile episode={nextEpisode} label="Next episode" tone="next" />}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-neutral-300 bg-white py-12 text-center text-sm text-neutral-500">
              No podcast episodes yet. Use “+ New episode” to create the first one.
            </p>
          )}

          {/* Smaller tiles: older episodes */}
          {smallTiles.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Previous episodes</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {smallTiles.map((episode, index) => (
                  <SmallEpisodeTile key={episode.id} episode={episode} index={index} />
                ))}
              </div>
              {hasMore && !showAll && (
                <div className="pt-1">
                  <Link
                    href="/app/comms/podcast?show=all"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-orange-700 hover:text-orange-800"
                  >
                    Show all episodes &rarr;
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {guests.map((guest) => (
            <div
              key={guest.name}
              className="block rounded-xl border border-neutral-200 bg-white px-5 py-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-neutral-900">{guest.name}</h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    {guest.episodeCount} {guest.episodeCount === 1 ? 'episode' : 'episodes'} - Latest: {guest.latestTitle}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {guests.length === 0 && (
            <p className="rounded-xl border border-dashed border-neutral-300 bg-white py-10 text-center text-sm text-neutral-500">
              No podcast guests are recorded yet.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

function BigEpisodeTile({ episode, label, tone }: { episode: Episode; label: string; tone: 'past' | 'next' }) {
  const isNext = tone === 'next'
  return (
    <Link
      href={`/app/comms/events/${episode.id}`}
      className={[
        'flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-200 animate-fade-up hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.995]',
        isNext ? 'border-blue-900 ring-1 ring-blue-900/40' : 'border-neutral-200',
      ].join(' ')}
    >
      <div className={isNext ? 'bg-blue-900 px-5 py-3 text-white' : 'bg-neutral-50 px-5 py-3 text-neutral-900'}>
        <div className="flex items-center justify-between gap-2">
          <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${isNext ? 'text-blue-200' : 'text-neutral-400'}`}>
            {label}
          </p>
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${isNext ? 'bg-white/15 text-white' : 'bg-emerald-50 text-emerald-700'}`}>
            {isNext ? 'Ready' : episode.published ? 'Published' : 'Completed'}
          </span>
        </div>
      </div>

      <div className="flex flex-1 gap-4 px-5 py-4">
        <PresenterAvatar
          src={episode.imageUrl}
          name={episode.guestLabel}
          className="h-20 w-20 shrink-0"
          rounded="rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold leading-tight text-neutral-900">{episode.title}</h3>
          <p className="mt-0.5 text-sm font-medium text-blue-900">
            {episode.guestLabel || 'Guest to be announced'}
          </p>
          <p className="mt-0.5 text-xs font-medium text-neutral-400">
            {formatEpisodeDate(episode.date)}
            {episode.seriesName ? ` · ${episode.seriesName}` : ''}
          </p>
          <p className="mt-2 text-sm leading-5 text-neutral-600">
            {episode.description
              ? truncate(episode.description)
              : 'Episode brief building in progress — angle, guest, and talking points still to be captured.'}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between px-5 pb-4">
        <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-600">
          {episode.openTasks} open {episode.openTasks === 1 ? 'task' : 'tasks'}
        </span>
        <span className="text-sm font-semibold text-blue-900">Open -&gt;</span>
      </div>
    </Link>
  )
}

function SmallEpisodeTile({ episode, index }: { episode: Episode; index: number }) {
  return (
    <Link
      href={`/app/comms/events/${episode.id}`}
      style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
      className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm transition-all duration-200 animate-fade-up hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md active:translate-y-0"
    >
      <PresenterAvatar
        src={episode.imageUrl}
        name={episode.guestLabel}
        className="h-12 w-12 shrink-0"
        rounded="rounded-lg"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-neutral-900">{episode.title}</p>
        <p className="truncate text-xs text-neutral-500">{episode.guestLabel || formatEpisodeDate(episode.date)}</p>
        <p className="mt-0.5 text-[11px] font-medium text-neutral-400">
          {episode.openTasks} open {episode.openTasks === 1 ? 'task' : 'tasks'}
        </p>
      </div>
    </Link>
  )
}
