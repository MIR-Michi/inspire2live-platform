/**
 * publishing/domain/schema.ts — row shapes for this component's tables.
 *
 * `src/types/database.ts` is generated from the live schema and does not know
 * these tables yet. Declaring the rows here and reading through
 * `moduleClient<PublishingDatabase>()` keeps every query typed without
 * `(supabase as any)` (AGENTS.md §11), the same pattern as `podcast-planning`.
 */

import type { ModuleDatabase, ModuleTable } from '@/kernel/data'

export type PublishingSourceRow = {
  id: string
  title: string | null
  description: string
  images: unknown // [{ bucket, storagePath, mediaType, alt, bytes }]
  rights_status: 'internal_only' | 'approved_for_publication' | 'needs_clearance'
  occurred_at: string | null
  public_url: string | null
  created_by: string
  created_at: string
}

export type PublishingDraftRow = {
  id: string
  source_type: string
  source_id: string
  source_fingerprint: string
  source_fields: unknown // PublishableField[]
  channel: string
  run_id: string
  variant_index: number
  angle: string | null
  body: string
  ai_body: string
  hashtags: string[]
  claims: unknown // [{ text, sourceFieldKey }]
  image_ref: unknown | null
  image_description: string | null
  omitted: string[]
  status: 'pending' | 'approved' | 'dismissed' | 'superseded' | 'published'
  workload: string | null
  model: string | null
  effort: string | null
  prompt_version: string | null
  raw_response: unknown | null
  content_calendar_id: string | null
  created_by: string
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

export type PublishingDatabase = ModuleDatabase<{
  publishing_sources: ModuleTable<PublishingSourceRow>
  publishing_drafts: ModuleTable<PublishingDraftRow>
}>
