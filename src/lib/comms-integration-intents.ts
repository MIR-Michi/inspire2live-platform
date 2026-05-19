import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'
import type { IntegrationTarget } from '@/lib/comms-integrations'

type AppSupabaseClient = SupabaseClient<Database>

type IntegrationEntityType =
  | 'content_calendar'
  | 'events'
  | 'campus_sessions'
  | 'media_assets'
  | 'media_recovery_requests'

export async function logIntegrationIntent(
  supabase: AppSupabaseClient,
  params: {
    target: IntegrationTarget
    actionName: string
    requestedBy: string
    entityType: IntegrationEntityType
    entityId: string
    payload?: Json
  }
) {
  const { error } = await supabase.from('comms_integration_intents').insert({
    integration_target: params.target,
    action_name: params.actionName,
    requested_by: params.requestedBy,
    entity_type: params.entityType,
    entity_id: params.entityId,
    payload: params.payload ?? {},
  })

  if (error) throw new Error(error.message)
}
