/**
 * publishing/domain/adhoc-source.ts — the source with no owning record.
 *
 * An uploaded screenshot is a source, not a second code path (ADR-0014 §3):
 * it is stored as a `publishing_sources` row plus a private storage object and
 * served through `adhocSourceProvider`, which implements the same contract as
 * every linked provider. That is what routes the ad-hoc path through the same
 * readiness gate, groundedness contract and approval gate.
 *
 * Upload pattern follows `uploadTranscript` (validate → storage write → row,
 * remove the object when the row fails); reads use signed URLs like
 * `signInboundMediaUrl` does for WhatsApp media.
 */

import { createClient } from '@/kernel/data/server'
import { moduleClient } from '@/kernel/data'
import {
  fingerprintSource,
  type PublishableImage,
  type PublishableSource,
  type SourceCandidate,
  type SourceContext,
  type SourceProvider,
  type SourceRightsStatus,
} from '@/kernel/publishing'
import type { PublishingDatabase, PublishingSourceRow } from '@/modules/publishing/domain/schema'
import { RIGHTS_STATUSES } from '@/modules/publishing/domain/types'
import type { ActionResult } from '@/modules/publishing/domain/types'

export const ADHOC_SOURCE_TYPE = 'adhoc'
export const UPLOAD_BUCKET = 'publishing-uploads'
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

/** Pure upload validation — unit-testable without a File object. */
export function validateAdhocUpload(
  file: { name: string; type: string; size: number },
  maxUploadMegabytes: number,
): string | null {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'Only PNG, JPEG or WebP images can be uploaded.'
  }
  const maxBytes = Math.floor(maxUploadMegabytes * 1024 * 1024)
  if (file.size <= 0) return 'The file is empty.'
  if (file.size > maxBytes) {
    return `The image is larger than the ${maxUploadMegabytes} MB upload ceiling.`
  }
  return null
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80) || 'upload'
}

export type CreateAdhocSourceInput = {
  file: File
  description: string
  rights: string
  occurredAt?: string | null
  publicUrl?: string | null
  userId: string
  maxUploadMegabytes: number
}

/**
 * Store the screenshot (private bucket) and the source row with its rights
 * answer. On a row failure the uploaded object is removed again.
 */
export async function createAdhocSource(
  input: CreateAdhocSourceInput,
): Promise<ActionResult<{ sourceId: string }>> {
  const description = input.description.trim()
  if (!description) return { ok: false, error: 'Say in one line what this is.' }
  if (!(RIGHTS_STATUSES as readonly string[]).includes(input.rights)) {
    return { ok: false, error: 'Pick a rights answer.' }
  }

  const invalid = validateAdhocUpload(
    { name: input.file.name, type: input.file.type, size: input.file.size },
    input.maxUploadMegabytes,
  )
  if (invalid) return { ok: false, error: invalid }

  const supabase = await createClient()
  const storagePath = `${input.userId}/${Date.now()}-${sanitizeFilename(input.file.name)}`

  const upload = await supabase.storage.from(UPLOAD_BUCKET).upload(storagePath, input.file, {
    contentType: input.file.type,
    upsert: false,
  })
  if (upload.error) return { ok: false, error: `Upload failed: ${upload.error.message}` }

  const image = {
    bucket: UPLOAD_BUCKET,
    storagePath,
    mediaType: input.file.type,
    alt: description.slice(0, 160),
    bytes: input.file.size,
  }

  const db = moduleClient<PublishingDatabase>(supabase)
  const { data, error } = await db
    .from('publishing_sources')
    .insert({
      title: description.slice(0, 120),
      description,
      images: [image],
      rights_status: input.rights as SourceRightsStatus,
      occurred_at: input.occurredAt || null,
      public_url: input.publicUrl?.trim() || null,
      created_by: input.userId,
    })
    .select('id')
    .maybeSingle()

  if (error || !data) {
    await supabase.storage.from(UPLOAD_BUCKET).remove([storagePath])
    return { ok: false, error: error?.message ?? 'The source could not be saved.' }
  }

  return { ok: true, data: { sourceId: data.id } }
}

function rowImages(row: PublishingSourceRow): PublishableImage[] {
  if (!Array.isArray(row.images)) return []
  return (row.images as Array<Record<string, unknown>>)
    .filter((entry) => typeof entry?.storagePath === 'string')
    .map((entry) => ({
      bucket: typeof entry.bucket === 'string' ? entry.bucket : UPLOAD_BUCKET,
      storagePath: entry.storagePath as string,
      mediaType: typeof entry.mediaType === 'string' ? entry.mediaType : 'image/png',
      alt: typeof entry.alt === 'string' ? entry.alt : '',
    }))
}

/** Build the same payload shape every other provider returns. */
export function toAdhocPublishableSource(row: PublishingSourceRow): PublishableSource {
  const base = {
    sourceType: ADHOC_SOURCE_TYPE,
    sourceId: row.id,
    title: row.title || row.description.slice(0, 120),
    occurredAt: row.occurred_at,
    reviewHref: `/app/comms/publishing?sourceType=${ADHOC_SOURCE_TYPE}&sourceId=${row.id}`,
    publicUrl: row.public_url,
    fields: [
      {
        key: 'description',
        label: 'Description',
        value: row.description,
        intent: 'copy' as const,
      },
    ],
    images: rowImages(row),
    people: [],
    links: [],
    rights: row.rights_status,
  }
  // An ad-hoc source is immutable, so its fingerprint never drifts.
  return { ...base, fingerprint: fingerprintSource(base) }
}

/** The ad-hoc provider — same contract, no privileged path. Offers no picker candidates. */
export const adhocSourceProvider: SourceProvider = {
  sourceType: ADHOC_SOURCE_TYPE,
  label: 'Screenshot & note',
  ownedBy: 'publishing',
  async listRecent(): Promise<SourceCandidate[]> {
    return []
  },
  async load(ctx: SourceContext, sourceId: string): Promise<PublishableSource | null> {
    const db = moduleClient<PublishingDatabase>(ctx.supabase)
    const { data, error } = await db
      .from('publishing_sources')
      .select('*')
      .eq('id', sourceId)
      .maybeSingle()
    if (error) {
      console.error('[publishing] adhoc load failed', error.message)
      return null
    }
    return data ? toAdhocPublishableSource(data) : null
  },
}

/** Signed URL for rendering the private upload in the space (never a public URL). */
export async function signAdhocImageUrl(
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from(UPLOAD_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}
