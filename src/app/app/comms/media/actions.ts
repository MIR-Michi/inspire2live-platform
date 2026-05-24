'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { parseTagInput, type MediaAssetType, type MediaRightsStatus } from '@/lib/comms-media'

export interface MediaFormState {
  ok: boolean
  message?: string
  error?: string
}

const INITIAL_STATE: MediaFormState = { ok: false }

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
    .select('id, role, comms_team, user_type')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!profile || !canAccessCommsWorkspace(profile.role, profile.comms_team, profile.user_type)) {
    throw new Error('Not authorized for the communications workspace')
  }

  return { supabase, userId: user.id }
}

export async function createMediaAsset(
  _prevState: MediaFormState = INITIAL_STATE,
  formData: FormData
): Promise<MediaFormState> {
  try {
    const { supabase, userId } = await requireCommsOperator()
    const title = asText(formData.get('title'))
    const assetType = asText(formData.get('asset_type')) as MediaAssetType
    const sharepointUrl = asText(formData.get('sharepoint_url')) || null
    const eventId = asText(formData.get('event_id')) || null
    const sessionId = asText(formData.get('session_id')) || null
    const initiativeId = asText(formData.get('initiative_id')) || null
    const rightsStatus = asText(formData.get('rights_status')) as MediaRightsStatus
    const tags = parseTagInput(asText(formData.get('tags')))

    if (!title || !assetType) {
      return { ok: false, error: 'Title and asset type are required.' }
    }

    const { error } = await supabase.from('media_assets').insert({
      title,
      asset_type: assetType,
      sharepoint_url: sharepointUrl,
      event_id: eventId,
      session_id: sessionId,
      initiative_id: initiativeId,
      rights_status: rightsStatus || 'internal_only',
      tags,
      contributed_by: userId,
    })

    if (error) throw new Error(error.message)

    revalidatePath('/app/comms/media')
    return { ok: true, message: 'Media asset added to the library.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not create media asset.' }
  }
}

export async function resolveRecoveryRequest(
  _prevState: MediaFormState = INITIAL_STATE,
  formData: FormData
): Promise<MediaFormState> {
  try {
    const { supabase, userId } = await requireCommsOperator()
    const recoveryRequestId = asText(formData.get('recovery_request_id'))
    const title = asText(formData.get('title'))
    const assetType = asText(formData.get('asset_type')) as MediaAssetType
    const sharepointUrl = asText(formData.get('sharepoint_url'))
    const rightsStatus = asText(formData.get('rights_status')) as MediaRightsStatus
    const resolutionNotes = asText(formData.get('resolution_notes')) || null
    const tags = parseTagInput(asText(formData.get('tags')))

    if (!recoveryRequestId || !title || !assetType || !sharepointUrl) {
      return { ok: false, error: 'Recovery, title, type, and SharePoint URL are required.' }
    }

    const { data: request, error: requestError } = await supabase
      .from('media_recovery_requests')
      .select('id, event_id, session_id, initiative_id, status')
      .eq('id', recoveryRequestId)
      .maybeSingle()

    if (requestError) throw new Error(requestError.message)
    if (!request) throw new Error('Recovery request not found.')
    if (request.status === 'resolved') throw new Error('Recovery request is already resolved.')

    const { data: asset, error: assetError } = await supabase
      .from('media_assets')
      .insert({
        title,
        asset_type: assetType,
        sharepoint_url: sharepointUrl,
        event_id: request.event_id,
        session_id: request.session_id,
        initiative_id: request.initiative_id,
        rights_status: rightsStatus || 'needs_clearance',
        tags,
        contributed_by: userId,
      })
      .select('id')
      .maybeSingle()

    if (assetError) throw new Error(assetError.message)

    const { error: resolveError } = await supabase
      .from('media_recovery_requests')
      .update({
        status: 'resolved',
        resolved_asset_id: asset?.id ?? null,
        resolved_at: new Date().toISOString(),
        resolution_notes: resolutionNotes,
      })
      .eq('id', recoveryRequestId)

    if (resolveError) throw new Error(resolveError.message)

    revalidatePath('/app/comms/media')
    if (asset?.id) revalidatePath(`/app/comms/media/${asset.id}`)
    return { ok: true, message: 'Recovery resolved and asset added to the library.' }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not resolve media recovery request.',
    }
  }
}
