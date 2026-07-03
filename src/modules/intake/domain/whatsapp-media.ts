import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Inbound WhatsApp media pipeline.
 *
 * A Cloud API webhook only delivers a media *id*, never the bytes. To actually
 * receive an image / video / document / audio we must, promptly (the media URL
 * is short-lived and token-gated):
 *   1. resolve the id → a temporary authenticated URL (+ mime, size),
 *   2. download the bytes with the same bearer token,
 *   3. store them in the private `whatsapp-inbound-media` bucket,
 *   4. record the storage path + mime + size on the intake item.
 *
 * This runs in the background (via `after()` in the webhook route) so a large
 * video never blocks the webhook's 200 response.
 */

const GRAPH_API_VERSION = 'v21.0'
const BUCKET = 'whatsapp-inbound-media'
// Matches the bucket's file_size_limit (WhatsApp's largest media class).
const MAX_BYTES = 100 * 1024 * 1024

export type WhatsAppMediaKind = 'image' | 'video' | 'document' | 'audio'

export type MediaIngestTask = {
  intakeItemId: string
  mediaId: string
  kind: WhatsAppMediaKind
  mimeType: string | null
  filename: string | null
}

type GraphMediaMeta = {
  url?: string
  mime_type?: string
  file_size?: number
}

function extensionFor(mime: string, filename: string | null): string {
  if (filename && /\.[a-z0-9]{1,8}$/i.test(filename)) return '' // already has one
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'video/mp4': '.mp4',
    'video/3gpp': '.3gp',
    'audio/ogg': '.ogg',
    'audio/mpeg': '.mp3',
    'audio/mp4': '.m4a',
    'audio/amr': '.amr',
    'application/pdf': '.pdf',
  }
  return map[mime] ?? ''
}

async function markFailed(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  intakeItemId: string,
  reason: string
): Promise<void> {
  console.error('[whatsapp-media] ingest failed', { intakeItemId, reason })
  await db.from('intake_items').update({ media_status: 'failed' }).eq('id', intakeItemId)
}

/**
 * Download one inbound media file and attach it to its intake item. Idempotent:
 * re-running overwrites the stored object and re-sets the columns, so a webhook
 * retry or a failed-item sweep is safe.
 */
export async function ingestWhatsAppInboundMedia(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, any, any>,
  task: MediaIngestTask
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any
  const token = process.env.WHATSAPP_ACCESS_TOKEN

  if (!token) {
    await markFailed(db, task.intakeItemId, 'WHATSAPP_ACCESS_TOKEN is not configured')
    return
  }
  if (!task.mediaId) {
    await markFailed(db, task.intakeItemId, 'missing media id')
    return
  }

  try {
    // 1. Resolve the media id to a short-lived, authenticated URL.
    const metaRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${task.mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!metaRes.ok) throw new Error(`media lookup failed (${metaRes.status})`)
    const meta = (await metaRes.json()) as GraphMediaMeta
    if (!meta.url) throw new Error('media lookup returned no url')
    if (typeof meta.file_size === 'number' && meta.file_size > MAX_BYTES) {
      throw new Error(`media too large (${meta.file_size} bytes)`)
    }

    // 2. Download the bytes (the CDN URL also requires the bearer token).
    const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } })
    if (!fileRes.ok) throw new Error(`media download failed (${fileRes.status})`)
    const bytes = Buffer.from(await fileRes.arrayBuffer())
    if (bytes.byteLength > MAX_BYTES) throw new Error(`media too large (${bytes.byteLength} bytes)`)

    const mime = task.mimeType || meta.mime_type || 'application/octet-stream'
    const baseName = (task.filename || `${task.kind}-${task.mediaId}`)
      .replace(/[^a-z0-9._-]/gi, '_')
      .slice(0, 100)
    const ext = extensionFor(mime, task.filename)
    const path = `${task.intakeItemId}/${task.mediaId}_${baseName}${ext}`

    // 3. Store in the private bucket.
    const upload = await db.storage.from(BUCKET).upload(path, bytes, { contentType: mime, upsert: true })
    if (upload.error) throw new Error(upload.error.message)

    // 4. Record it on the intake item.
    const { error: updateError } = await db
      .from('intake_items')
      .update({
        media_storage_path: path,
        media_mime_type: mime,
        media_size: bytes.byteLength,
        media_status: 'stored',
      })
      .eq('id', task.intakeItemId)
    if (updateError) throw new Error(updateError.message)
  } catch (error) {
    await markFailed(db, task.intakeItemId, error instanceof Error ? error.message : 'unknown error')
  }
}

/**
 * Create a short-lived signed URL for a stored inbound media object. Returns
 * null if the object can't be signed. Call with a service-role client.
 */
export async function signInboundMediaUrl(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, any, any>,
  storagePath: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(storagePath, expiresInSeconds)
  if (error || !data?.signedUrl) return null
  return data.signedUrl as string
}
