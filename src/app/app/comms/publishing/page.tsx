/**
 * /app/comms/publishing — the Publishing space (Sprint 21, ADR-0014).
 *
 * A thin route: it resolves the selected source through the registry, loads
 * the live drafts, and mounts the `publishing` component's shell with the
 * server actions wired in. Access is enforced by the comms layout and RLS.
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isAiEnabled } from '@/lib/ai/feature-flag'
import {
  CHANNEL_PROFILES,
  PostBoard,
  PublishingShell,
  loadDrafts,
  loadPostOwnerOptions,
  loadPosts,
  loadPostsForDrafts,
  resolvePublishingConfig,
  signPostImages,
  sourceReadiness,
  type PublishingShellSource,
} from '@/modules/publishing'
import { listRecentSourceCandidates, resolveSource, sourceProviderFor } from '@/modules/publishing-registry'
import {
  approveDraftAction,
  createAdhocSourceAction,
  dismissDraftAction,
  editDraftAction,
  generateDraftsAction,
  savePostAction,
} from './actions'

const ACTIVE_CHANNEL = 'linkedin'

export default async function PublishingPage({
  searchParams,
}: {
  searchParams: Promise<{ sourceType?: string; sourceId?: string }>
}) {
  const { sourceType, sourceId } = await searchParams

  // The space is an AI feature end to end: with the flag off it explains
  // itself instead of showing a dead button (concept §9.2).
  if (!isAiEnabled()) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <PageHeading />
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-neutral-800">AI features are switched off on this platform.</p>
          <p className="mt-1 text-sm text-neutral-500">
            Publishing drafts copy through the platform&apos;s AI layer, so this space is unavailable until an
            administrator enables <code className="rounded bg-neutral-100 px-1">NEXT_PUBLIC_FEATURE_AI</code>.
          </p>
        </div>
      </div>
    )
  }

  try {
    const supabase = await createClient()
    const config = await resolvePublishingConfig()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const channels = CHANNEL_PROFILES.map((profile) => ({
      channel: profile.channel,
      label: profile.label,
      enabled: profile.availability === 'enabled',
      budget: profile.characterBudget,
    }))

    const candidates = await listRecentSourceCandidates({ supabase }, 8)

    let shellSource: PublishingShellSource | null = null
    let drafts: Awaited<ReturnType<typeof loadDrafts>> = []
    let missingSource = false

    if (sourceType && sourceId) {
      const source = await resolveSource({ supabase }, sourceType, sourceId)
      if (!source) {
        missingSource = true
      } else {
        drafts = await loadDrafts({ sourceType, sourceId, channel: ACTIVE_CHANNEL })

        const firstImage = (source.images ?? [])[0] ?? null
        let imageUrl: string | null = null
        if (firstImage) {
          const { data } = await supabase.storage
            .from(firstImage.bucket)
            .createSignedUrl(firstImage.storagePath, 3600)
          imageUrl = data?.signedUrl ?? null
        }

        const readiness = sourceReadiness(source, config)
        const liveDraft = drafts.find((draft) => draft.status === 'pending' || draft.status === 'approved')
        const stale = Boolean(liveDraft && liveDraft.sourceFingerprint !== source.fingerprint)

        shellSource = {
          sourceType: source.sourceType,
          sourceId: source.sourceId,
          title: source.title,
          occurredAt: source.occurredAt,
          reviewHref: source.reviewHref,
          providerLabel: sourceProviderFor(sourceType)?.label ?? sourceType,
          fieldLabels: source.fields.filter((field) => field.value.trim()).map((field) => field.label),
          rights: source.rights ?? null,
          imageUrl,
          ready: readiness.ready,
          readinessReason: readiness.ready ? null : readiness.reason,
          stale,
          staleBehaviour: config.staleDraftBehaviour,
        }
      }
    }

    // Which of the visible variants are already saved, so a variant offers
    // "Open post" instead of a second Save.
    const savedForDrafts = await loadPostsForDrafts(drafts.map((draft) => draft.id))
    const postIdByDraftId: Record<string, string> = {}
    for (const post of savedForDrafts) {
      if (post.draftId) postIdByDraftId[post.draftId] = post.id
    }

    // The tile board replaces the source step's "recent" strip: it is only
    // shown when nothing is selected, so the wizard stays one decision wide.
    const posts = shellSource ? [] : await loadPosts({ limit: 60 })
    const [postImageUrls, owners] = await Promise.all([
      signPostImages(posts),
      posts.length > 0 ? loadPostOwnerOptions() : Promise.resolve([]),
    ])
    const ownerNames = Object.fromEntries(owners.map((owner) => [owner.id, owner.name]))

    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeading />
        {missingSource && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            That source could not be found — it may have been removed.{' '}
            <Link href="/app/comms/publishing" className="font-semibold underline">
              Start over
            </Link>
          </div>
        )}
        <PublishingShell
          channels={channels}
          activeChannel={ACTIVE_CHANNEL}
          candidates={candidates}
          source={shellSource}
          drafts={drafts}
          postIdByDraftId={postIdByDraftId}
          maxUploadMegabytes={config.maxUploadMegabytes}
          actions={{
            createAdhocSource: createAdhocSourceAction,
            generateDrafts: generateDraftsAction,
            editDraft: editDraftAction,
            approveDraft: approveDraftAction,
            dismissDraft: dismissDraftAction,
            savePost: savePostAction,
          }}
        />
        {!shellSource && (
          <PostBoard
            posts={posts}
            imageUrls={postImageUrls}
            ownerNames={ownerNames}
            currentUserId={user?.id ?? null}
          />
        )}
      </div>
    )
  } catch (error) {
    console.error('[publishing] page failed to load', error)
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <PageHeading />
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          The Publishing space could not be loaded. Nothing was changed — try again.
        </div>
      </div>
    )
  }
}

function PageHeading() {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">Content</p>
      <h1 className="text-3xl font-semibold text-neutral-900">Publishing</h1>
    </div>
  )
}
