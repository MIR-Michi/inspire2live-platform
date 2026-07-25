/**
 * podcast-planning/domain/schema.ts — the row shapes this component owns.
 *
 * See `@/kernel/data/module-schema` for why these are declared here rather than
 * reached through `(supabase as any)`. Delete once `src/types/database.ts` is
 * regenerated against migration 00172.
 *
 * Note there is no `network_people` row type here, and there never will be:
 * people belong to the `network` component and are read through its public API
 * (ADR-0013 §2).
 */

import type { ModuleDatabase, ModuleTable } from '@/kernel/data'

export type QuestionRow = {
  id: string
  question: string
  why_now: string | null
  why_now_source_urls: string[]
  why_now_at: string | null
  anchor_date: string | null
  independent_sources: number
  ask_type: string | null
  ask_destination_url: string | null
  ask_verified_at: string | null
  format: string | null
  topic_tags: string[]
  initiative_id: string | null
  on_advocacy_agenda: boolean
  patient_relevance: string
  question_pull: number
  ask_conversion_prior: number
  amplification: number
  owner_id: string | null
  status: string
  retired_reason: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type CandidateRow = {
  id: string
  question_id: string
  person_id: string
  angle: string | null
  stage: string
  stage_entered_at: string
  is_anchor: boolean
  route: string | null
  recent_appearance: string
  good_moment: number
  practicalities: number
  prior_refusal: string
  prior_refusal_at: string | null
  guest_audience: number
  chance_of_yes: number | null
  score_total: number | null
  scored_at: string | null
  wake_date: string | null
  closed_reason: string | null
  closed_note: string | null
  closed_at: string | null
  override_by: string | null
  override_reason: string | null
  override_at: string | null
  recording_date: string | null
  consent_confirmed: boolean
  seats_filled: boolean
  will_share: boolean | null
  content_calendar_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type CandidateScoreRow = {
  id: string
  candidate_id: string
  computed_at: string
  weights_version: string
  chance_of_yes: number
  reach: number
  timeliness: number
  followup: number
  mission: number
  format_fit: number
  total: number
  explanation: unknown
  computed_by: string | null
}

export type InvitationRow = {
  id: string
  candidate_id: string
  kind: string
  introduction_request_id: string | null
  sent_by: string | null
  sent_at: string
  message_text: string | null
  nudged_at: string | null
  response: string | null
  responded_at: string | null
  recall_date: string | null
  notes: string | null
  created_at: string
}

export type PlanningDatabase = ModuleDatabase<{
  podcast_questions: ModuleTable<QuestionRow>
  podcast_question_candidates: ModuleTable<CandidateRow>
  podcast_candidate_scores: ModuleTable<CandidateScoreRow>
  podcast_invitations: ModuleTable<InvitationRow>
}>
