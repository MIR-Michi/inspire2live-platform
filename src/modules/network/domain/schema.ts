/**
 * network/domain/schema.ts — the row shapes this component owns.
 *
 * Declared here because the component owns these tables (ADR-0009 §3) and
 * `src/types/database.ts` is only regenerated against a migrated database. See
 * `@/kernel/data/module-schema` for why this exists instead of `as any`.
 * Delete this file and switch to the generated types once they include
 * migration 00171.
 */

import type { ModuleDatabase, ModuleTable, ModuleView } from '@/kernel/data'

export type PersonRow = {
  id: string
  full_name: string
  role_title: string | null
  organisation: string | null
  country: string | null
  languages: string[]
  topic_tags: string[]
  what_they_can_say: string | null
  public_profile_urls: unknown
  audience_indicators: unknown
  shares_own_appearances: boolean | null
  podcast_appearances: unknown
  institutional_friction: string
  industry_relationship: string | null
  origin: string
  crm_contact_id: string | null
  profile_id: string | null
  source_attribution: unknown
  objection_received: boolean
  objection_recorded_at: string | null
  notes: string | null
  last_reviewed_at: string | null
  last_activity_at: string
  created_by: string | null
  created_at: string
  updated_at: string
}

/** The published read contract — no objection flag, because it cannot appear. */
export type PersonPublicRow = Omit<
  PersonRow,
  'objection_received' | 'objection_recorded_at' | 'notes' | 'last_activity_at' | 'created_by' | 'created_at' | 'updated_at'
>

export type PersonAffiliationRow = {
  id: string
  person_id: string
  kind: string
  name: string
  from_year: number | null
  to_year: number | null
  source_url: string | null
  created_at: string
}

export type MemberAffiliationRow = {
  id: string
  profile_id: string
  kind: string
  name: string
  from_year: number | null
  to_year: number | null
  visibility: string
  created_at: string
  updated_at: string
}

export type ConnectionRow = {
  id: string
  from_type: string
  from_id: string
  to_type: string
  to_id: string
  connection_type: string
  strength: number
  evidence: unknown
  status: string
  confirmed_by: string | null
  confirmed_at: string | null
  created_at: string
  updated_at: string
}

export type ConnectionCheckRow = {
  id: string
  profile_id: string
  person_id: string
  context_note: string | null
  asked_by: string | null
  asked_at: string
  answer: string | null
  answer_note: string | null
  answered_at: string | null
}

export type IntroductionRequestRow = {
  id: string
  context_type: string
  context_id: string | null
  context_summary: string | null
  introducer_profile_id: string
  person_id: string
  connection_id: string | null
  requested_by: string | null
  requested_at: string
  response: string | null
  responded_at: string | null
  intro_sent_at: string | null
  outcome: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type NetworkDatabase = ModuleDatabase<
  {
    network_people: ModuleTable<PersonRow>
    network_person_affiliations: ModuleTable<PersonAffiliationRow>
    network_member_affiliations: ModuleTable<MemberAffiliationRow>
    network_connections: ModuleTable<ConnectionRow>
    network_connection_checks: ModuleTable<ConnectionCheckRow>
    network_introduction_requests: ModuleTable<IntroductionRequestRow>
  },
  {
    network_people_public: ModuleView<PersonPublicRow>
  }
>
