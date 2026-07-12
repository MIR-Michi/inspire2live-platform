import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export type MediaAssetType = 'photo' | 'video' | 'recording' | 'slides' | 'document' | 'report'
export type MediaRightsStatus = 'internal_only' | 'approved_for_publication' | 'needs_clearance'
export type MediaRecoveryStatus = 'open' | 'resolved'

export const MEDIA_ASSET_TYPE_META: Record<MediaAssetType, { label: string; tone: string }> = {
  photo: { label: 'Photo', tone: 'border-sky-200 bg-sky-50 text-sky-700' },
  video: { label: 'Video', tone: 'border-violet-200 bg-violet-50 text-violet-700' },
  recording: { label: 'Recording', tone: 'border-amber-200 bg-amber-50 text-amber-700' },
  slides: { label: 'Slides', tone: 'border-blue-200 bg-blue-50 text-blue-700' },
  document: { label: 'Document', tone: 'border-neutral-200 bg-neutral-50 text-neutral-700' },
  report: { label: 'Report', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
}

export const MEDIA_RIGHTS_STATUS_META: Record<MediaRightsStatus, { label: string; tone: string }> = {
  internal_only: {
    label: 'Internal only',
    tone: 'border-neutral-200 bg-neutral-50 text-neutral-700',
  },
  approved_for_publication: {
    label: 'Approved for publication',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  needs_clearance: {
    label: 'Needs clearance',
    tone: 'border-amber-200 bg-amber-50 text-amber-700',
  },
}

type CalendarClient = SupabaseClient<Database>

export function parseTagInput(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  )
}

export function buildRecoveryTitle(rawContent: string, senderName: string) {
  const firstSentence = rawContent.split(/[.!?]/)[0]?.trim() ?? ''
  if (firstSentence) return firstSentence.slice(0, 80)
  return `Media recovery from ${senderName}`
}

export async function syncMediaUsageCounts(
  supabase: CalendarClient,
  assetIds: string[]
) {
  const uniqueIds = Array.from(new Set(assetIds.map((id) => id.trim()).filter(Boolean)))
  if (uniqueIds.length === 0) return

  for (const assetId of uniqueIds) {
    const { count, error: countError } = await supabase
      .from('content_calendar')
      .select('id', { count: 'exact', head: true })
      .contains('attached_media_refs', [assetId])

    if (countError) throw new Error(countError.message)

    const { error: updateError } = await supabase
      .from('media_assets')
      .update({ usage_count: count ?? 0 })
      .eq('id', assetId)

    if (updateError) throw new Error(updateError.message)
  }
}
