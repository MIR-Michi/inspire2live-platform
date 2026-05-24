'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { getIntegrationStubFlags, type IntegrationTarget } from '@/lib/comms-integrations'
import { logIntegrationIntent } from '@/lib/comms-integration-intents'

export interface StubActionState {
  ok: boolean
  message?: string
  error?: string
}

const INITIAL_STATE: StubActionState = { ok: false }

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

  return { supabase, userId: user.id, role: profile.role }
}

async function triggerStub(
  _prevState: StubActionState,
  formData: FormData,
  params: {
    target: IntegrationTarget
    entityType: 'content_calendar' | 'events' | 'campus_sessions' | 'media_assets' | 'media_recovery_requests'
    actionName: string
    successMessage: string
    revalidatePathname: string
    adminOnly?: boolean
  }
): Promise<StubActionState> {
  try {
    const flags = getIntegrationStubFlags()
    if (!flags[params.target]) {
      return { ok: false, error: `${params.target} stub is currently disabled.` }
    }

    const { supabase, userId, role } = await requireCommsOperator()
    if (params.adminOnly && role !== 'PlatformAdmin') {
      return { ok: false, error: 'This stub is available to PlatformAdmin only.' }
    }

    const entityId = asText(formData.get('entity_id'))
    if (!entityId) return { ok: false, error: 'Entity is required.' }

    await logIntegrationIntent(supabase, {
      target: params.target,
      actionName: params.actionName,
      requestedBy: userId,
      entityType: params.entityType,
      entityId,
      payload: {
        note: 'Phase 1 no-op integration stub',
      },
    })

    revalidatePath(params.revalidatePathname)
    return { ok: true, message: params.successMessage }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not log integration intent.' }
  }
}

export async function triggerWordpressPublishStub(
  prevState: StubActionState = INITIAL_STATE,
  formData: FormData
) {
  return triggerStub(prevState, formData, {
    target: 'wordpress',
    entityType: 'content_calendar',
    actionName: 'publish_stub',
    successMessage: 'WordPress publish intent logged for Phase 2 follow-up.',
    revalidatePathname: '/app/comms/calendar',
    adminOnly: true,
  })
}

export async function triggerLinkedInScheduleStub(
  prevState: StubActionState = INITIAL_STATE,
  formData: FormData
) {
  return triggerStub(prevState, formData, {
    target: 'linkedin',
    entityType: 'content_calendar',
    actionName: 'schedule_stub',
    successMessage: 'LinkedIn schedule intent logged.',
    revalidatePathname: '/app/comms/calendar',
  })
}

export async function triggerMailchimpDraftStub(
  prevState: StubActionState = INITIAL_STATE,
  formData: FormData
) {
  return triggerStub(prevState, formData, {
    target: 'mailchimp',
    entityType: 'content_calendar',
    actionName: 'newsletter_draft_stub',
    successMessage: 'Mailchimp draft intent logged.',
    revalidatePathname: '/app/comms/calendar',
  })
}

export async function triggerOutlookDraftStub(
  prevState: StubActionState = INITIAL_STATE,
  formData: FormData
) {
  return triggerStub(prevState, formData, {
    target: 'outlook',
    entityType: 'content_calendar',
    actionName: 'email_draft_stub',
    successMessage: 'Outlook draft intent logged.',
    revalidatePathname: '/app/comms/calendar',
  })
}

export async function triggerSharePointBrowseStub(
  prevState: StubActionState = INITIAL_STATE,
  formData: FormData
) {
  return triggerStub(prevState, formData, {
    target: 'sharepoint',
    entityType: asText(formData.get('entity_type')) as
      | 'content_calendar'
      | 'events'
      | 'campus_sessions'
      | 'media_assets'
      | 'media_recovery_requests',
    actionName: 'browse_stub',
    successMessage: 'SharePoint browse intent logged. Phase 1 still uses pasted links.',
    revalidatePathname: '/app/comms/media',
  })
}

export async function triggerEventTeamsStub(
  prevState: StubActionState = INITIAL_STATE,
  formData: FormData
) {
  return triggerStub(prevState, formData, {
    target: 'teams',
    entityType: 'events',
    actionName: 'teams_meeting_stub',
    successMessage: 'Teams meeting intent logged for this event.',
    revalidatePathname: `/app/comms/events/${asText(formData.get('entity_id'))}`,
  })
}

export async function triggerSessionTeamsStub(
  prevState: StubActionState = INITIAL_STATE,
  formData: FormData
) {
  return triggerStub(prevState, formData, {
    target: 'teams',
    entityType: 'campus_sessions',
    actionName: 'teams_meeting_stub',
    successMessage: 'Teams meeting intent logged for this session.',
    revalidatePathname: `/app/comms/campus-log/sessions/${asText(formData.get('entity_id'))}`,
  })
}
