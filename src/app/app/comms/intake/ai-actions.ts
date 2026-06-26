'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { classifyIntakeItem, toClassifierRules, type IntakeClassifierConfidence, type PersistedClassifierReason } from '@/lib/comms-classifier'
import { structureIntakeItem, type StructuredIntakeSuggestion } from '@/lib/ai/intake-structure'
import type { IntakeContentType } from '@/lib/comms-workflow'
import type { Database } from '@/types/database'

export interface IntakeAiActionState {
  ok: boolean
  message?: string
  error?: string
}

const INITIAL_STATE: IntakeAiActionState = { ok: false }

type AppSupabaseClient = SupabaseClient<Database>
type IntakeItemRow = Database['public']['Tables']['intake_items']['Row']
type ClassifierRuleRow = Database['public']['Tables']['intake_classifier_rules']['Row']

type IntakeAiSuggestionRow = {
  id: string
  intake_item_id: string
  source: 'ai' | 'deterministic_fallback' | 'batch'
  content_type: IntakeContentType
  summary: string
  entities: unknown
  suggested_channel: string | null
  suggested_action: string
  founder_signal: boolean
  confidence: IntakeClassifierConfidence
  rationale: string | null
  model: string | null
  effort: string | null
  raw_response: unknown
  status: 'pending' | 'applied' | 'dismissed' | 'superseded'
}

function asText(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : ''
}

async function requireCommsOperator() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, name, email, role')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!profile || !canAccessCommsWorkspace(profile.role)) {
    throw new Error('Not authorized for the communications workspace')
  }

  return { supabase, user, profile }
}

async function loadEnabledClassifierRules(supabase: AppSupabaseClient) {
  const { data, error } = await supabase
    .from('intake_classifier_rules')
    .select(
      'id, rule_name, description, match_field, match_type, pattern, suggested_content_type, suggested_confidence, marks_peter, priority'
    )
    .eq('is_enabled', true)
    .order('priority', { ascending: false })

  if (error) throw new Error(error.message)
  return toClassifierRules((data ?? []) as ClassifierRuleRow[])
}

function serializeSuggestion(suggestion: StructuredIntakeSuggestion, intakeItemId: string, userId: string) {
  return {
    intake_item_id: intakeItemId,
    source: suggestion.source,
    content_type: suggestion.contentType,
    summary: suggestion.summary,
    entities: suggestion.entities,
    suggested_channel: suggestion.suggestedChannel,
    suggested_action: suggestion.suggestedAction,
    founder_signal: suggestion.founderSignal,
    confidence: suggestion.confidence,
    rationale: suggestion.rationale,
    model: suggestion.model ?? null,
    effort: suggestion.effort ?? null,
    raw_response: suggestion.rawResponse ?? {},
    status: 'pending',
    created_by: userId,
  }
}

function buildAppliedReasoning(suggestion: IntakeAiSuggestionRow): PersistedClassifierReason[] {
  const sourceLabel = suggestion.source === 'ai' ? 'Claude structure suggestion' : 'Deterministic fallback suggestion'
  const reasons: PersistedClassifierReason[] = [
    {
      ruleId: `s14:${suggestion.source}:content-type`,
      label: sourceLabel,
      evidence: suggestion.rationale || suggestion.summary,
      effect: 'type',
    },
    {
      ruleId: `s14:${suggestion.source}:confidence`,
      label: 'Suggested confidence',
      evidence: suggestion.confidence,
      effect: 'confidence',
    },
  ]

  if (suggestion.founder_signal) {
    reasons.unshift({
      ruleId: `s14:${suggestion.source}:founder-signal`,
      label: 'Founder signal suggested',
      evidence: 'AI or deterministic structure marked this as founder-relevant.',
      effect: 'founder_signal',
    })
  }

  return reasons
}

