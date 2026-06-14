'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { normalizeCrmPersonType } from '@/lib/comms-crm'

type CrmTableClient = {
  from: (table: string) => {
    // The comms_crm_* tables are not yet present in the generated Database types,
    // so the query builder chain is typed loosely here.
    /* eslint-disable @typescript-eslint/no-explicit-any */
    select: (...args: unknown[]) => any
    insert: (...args: unknown[]) => any
    update: (...args: unknown[]) => any
    upsert: (...args: unknown[]) => any
    delete: (...args: unknown[]) => any
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }
}

function asText(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : ''
}

function asNullableText(value: FormDataEntryValue | null) {
  const text = asText(value)
  return text || null
}

async function requireCommsOperator() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!profile || !canAccessCommsWorkspace(profile.role)) {
    throw new Error('Not authorized for the communications workspace')
  }

  return { supabase, user }
}

function revalidatePipelinePaths(pipelineId?: string) {
  revalidatePath('/app/comms/crm')
  revalidatePath('/app/comms/crm/pipelines')
  if (pipelineId) revalidatePath(`/app/comms/crm/pipelines/${pipelineId}`)
}

// ─── Pipelines ───────────────────────────────────────────────────────────────

export async function createPipeline(formData: FormData) {
  const { supabase, user } = await requireCommsOperator()
  const crmSupabase = supabase as unknown as CrmTableClient
  const name = asText(formData.get('name'))
  const description = asNullableText(formData.get('description'))
  const stageNamesRaw = asText(formData.get('stage_names'))

  if (!name) throw new Error('Pipeline name is required.')

  const { data: pipeline, error } = await crmSupabase
    .from('comms_crm_pipelines')
    .insert({ name, description, created_by: user.id })
    .select('id')
    .maybeSingle()
  if (error) throw new Error(error.message)

  const pipelineId = pipeline?.id as string | undefined
  if (!pipelineId) throw new Error('Unable to create pipeline.')

  const stageNames = stageNamesRaw
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean)

  if (stageNames.length > 0) {
    const { error: stagesError } = await crmSupabase.from('comms_crm_pipeline_stages').insert(
      stageNames.map((stageName, index) => ({
        pipeline_id: pipelineId,
        name: stageName,
        position: index,
      }))
    )
    if (stagesError) throw new Error(stagesError.message)
  }

  revalidatePipelinePaths(pipelineId)
  redirect(`/app/comms/crm/pipelines?pipeline=${pipelineId}`)
}

export async function updatePipeline(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const crmSupabase = supabase as unknown as CrmTableClient
  const pipelineId = asText(formData.get('pipeline_id'))
  const name = asText(formData.get('name'))
  const description = asNullableText(formData.get('description'))

  if (!pipelineId) throw new Error('Pipeline is required.')
  if (!name) throw new Error('Pipeline name is required.')

  const { error } = await crmSupabase
    .from('comms_crm_pipelines')
    .update({ name, description, updated_at: new Date().toISOString() })
    .eq('id', pipelineId)
  if (error) throw new Error(error.message)

  revalidatePipelinePaths(pipelineId)
}

export async function deletePipeline(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const crmSupabase = supabase as unknown as CrmTableClient
  const pipelineId = asText(formData.get('pipeline_id'))
  if (!pipelineId) throw new Error('Pipeline is required.')

  const { error } = await crmSupabase.from('comms_crm_pipelines').delete().eq('id', pipelineId)
  if (error) throw new Error(error.message)

  revalidatePipelinePaths()
  redirect('/app/comms/crm/pipelines')
}

// ─── Stages ──────────────────────────────────────────────────────────────────

export async function addPipelineStage(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const crmSupabase = supabase as unknown as CrmTableClient
  const pipelineId = asText(formData.get('pipeline_id'))
  const name = asText(formData.get('name'))
  if (!pipelineId || !name) throw new Error('Pipeline and stage name are required.')

  const { data: existingStages, error: countError } = await crmSupabase
    .from('comms_crm_pipeline_stages')
    .select('id')
    .eq('pipeline_id', pipelineId)
  if (countError) throw new Error(countError.message)

  const { error } = await crmSupabase.from('comms_crm_pipeline_stages').insert({
    pipeline_id: pipelineId,
    name,
    position: (existingStages ?? []).length,
  })
  if (error) throw new Error(error.message)

  revalidatePipelinePaths(pipelineId)
}

