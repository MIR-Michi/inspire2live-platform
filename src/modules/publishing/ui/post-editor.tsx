'use client'

/**
 * publishing/ui/post-editor.tsx — one saved post: write it, picture it, hand it
 * to someone, move it along (ADR-0015).
 *
 * Everything here is available at every status, which is the difference between
 * a post and the draft variant it came from. The gates that are not the UI's to
 * decide — the rights answer, the legal status moves — are enforced again in
 * `domain/post-status.ts` and `domain/posts.ts`; this file only renders what the
 * domain already allows and explains what it does not.
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CharacterRing, ImageDropZone, StatusBadge } from '@/kernel/ui'
import type { ImageDropZoneValue } from '@/kernel/ui'
import type { SourceRightsStatus } from '@/kernel/publishing'
import { nextPostStatuses } from '@/modules/publishing/domain/post-status'
import {
  POST_STATUS_META,
  RIGHTS_META,
  type PostStatus,
  type PublishingPost,
} from '@/modules/publishing/domain/types'
import type { PublishingActionState } from '@/modules/publishing/ui/publishing-shell'

export type PostEditorActions = {
  updatePost: (input: { postId: string; body?: string; title?: string | null; hashtags?: string[] }) => Promise<PublishingActionState>
  setPostStatus: (input: { postId: string; status: PostStatus }) => Promise<PublishingActionState>
  setPostOwner: (input: { postId: string; ownerId: string }) => Promise<PublishingActionState>
  attachPostImage: (formData: FormData) => Promise<PublishingActionState>
  removePostImage: (input: { postId: string }) => Promise<PublishingActionState>
  deletePost: (input: { postId: string }) => Promise<PublishingActionState>
  handOverPost: (input: { postId: string }) => Promise<PublishingActionState>
}

export type PostEditorProps = {
  post: PublishingPost
  /** Signed URL for the current picture, when there is one. */
  imageUrl: string | null
  /** Who this post can belong to. */
  owners: Array<{ id: string; name: string }>
  /** The rights answer behind the source — null for a linked source. */
  rights: SourceRightsStatus | null
  channelLabel: string
  characterBudget: number
  maxUploadMegabytes: number
  /** Back to the wizard with this post's source selected. */
  sourceHref: string
  actions: PostEditorActions
}

function formatDate(value: string | null): string {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value))
  } catch {
    return value
  }
}

