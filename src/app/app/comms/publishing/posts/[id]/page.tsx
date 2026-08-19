/**
 * /app/comms/publishing/posts/[id] — one saved post (ADR-0015).
 *
 * A thin route, like the space itself: it loads the post, signs its picture,
 * resolves the rights answer behind its source, and mounts the editor with the
 * server actions wired in. Access is enforced by the comms layout and RLS.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  PostEditor,
  channelProfile,
  loadPost,
  loadPostOwnerOptions,
  postRights,
  resolvePublishingConfig,
  signPostImages,
} from '@/modules/publishing'
import {
  attachPostImageAction,
  deletePostAction,
  handOverPostAction,
  removePostImageAction,
  setPostOwnerAction,
  setPostStatusAction,
  updatePostAction,
} from '../../actions'

export default async function PublishingPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const post = await loadPost(id)
    if (!post) notFound()

    const config = await resolvePublishingConfig()
    const profile = channelProfile(post.channel)

    const [imageUrls, owners, rights] = await Promise.all([
      signPostImages([post]),
      loadPostOwnerOptions(),
      postRights(post),
    ])

    // The owner must be in the picker even if their role changed since.
    const ownerOptions = owners.some((owner) => owner.id === post.ownerId)
      ? owners
      : [...owners, { id: post.ownerId, name: 'Current owner' }]

    const sourceHref = `/app/comms/publishing?sourceType=${encodeURIComponent(post.sourceType)}&sourceId=${encodeURIComponent(post.sourceId)}`

    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="space-y-1">
          <Link
            href="/app/comms/publishing"
            className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700 hover:underline"
          >
            ← Publishing
          </Link>
          <h1 className="text-3xl font-semibold text-neutral-900">Post</h1>
        </div>

        <PostEditor
          post={post}
          imageUrl={imageUrls[post.id] ?? null}
          owners={ownerOptions}
          rights={rights}
          channelLabel={profile?.label ?? post.channel}
          characterBudget={profile?.characterBudget ?? 0}
          maxUploadMegabytes={config.maxUploadMegabytes}
          sourceHref={sourceHref}
          actions={{
            updatePost: updatePostAction,
            setPostStatus: setPostStatusAction,
            setPostOwner: setPostOwnerAction,
            attachPostImage: attachPostImageAction,
            removePostImage: removePostImageAction,
            deletePost: deletePostAction,
            handOverPost: handOverPostAction,
          }}
        />
      </div>
    )
  } catch (error) {
    // `notFound()` signals through an exception — let it past the guard.
    if (error && typeof error === 'object' && 'digest' in error) throw error

    console.error('[publishing] post page failed to load', error)
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-3xl font-semibold text-neutral-900">Post</h1>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          This post could not be loaded. Nothing was changed — try again.
        </div>
      </div>
    )
  }
}
