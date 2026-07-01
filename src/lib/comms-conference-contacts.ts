import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Shared CRM-contact resolution for every conference flow.
 *
 * "Assign attendees", the single "Invite guest" link, and the bulk guest
 * invite all need the same thing: take a picked contact id OR a typed
 * name/email/WhatsApp, and end up with a canonical CRM contact. This used to be
 * implemented three times with subtly different rules (email required vs
 * optional, different dedupe, different tags), so a manual guest could be saved
 * to the CRM in one flow and silently dropped in another. This is the single
 * source of truth: explicit id → dedupe by normalized email → insert.
 */

export type ResolveContactInput = {
  contactId?: string | null
  fullName?: string | null
  email?: string | null
  whatsappId?: string | null
  /**
   * When false, a manual entry that doesn't match an existing contact is
   * returned transiently (no row inserted). Defaults to true.
   */
  createIfMissing?: boolean
  /** Labeling applied only when a new CRM row is created. */
  sourceLabel?: string
  tags?: string[]
  notes?: string | null
}

export type ResolvedCrmContact = {
  /** Present once the contact is persisted (existing or newly created). */
  contactId?: string
  fullName: string
  email: string | null
  whatsappId: string | null
  /** True when this call inserted a new CRM row. */
  created: boolean
}

const COLUMNS = 'id, full_name, email, phone, whatsapp_id'

function normalizeEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase()
  return email && email.includes('@') ? email : null
}

function clean(value: string | null | undefined, max = 200): string | null {
  const text = value?.trim()
  return text ? text.slice(0, max) : null
}

function fromRow(row: Record<string, unknown>): ResolvedCrmContact {
  return {
    contactId: String(row.id),
    fullName: String(row.full_name ?? 'Unnamed contact'),
    email: clean(String(row.email ?? '')),
    whatsappId: clean(String(row.whatsapp_id ?? '')) ?? clean(String(row.phone ?? '')),
    created: false,
  }
}

/**
 * Resolve a CRM contact for a conference flow, creating one when needed.
 * Throws on a hard error (bad id, DB failure); callers convert to their own
 * result shape. Must be called with a service-role (admin) client.
 */
export async function resolveOrCreateCrmContact(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, any, any>,
  userId: string,
  input: ResolveContactInput
): Promise<ResolvedCrmContact> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  const contactId = clean(input.contactId, 80)
  if (contactId) {
    const { data, error } = await db.from('comms_crm_contacts').select(COLUMNS).eq('id', contactId).maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new Error('CRM contact not found.')
    return fromRow(data)
  }

  const fullName = clean(input.fullName, 180)
  const email = normalizeEmail(input.email)
  const whatsappId = clean(input.whatsappId, 120)
  if (!fullName) throw new Error('Add a contact name.')
  if (!email && !whatsappId) throw new Error('Add an email address or WhatsApp number.')

  // Dedupe on the normalized email so we never create a second row for someone
  // who is already in the CRM.
  if (email) {
    const { data, error } = await db.from('comms_crm_contacts').select(COLUMNS).eq('normalized_email', email).maybeSingle()
    if (error) throw new Error(error.message)
    if (data) return fromRow(data)
  }

  if (input.createIfMissing === false) {
    return { fullName, email, whatsappId, created: false }
  }

  const contactKind = email?.endsWith('@inspire2live.org') ? 'internal_contact' : 'external'
  const { data, error } = await db
    .from('comms_crm_contacts')
    .insert({
      segment: contactKind === 'external' ? 'external' : 'internal',
      source_type: 'manual',
      full_name: fullName,
      contact_kind: contactKind,
      platform_status: 'none',
      email,
      whatsapp_id: whatsappId,
      preferred_channel: whatsappId && email ? 'Email / WhatsApp' : whatsappId ? 'WhatsApp' : 'Email',
      lifecycle_stage: 'active',
      consent_status: 'unknown',
      source_label: input.sourceLabel ?? 'Conference contact',
      tags: input.tags ?? ['conference-guest'],
      notes: input.notes ?? null,
      created_by: userId,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .select(COLUMNS)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Could not create the CRM contact.')
  return { ...fromRow(data), created: true }
}