export function PostEditor({
  post,
  imageUrl,
  owners,
  rights,
  channelLabel,
  characterBudget,
  maxUploadMegabytes,
  sourceHref,
  actions,
}: PostEditorProps) {
  const router = useRouter()
  const [busy, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [title, setTitle] = useState(post.title ?? '')
  const [body, setBody] = useState(post.body)
  const [hashtags, setHashtags] = useState(post.hashtags.join(' '))
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const dirty =
    body !== post.body ||
    (title.trim() || null) !== (post.title?.trim() || null) ||
    hashtags.trim() !== post.hashtags.join(' ').trim()

  const overBudget = characterBudget > 0 && body.length > characterBudget
  const statusMeta = POST_STATUS_META[post.status]

  const run = (
    action: () => Promise<PublishingActionState>,
    after?: (state: PublishingActionState) => void,
  ) => {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const state = await action()
      if (!state.ok) {
        setError(state.error ?? 'Something went wrong.')
        return
      }
      if (state.warning) setNotice(state.warning)
      else if (state.message) setNotice(state.message)
      after?.(state)
      router.refresh()
    })
  }

  const save = () =>
    run(
      () =>
        actions.updatePost({
          postId: post.id,
          body,
          title: title.trim() || null,
          hashtags: hashtags.split(/[\s,]+/).filter(Boolean),
        }),
      () => setNotice('Saved.'),
    )

  const uploadImage = (file: File) => {
    const formData = new FormData()
    formData.set('postId', post.id)
    formData.set('image', file)
    formData.set('alt', title.trim() || body.slice(0, 160))
    run(() => actions.attachPostImage(formData))
  }

  const dropValue: ImageDropZoneValue | null = imageUrl
    ? { name: post.imageRef?.alt || 'Picture', previewUrl: imageUrl }
    : null

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-xs font-semibold text-red-600 hover:text-red-800">
            Dismiss
          </button>
        </div>
      )}
      {notice && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{notice}</div>}

      {/* Status + where it stands */}
      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <StatusBadge label={statusMeta.label} tone={statusMeta.tone} />
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-500">{channelLabel}</span>
        {rights && <StatusBadge label={RIGHTS_META[rights].label} tone={RIGHTS_META[rights].tone} />}
        {post.contentCalendarId && (
          <span className="text-xs font-semibold text-neutral-500">
            On the <Link href="/app/comms/calendar" className="text-orange-700 underline">calendar</Link>
          </span>
        )}
        <span className="text-xs text-neutral-400">
          {post.publishedAt ? `Published ${formatDate(post.publishedAt)}` : `Saved ${formatDate(post.createdAt)}`}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {nextPostStatuses(post.status).map((next) => (
            <button
              key={next}
              type="button"
              disabled={busy}
              onClick={() => run(() => actions.setPostStatus({ postId: post.id, status: next }))}
              className={`rounded-xl px-4 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                next === 'draft'
                  ? 'border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50'
                  : 'bg-orange-600 text-white hover:bg-orange-700'
              }`}
            >
              {next === 'draft' ? 'Back to draft' : `Mark ${POST_STATUS_META[next].label.toLowerCase()}`}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        {/* The copy */}
        <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-neutral-900">Post</h2>
            <CharacterRing count={body.length} budget={characterBudget} />
          </div>

          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Title (optional — used on the calendar)"
            maxLength={160}
            disabled={busy}
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
            aria-label="Title"
          />

          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={14}
            disabled={busy}
            placeholder="Write the post…"
            className={`w-full resize-y rounded-xl border px-3 py-2 text-sm leading-relaxed focus:outline-none ${
              overBudget ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-orange-400'
            }`}
            aria-label="Post text"
          />
          {overBudget && <p className="text-xs font-semibold text-red-600">Over budget — trim before it goes out.</p>}

          <input
            value={hashtags}
            onChange={(event) => setHashtags(event.target.value)}
            placeholder="#hashtags, space separated"
            disabled={busy}
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
            aria-label="Hashtags"
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={busy || !dirty}
              className="rounded-xl bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {busy ? 'Saving…' : dirty ? 'Save' : 'Saved'}
            </button>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText([body, hashtags].filter(Boolean).join('\n\n'))
                setNotice('Copied.')
              }}
              className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Copy
            </button>
          </div>
        </section>

        {/* Picture, owner, the rest */}
        <div className="space-y-5">
          <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-neutral-900">Picture</h2>
            <ImageDropZone
              value={dropValue}
              onSelect={uploadImage}
              onClear={() => run(() => actions.removePostImage({ postId: post.id }))}
              disabled={busy}
              label="Add a picture"
              hint={`or click to choose · paste works too · up to ${maxUploadMegabytes} MB`}
            />
          </section>

          <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-neutral-900">Owner</h2>
            <select
              value={post.ownerId}
              disabled={busy}
              onChange={(event) => run(() => actions.setPostOwner({ postId: post.id, ownerId: event.target.value }))}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
              aria-label="Owner"
            >
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-neutral-400">
              Everyone on the comms team can open this post — the owner is who is responsible for it.
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-neutral-900">Elsewhere</h2>
            <div className="flex flex-col gap-2">
              <Link
                href={sourceHref}
                className="rounded-xl border border-neutral-200 px-4 py-2 text-center text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
              >
                Back to the source
              </Link>
              {!post.contentCalendarId && (
                <button
                  type="button"
                  disabled={busy || post.status === 'draft'}
                  title={post.status === 'draft' ? 'Mark the post ready to publish first' : undefined}
                  onClick={() => run(() => actions.handOverPost({ postId: post.id }))}
                  className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Put on the calendar
                </button>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            {confirmingDelete ? (
              <div className="space-y-2">
                <p className="text-sm text-neutral-700">Delete this post for good?</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(() => actions.deletePost({ postId: post.id }), () => router.push('/app/comms/publishing'))
                    }
                    className="rounded-xl bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="rounded-xl border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-500 hover:bg-neutral-50"
                  >
                    Keep it
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="text-xs font-semibold text-neutral-400 hover:text-red-600"
              >
                Delete post
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
