'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { encryptAiSecret, secretLast4 } from '@/lib/ai/crypto'
import { testAiConnection } from '@/lib/ai/client'
import {
  AI_WORKLOAD_POLICIES,
  normalizeAiEffort,
  normalizeAiModel,
  normalizeAiModelSelection,
  validateAiModelEffort,
  type AiWorkloadOverrides,
} from '@/lib/ai/models'

async function requirePlatformAdmin(): Promise<{ id: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'PlatformAdmin') return null

  return { id: user.id }
}

function go(params: Record<string, string>): never {
  redirect(`/app/admin/ai?${new URLSearchParams(params).toString()}`)
}

export async function saveAiSettings(formData: FormData): Promise<void> {
  const user = await requirePlatformAdmin()
  if (!user) go({ status: 'error', message: 'Forbidden' })

  const model = normalizeAiModel(String(formData.get('model') ?? ''))
  const effort = normalizeAiEffort(model, String(formData.get('effort') ?? ''))
  const validation = validateAiModelEffort(model, effort)
  if (!validation.ok) go({ status: 'error', message: validation.message })

  const modelOverrides: AiWorkloadOverrides = {}
  for (const policy of AI_WORKLOAD_POLICIES) {
    const selection = normalizeAiModelSelection(
      String(formData.get(`workload_${policy.id}_model`) ?? policy.recommendedModel),
      String(formData.get(`workload_${policy.id}_effort`) ?? policy.recommendedEffort),
      { model: policy.recommendedModel, effort: policy.recommendedEffort },
    )
    const workloadValidation = validateAiModelEffort(selection.model, selection.effort)
    if (!workloadValidation.ok) {
      go({ status: 'error', message: `${policy.label}: ${workloadValidation.message}` })
    }
    modelOverrides[policy.id] = selection
  }

  const credential = String(formData.get('credential') ?? '').trim()
  const clearCredential = formData.get('clearCredential') === 'on'

  const payload: Record<string, unknown> = {
    singleton: true,
    model,
    effort,
    model_overrides: modelOverrides,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }

  if (clearCredential) {
    payload.api_key_ciphertext = null
    payload.api_key_last4 = null
  } else if (credential) {
    payload.api_key_ciphertext = encryptAiSecret(credential)
    payload.api_key_last4 = secretLast4(credential)
  }

  const db = createAdminClient() as unknown as {
    from: (table: string) => {
      upsert: (payload: Record<string, unknown>, options: { onConflict: string }) => Promise<{ error: { message: string } | null }>
    }
  }

  const { error } = await db.from('ai_settings').upsert(payload, { onConflict: 'singleton' })
  if (error) go({ status: 'error', message: error.message })

  revalidatePath('/app/admin/ai')
  go({ status: 'saved' })
}

export async function testAiSettingsConnection(formData: FormData): Promise<void> {
  const user = await requirePlatformAdmin()
  if (!user) go({ status: 'error', message: 'Forbidden' })

  const model = normalizeAiModel(String(formData.get('model') ?? ''))
  const effort = normalizeAiEffort(model, String(formData.get('effort') ?? ''))
  const credential = String(formData.get('credential') ?? '').trim() || undefined

  const result = await testAiConnection({ apiKeyOverride: credential, model, effort })
  if (!result.ok) go({ status: 'test-error', message: result.error.slice(0, 160) })

  go({ status: 'test-ok', model: result.model, source: result.source, latency: String(result.latencyMs) })
}