export async function renamePipelineStage(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const crmSupabase = supabase as unknown as CrmTableClient
  const stageId = asText(formData.get('stage_id'))
  const pipelineId = asText(formData.get('pipeline_id'))
  const name = asText(formData.get('name'))
  if (!stageId || !name) throw new Error('Stage and name are required.')

  const { error } = await crmSupabase.from('comms_crm_pipeline_stages').update({ name }).eq('id', stageId)
  if (error) throw new Error(error.message)

  revalidatePipelinePaths(pipelineId)
}

export async function moveStage(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const crmSupabase = supabase as unknown as CrmTableClient
  const pipelineId = asText(formData.get('pipeline_id'))
  const stageId = asText(formData.get('stage_id'))
  const direction = asText(formData.get('direction'))
  if (!pipelineId || !stageId) throw new Error('Stage is required.')

  const { data: stages, error } = await crmSupabase
    .from('comms_crm_pipeline_stages')
    .select('id, position')
    .eq('pipeline_id', pipelineId)
    .order('position', { ascending: true })
  if (error) throw new Error(error.message)

  const ordered = (stages ?? []) as Array<{ id: string; position: number }>
  const index = ordered.findIndex((stage) => stage.id === stageId)
  if (index === -1) return

  const swapWith = direction === 'up' ? index - 1 : index + 1
  if (swapWith < 0 || swapWith >= ordered.length) return

  const current = ordered[index]
  const target = ordered[swapWith]

  const [{ error: firstError }, { error: secondError }] = await Promise.all([
    crmSupabase.from('comms_crm_pipeline_stages').update({ position: target.position }).eq('id', current.id),
    crmSupabase.from('comms_crm_pipeline_stages').update({ position: current.position }).eq('id', target.id),
  ])
  if (firstError) throw new Error(firstError.message)
  if (secondError) throw new Error(secondError.message)

  revalidatePipelinePaths(pipelineId)
}

export async function removePipelineStage(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const crmSupabase = supabase as unknown as CrmTableClient
  const stageId = asText(formData.get('stage_id'))
  const pipelineId = asText(formData.get('pipeline_id'))
  if (!stageId) throw new Error('Stage is required.')

  const { error } = await crmSupabase.from('comms_crm_pipeline_stages').delete().eq('id', stageId)
  if (error) throw new Error(error.message)

  revalidatePipelinePaths(pipelineId)
}

// ─── Members ─────────────────────────────────────────────────────────────────

async function nextMemberPosition(crmSupabase: CrmTableClient, stageId: string) {
  const { data, error } = await crmSupabase.from('comms_crm_pipeline_members').select('id').eq('stage_id', stageId)
  if (error) throw new Error(error.message)
  return (data ?? []).length
}

/**
 * Adds a person to a pipeline stage. Supports three modes selected via the
 * `mode` field:
 *   - "existing":  link an already-known CRM contact by id
 *   - "ad_hoc":    create a lightweight CRM contact from just a name (so the
 *                  pipeline always resolves to one source of truth)
 *   - "invite":    create an internal CRM contact flagged for a platform
 *                  invitation (account provisioning itself is a follow-up —
 *                  see the connector backlog)
 */
