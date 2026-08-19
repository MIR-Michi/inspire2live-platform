'use client'

/**
 * publishing/ui/post-board.tsx — the saved posts, as tiles.
 *
 * This is where a post that is not finished still exists (ADR-0015). It shows
 * every saved post from `draft` onward, because a half-written post you cannot
 * see is a post you will write twice.
 *
 * Filtering is client-side on purpose: the board is capped at a readable number
 * of posts, and a filter that costs a round trip stops being used.
 */

import { useState } from 'react'
import Link from 'next/link'
import { StatusBadge } from '@/kernel/ui'
import { postDisplayTitle } from '@/modules/publishing/domain/post-status'
import { POST_STATUS_META, type PostStatus, type PublishingPost } from '@/modules/publishing/domain/types'

export type PostBoardProps = {
  posts: PublishingPost[]
  /** Post id → signed URL for its picture (the bucket is private). */
  imageUrls: Record<string, string>
  /** Profile id → display name, for the owner line. */
  ownerNames: Record<string, string>
  currentUserId: string | null
}

type Filter = 'all' | PostStatus | 'mine'

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Drafts' },
  { id: 'ready_to_publish', label: 'Ready' },
  { id: 'published', label: 'Published' },
  { id: 'mine', label: 'Mine' },
]

function formatDate(value: string | null): string {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value))
  } catch {
    return value
  }
}

export function PostBoard({ posts, imageUrls, ownerNames, currentUserId }: PostBoardProps) {
  const [filter, setFilter] = useState<Filter>('all')

  const visible = posts.filter((post) => {
    if (filter === 'all') return true
    if (filter === 'mine') return post.ownerId === currentUserId
    return post.status === filter
  })

  const countFor = (id: Filter) =>
    posts.filter((post) => {
      if (id === 'all') return true
      if (id === 'mine') return post.ownerId === currentUserId
      return post.status === id
    }).length

  if (posts.length === 0) {
    return (
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Saved posts</h2>
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white py-10 text-center text-sm text-neutral-500">
          Nothing saved yet. Draft from a source above, then <span className="font-semibold">Save</span> a
          variant to keep working on it later.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Saved posts</h2>
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filter saved posts">
          {FILTERS.map((entry) => {
            const count = countFor(entry.id)
            const active = filter === entry.id
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(entry.id)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  active
                    ? 'border-orange-300 bg-orange-50 text-orange-700'
                    : 'border-neutral-200 text-neutral-500 hover:border-neutral-300'
                }`}
              >
                {entry.label}
                <span className={active ? 'ml-1.5 text-orange-500' : 'ml-1.5 text-neutral-400'}>{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white py-8 text-center text-sm text-neutral-500">
          No posts here.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((post, index) => (
            <PostTile
              key={post.id}
              post={post}
              imageUrl={imageUrls[post.id] ?? null}
              ownerName={ownerNames[post.ownerId] ?? 'Unassigned'}
              index={index}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function PostTile({
  post,
  imageUrl,
  ownerName,
  index,
}: {
  post: PublishingPost
  imageUrl: string | null
  ownerName: string
  index: number
}) {
  const meta = POST_STATUS_META[post.status]

  return (
    <Link
      href={`/app/comms/publishing/posts/${post.id}`}
      style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
      className="flex animate-fade-up flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md active:translate-y-0"
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL from private storage
        <img src={imageUrl} alt="" className="h-32 w-full object-cover" />
      ) : (
        <div className="flex h-32 w-full items-center justify-center bg-neutral-50" aria-hidden="true">
          <svg className="h-7 w-7 text-neutral-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M18 6h.008v.008H18V6zm2.25 12H3.75A1.5 1.5 0 012.25 16.5v-9A1.5 1.5 0 013.75 6h16.5a1.5 1.5 0 011.5 1.5v9a1.5 1.5 0 01-1.5 1.5z" />
          </svg>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <StatusBadge label={meta.label} tone={meta.tone} />
          {post.contentCalendarId && <StatusBadge label="On calendar" tone="violet" />}
        </div>

        <p className="line-clamp-3 text-sm font-semibold leading-snug text-neutral-900">
          {postDisplayTitle(post)}
        </p>

        <p className="mt-auto truncate text-xs text-neutral-400">
          {ownerName}
          {' · '}
          {formatDate(post.publishedAt ?? post.createdAt)}
        </p>
      </div>
    </Link>
  )
}