export async function generateIntakeAiSuggestion(
  _prevState: IntakeAiActionState = INITIAL_STATE,
  formData: FormData
): Promise<IntakeAiActionState> {
  try {
    const { supabase, user } = await requireCommsOperator()
    const intakeItemId = asText(formData.get('intake_item_id'))
    if (!intakeItemId) return { ok: false, error: 'Item is required.' }

    const { data: item, error: loadError } = await supabase
      .from('intake_items')
      .select('id, sender_name, raw_content, source_url, attached_media_ref')
      .eq('id', intakeItemId)
      .maybeSingle()

    if (loadError) throw new Error(loadError.message)
    if (!item) throw new Error('Intake item not found.')

    const rules = await loadEnabledClassifierRules(supabase)
    const deterministic = classifyIntakeItem(
      {
        senderName: item.sender_name,
        rawContent: item.raw_content,
        sourceUrl: item.source_url,
        attachedMediaRef: item.attached_media_ref,
      },
      rules
    )

    const suggestion = await structureIntakeItem({
      id: item.id,
      senderName: item.sender_name,
      rawContent: item.raw_content,
      sourceUrl: item.source_url,
      attachedMediaRef: item.attached_media_ref,
      createdBy: user.id,
      deterministicRules: rules,
    })

    const db = supabase as unknown as {
      from: (table: 'intake_ai_suggestions') => {
        update: (payload: Record<string, unknown>) => { eq: (column: string, value: string) => { eq: (column: string, value: string) => Promise<{ error: { message: string } | null }> } }
        insert: (payload: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
      }
    }

    const supersede = await db
      .from('intake_ai_suggestions')
      .update({ status: 'superseded' })
      .eq('intake_item_id', intakeItemId)
      .eq('status', 'pending')
    if (supersede.error) throw new Error(supersede.error.message)

    const insert = await db.from('intake_ai_suggestions').insert(
      serializeSuggestion(
        suggestion.source === 'deterministic_fallback'
          ? { ...suggestion, confidence: deterministic.confidence, founderSignal: deterministic.isPeterKapitein || suggestion.founderSignal }
          : suggestion,
        intakeItemId,
        user.id
      )
    )
    if (insert.error) throw new Error(insert.error.message)

    revalidatePath('/app/comms/intake')
    return {
      ok: true,
      message: suggestion.source === 'ai' ? 'AI suggestion generated for review.' : 'AI unavailable; deterministic fallback suggestion generated.',
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not generate AI suggestion.' }
  }
}

export async function applyIntakeAiSuggestion(
  _prevState: IntakeAiActionState = INITIAL_STATE,
  formData: FormData
): Promise<IntakeAiActionState> {
  try {
    const { supabase, user } = await requireCommsOperator()
    const suggestionId = asText(formData.get('suggestion_id'))
    if (!suggestionId) return { ok: false, error: 'Suggestion is required.' }

    const db = supabase as unknown as {
      from: (table: string) => {
        select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: IntakeAiSuggestionRow | IntakeItemRow | null; error: { message: string } | null }> } }
        update: (payload: Record<string, unknown>) => { eq: (column: string, value: string) => Promise<{ error: { message: string } | null }> }
      }
    }

    const { data, error: loadError } = await db
      .from('intake_ai_suggestions')
      .select('id, intake_item_id, source, content_type, summary, entities, suggested_channel, suggested_action, founder_signal, confidence, rationale, model, effort, raw_response, status')
      .eq('id', suggestionId)
      .maybeSingle()

    if (loadError) throw new Error(loadError.message)
    const suggestion = data as IntakeAiSuggestionRow | null
    if (!suggestion) throw new Error('AI suggestion not found.')
    if (suggestion.status !== 'pending') throw new Error('Only pending AI suggestions can be applied.')

    const itemUpdate = await db.from('intake_items').update({
      content_type: suggestion.content_type,
      classification_confidence: suggestion.confidence,
      is_peter_kapitein: suggestion.founder_signal,
      classifier_version: `s14-intake-structure:${suggestion.source}`,
      classifier_status: 'auto_classified',
      classifier_reasoning: buildAppliedReasoning(suggestion),
      classifier_rule_ids: [`s14:${suggestion.source}`],
    }).eq('id', suggestion.intake_item_id)
    if (itemUpdate.error) throw new Error(itemUpdate.error.message)

    const suggestionUpdate = await db.from('intake_ai_suggestions').update({
      status: 'applied',
      applied_by: user.id,
      applied_at: new Date().toISOString(),
    }).eq('id', suggestion.id)
    if (suggestionUpdate.error) throw new Error(suggestionUpdate.error.message)

    revalidatePath('/app/comms/intake')
    return { ok: true, message: 'AI suggestion applied. Review the route before confirming.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not apply AI suggestion.' }
  }
}

export async function dismissIntakeAiSuggestion(
  _prevState: IntakeAiActionState = INITIAL_STATE,
  formData: FormData
): Promise<IntakeAiActionState> {
  try {
    const { supabase } = await requireCommsOperator()
    const suggestionId = asText(formData.get('suggestion_id'))
    if (!suggestionId) return { ok: false, error: 'Suggestion is required.' }

    const db = supabase as unknown as {
      from: (table: string) => {
        update: (payload: Record<string, unknown>) => { eq: (column: string, value: string) => Promise<{ error: { message: string } | null }> }
      }
    }

    const { error } = await db.from('intake_ai_suggestions').update({ status: 'dismissed' }).eq('id', suggestionId)
    if (error) throw new Error(error.message)

    revalidatePath('/app/comms/intake')
    return { ok: true, message: 'AI suggestion dismissed.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not dismiss AI suggestion.' }
  }
}