export async function addPipelineMember(formData: FormData) {
  const { supabase, user } = await requireCommsOperator()
  const crmSupabase = supabase as unknown as CrmTableClient
  const stageId = asText(formData.get('stage_id'))
  const pipelineId = asText(formData.get('pipeline_id'))
  const mode = asText(formData.get('mode'))
  const note = asNullableText(formData.get('note'))

  if (!stageId) throw new Error('Stage is required.')

  let contactId = ''

  if (mode === 'existing') {
    contactId = asText(formData.get('contact_id'))
    if (!contactId) throw new Error('Choose a person to add.')
  } else if (mode === 'directory') {
    // A directory record (internal profile / campus member) that has no CRM row
    // yet. Materialise one, keyed by its source so it stays in sync, then link it.
    const rawSourceType = asText(formData.get('source_type'))
    const sourceType = rawSourceType === 'profile' || rawSourceType === 'campus_member' ? rawSourceType : 'manual'
    const sourceId = asNullableText(formData.get('source_id'))
    const fullName = asText(formData.get('full_name'))
    const segment = asText(formData.get('segment')) === 'internal' ? 'internal' : 'external'
    if (!fullName) throw new Error('A name is required.')

    if (sourceId) {
      const existing = await crmSupabase
        .from('comms_crm_contacts')
        .select('id')
        .eq('source_type', sourceType)
        .eq('source_id', sourceId)
        .maybeSingle()
      if (existing.error) throw new Error(existing.error.message)
      contactId = existing.data?.id ?? ''
    }

    if (!contactId) {
      const { data, error } = await crmSupabase
        .from('comms_crm_contacts')
        .insert({
          segment,
          source_type: sourceType,
          source_id: sourceId,
          full_name: fullName,
          source_label: 'Added from pipeline',
          lifecycle_stage: 'nurture',
          consent_status: segment === 'internal' ? 'not_required' : 'unknown',
          created_by: user.id,
          updated_by: user.id,
        })
        .select('id')
        .maybeSingle()
      if (error) throw new Error(error.message)
      contactId = data?.id ?? ''
    }
  } else if (mode === 'ad_hoc') {
    const fullName = asText(formData.get('full_name'))
    if (!fullName) throw new Error('A name is required.')

    const { data, error } = await crmSupabase
      .from('comms_crm_contacts')
      .insert({
        segment: 'external',
        source_type: 'manual',
        full_name: fullName,
        source_label: 'Added from pipeline',
        lifecycle_stage: 'nurture',
        consent_status: 'unknown',
        created_by: user.id,
        updated_by: user.id,
      })
      .select('id')
      .maybeSingle()
    if (error) throw new Error(error.message)
    contactId = data?.id ?? ''
  } else if (mode === 'invite') {
    const fullName = asText(formData.get('full_name'))
    const email = asNullableText(formData.get('email'))
    const personType = normalizeCrmPersonType(asText(formData.get('person_type')))
    if (!fullName || !email) throw new Error('Name and email are required to invite someone to the platform.')

    const { data, error } = await crmSupabase
      .from('comms_crm_contacts')
      .insert({
        segment: 'internal',
        source_type: 'manual',
        full_name: fullName,
        email,
        person_type: personType,
        source_label: 'Invited to the platform from pipeline',
        lifecycle_stage: 'nurture',
        consent_status: 'not_required',
        tags: ['platform-invite-requested'],
        created_by: user.id,
        updated_by: user.id,
      })
      .select('id')
      .maybeSingle()
    if (error) throw new Error(error.message)
    contactId = data?.id ?? ''

    if (contactId) {
      const { error: interactionError } = await crmSupabase.from('comms_crm_interactions').insert({
        contact_id: contactId,
        interaction_type: 'note',
        summary: `Platform invitation requested for ${email}${personType ? ` (${personType.replaceAll('_', ' ')})` : ''}. Account provisioning is handled outside the CRM — see the connector backlog.`,
        created_by: user.id,
      })
      if (interactionError) throw new Error(interactionError.message)
    }
  } else {
    throw new Error('Unknown way of adding a person.')
  }

  if (!contactId) throw new Error('Unable to resolve the person to add.')

  const position = await nextMemberPosition(crmSupabase, stageId)
  const { error: memberError } = await crmSupabase.from('comms_crm_pipeline_members').upsert(
    {
      stage_id: stageId,
      contact_id: contactId,
      note,
      position,
      added_by: user.id,
    },
    { onConflict: 'stage_id,contact_id' }
  )
  if (memberError) throw new Error(memberError.message)

  revalidatePipelinePaths(pipelineId)
}

export async function movePipelineMember(formData: FormData) {
  const { supabase, user } = await requireCommsOperator()
  const crmSupabase = supabase as unknown as CrmTableClient
  const memberId = asText(formData.get('member_id'))
  const pipelineId = asText(formData.get('pipeline_id'))
  const targetStageId = asText(formData.get('target_stage_id'))
  if (!memberId || !targetStageId) throw new Error('Member and target stage are required.')

  const { data: member, error: memberError } = await crmSupabase
    .from('comms_crm_pipeline_members')
    .select('id, contact_id, stage_id')
    .eq('id', memberId)
    .maybeSingle()
  if (memberError) throw new Error(memberError.message)
  if (!member || member.stage_id === targetStageId) return

  const position = await nextMemberPosition(crmSupabase, targetStageId)

  const { error } = await crmSupabase
    .from('comms_crm_pipeline_members')
    .update({ stage_id: targetStageId, position, added_by: user.id })
    .eq('id', memberId)
  if (error) throw new Error(error.message)

  revalidatePipelinePaths(pipelineId)
}

export async function removePipelineMember(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const crmSupabase = supabase as unknown as CrmTableClient
  const memberId = asText(formData.get('member_id'))
  const pipelineId = asText(formData.get('pipeline_id'))
  if (!memberId) throw new Error('Member is required.')

  const { error } = await crmSupabase.from('comms_crm_pipeline_members').delete().eq('id', memberId)
  if (error) throw new Error(error.message)

  revalidatePipelinePaths(pipelineId)
}
