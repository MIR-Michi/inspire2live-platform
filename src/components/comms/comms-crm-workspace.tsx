'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  addCrmInteraction,
  deleteCrmContact,
  inviteContactToPlatform,
  markCrmFollowUpDone,
  saveCrmContact,
} from '@/app/app/comms/crm/actions'
import {
  CRM_CONSENT_OPTIONS,
  CRM_CONTACT_KIND_OPTIONS,
  CRM_INTERACTION_OPTIONS,
  CRM_LIFECYCLE_OPTIONS,
  CRM_PERSON_TYPE_OPTIONS,
  formatCrmDate,
  formatCrmList,
  getCrmConsentLabel,
  getCrmContactKindLabel,
  getCrmHealthLabel,
  getCrmPersonTypeLabel,
  getCrmPlatformStatusLabel,
  getInitials,
  type CrmContactKind,
  type CrmContactRecord,
  type CrmSelectOption,
} from '@/lib/comms-crm'
import { ROLE_LABELS } from '@/lib/role-access'

const PLATFORM_ROLE_OPTIONS = (Object.entries(ROLE_LABELS) as [string, string][]).map(
  ([value, label]) => ({ value, label })
)

type CrmFilter = 'follow_up' | 'privacy_review' | null

function buildHref({
  kind,
  personType,
  filter,
  query,
}: {
  kind?: 'all' | CrmContactKind
  personType?: string
  filter?: CrmFilter
  query?: string
}) {
  const params = new URLSearchParams()
  if (kind && kind !== 'all') params.set('kind', kind)
  if (personType) params.set('type', personType)
  if (filter) params.set('filter', filter)
  if (query) params.set('q', query)
  return params.size > 0 ? `/app/comms/crm/people?${params.toString()}` : '/app/comms/crm/people'
}

function toneForKind(kind: CrmContactKind) {
  if (kind === 'internal_user') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (kind === 'internal_contact') return 'border-indigo-200 bg-indigo-50 text-indigo-700'
  return 'border-neutral-200 bg-neutral-50 text-neutral-600'
}

function toneForPlatformStatus(status: CrmContactRecord['platformStatus']) {
  if (status === 'active') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'invited') return 'border-amber-200 bg-amber-50 text-amber-800'
  if (status === 'inactive') return 'border-neutral-200 bg-neutral-100 text-neutral-500'
  return 'border-neutral-200 bg-white text-neutral-500'
}

function toneForHealth(value: CrmContactRecord['health']) {
  if (value === 'active') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (value === 'nurture') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (value === 'archived') return 'border-neutral-200 bg-neutral-50 text-neutral-600'
  return 'border-rose-200 bg-rose-50 text-rose-700'
}

function inputDate(value: string | null) {
  return value?.slice(0, 10) ?? ''
}

function ContactAvatar({ contact, size = 'md' }: { contact: CrmContactRecord; size?: 'sm' | 'md' }) {
  const dimension = size === 'sm' ? 'h-9 w-9 text-xs' : 'h-14 w-14 text-sm'
  if (contact.pictureUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={contact.pictureUrl}
        alt={contact.fullName}
        className={`${dimension} shrink-0 rounded-lg border border-neutral-200 object-cover`}
      />
    )
  }

  return (
    <div className={`${dimension} flex shrink-0 items-center justify-center rounded-lg bg-neutral-900 font-semibold text-white`}>
      {getInitials(contact.fullName)}
    </div>
  )
}

function OptionList({
  options,
  selectedIds,
  name,
  emptyLabel,
}: {
  options: CrmSelectOption[]
  selectedIds: string[]
  name: string
  emptyLabel: string
}) {
  if (options.length === 0) {
    return <p className="text-xs text-neutral-500">{emptyLabel}</p>
  }

  return (
    <select
      name={name}
      multiple
      defaultValue={selectedIds}
      className="min-h-28 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
    >
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.meta ? `${option.label} (${option.meta})` : option.label}
        </option>
      ))}
    </select>
  )
}

function ContactEditForm({
  contact,
  people,
  initiatives,
  events,
  onDone,
}: {
  contact: CrmContactRecord
  people: CrmSelectOption[]
  initiatives: CrmSelectOption[]
  events: CrmSelectOption[]
  onDone: () => void
}) {
  // Platform users (internal_user) are owned by their profile — their core
  // identity is read-only here and can only be changed by the person in Profile.
  const readOnlyCore = contact.contactKind === 'internal_user'

  return (
    <form action={saveCrmContact} onSubmit={onDone} className="mt-4 grid gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <input type="hidden" name="crm_contact_id" value={contact.crmContactId ?? ''} />
      <input type="hidden" name="source_type" value={contact.sourceType} />
      <input type="hidden" name="source_id" value={contact.sourceId ?? ''} />
      <input type="hidden" name="source_label" value={contact.sourceLabel} />

      {readOnlyCore ? (
        <div className="grid gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs font-semibold text-blue-900">
            Core profile details (name, picture, role, organisation, bio, expertise, location, email) are owned by this
            person&apos;s profile and stay in sync automatically. They can only be changed by the person themselves under
            Profile &amp; settings. You can still manage the relationship fields below.
          </p>
          <input type="hidden" name="full_name" value={contact.fullName} />
          <input type="hidden" name="segment" value="internal" />
          <input type="hidden" name="contact_kind" value="internal_user" />
          <dl className="grid gap-2 text-sm md:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Name</dt>
              <dd className="text-neutral-800">{contact.fullName}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Role / title</dt>
              <dd className="text-neutral-800">{contact.title ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Organisation</dt>
              <dd className="text-neutral-800">{contact.organisation ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Email</dt>
              <dd className="text-neutral-800">{contact.email ?? '—'}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-neutral-700">Name</span>
            <input name="full_name" defaultValue={contact.fullName} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" required />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-neutral-700">Contact type</span>
            <select name="contact_kind" defaultValue={contact.contactKind} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm">
              {CRM_CONTACT_KIND_OPTIONS.filter((o) => o.value !== 'internal_user').map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-neutral-700">Picture URL</span>
            <input name="picture_url" defaultValue={contact.pictureUrl ?? ''} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-neutral-700">Role / title</span>
            <input name="title" defaultValue={contact.title ?? ''} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-neutral-700">Organisation</span>
            <input name="organisation" defaultValue={contact.organisation ?? ''} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-neutral-700">Email</span>
            <input name="email" defaultValue={contact.email ?? ''} type="email" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-neutral-700">City</span>
            <input name="city" defaultValue={contact.city ?? ''} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-neutral-700">Country</span>
            <input name="country" defaultValue={contact.country ?? ''} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-semibold text-neutral-700">Bio</span>
            <textarea name="bio" defaultValue={contact.bio ?? ''} rows={3} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-neutral-700">Field of expertise</span>
            <input name="field_of_expertise" defaultValue={formatCrmList(contact.fieldOfExpertise)} placeholder="Comma separated" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-neutral-700">Skills</span>
            <input name="skills" defaultValue={formatCrmList(contact.skills)} placeholder="Comma separated" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
          </label>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Person type</span>
          <select name="person_type" defaultValue={contact.personType ?? ''} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm">
            <option value="">Unclassified</option>
            {CRM_PERSON_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Preferred channel</span>
          <input name="preferred_channel" defaultValue={contact.preferredChannel ?? ''} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Phone</span>
          <input name="phone" defaultValue={contact.phone ?? ''} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Relationship owner</span>
          <select name="relationship_owner_id" defaultValue={contact.relationshipOwnerId ?? ''} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm">
            <option value="">No owner assigned</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>{person.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Lifecycle</span>
          <select name="lifecycle_stage" defaultValue={contact.health} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm">
            {CRM_LIFECYCLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Consent</span>
          <select name="consent_status" defaultValue={contact.consentStatus} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm">
            {CRM_CONSENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Next follow-up</span>
          <input name="next_follow_up_at" type="date" defaultValue={inputDate(contact.nextFollowUpAt)} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Tags</span>
          <input name="tags" defaultValue={formatCrmList(contact.tags)} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
        </label>
        {contact.contactKind !== 'internal_user' && (
          <label className="space-y-1">
            <span className="text-xs font-semibold text-neutral-700">Intended role if invited (optional)</span>
            <select name="intended_role" defaultValue={contact.intendedRole ?? ''} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm">
              <option value="">No invite planned</option>
              {PLATFORM_ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Associated projects</span>
          <OptionList options={initiatives} selectedIds={contact.associatedProjectIds} name="initiative_ids" emptyLabel="No projects available." />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Associated events / podcast episodes</span>
          <OptionList options={events} selectedIds={contact.associatedEventIds} name="event_ids" emptyLabel="No events available." />
        </label>
      </div>

      <label className="space-y-1">
        <span className="text-xs font-semibold text-neutral-700">Notes</span>
        <textarea name="notes" defaultValue={contact.notes ?? ''} rows={3} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
      </label>

      <div className="flex gap-2">
        <button className="w-fit rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700">
          Save changes
        </button>
        <button type="button" onClick={onDone} className="w-fit rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
          Cancel
        </button>
      </div>
    </form>
  )
}

function NewContactForm({
  people,
  initiatives,
  events,
  onDone,
}: {
  people: CrmSelectOption[]
  initiatives: CrmSelectOption[]
  events: CrmSelectOption[]
  onDone: () => void
}) {
  return (
    <form action={saveCrmContact} onSubmit={onDone} className="grid gap-4">
      <input type="hidden" name="crm_contact_id" value="" />
      <input type="hidden" name="source_type" value="manual" />
      <input type="hidden" name="source_id" value="" />
      <input type="hidden" name="source_label" value="Manual CRM contact" />
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Name</span>
          <input name="full_name" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" required />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Contact type</span>
          <select name="contact_kind" defaultValue="internal_contact" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm">
            {CRM_CONTACT_KIND_OPTIONS.filter((o) => o.value !== 'internal_user').map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <span className="block text-[11px] text-neutral-400">New contacts are never platform users. Invite separately to grant access.</span>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Person type</span>
          <select name="person_type" defaultValue="" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm">
            <option value="">Unclassified</option>
            {CRM_PERSON_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Owner</span>
          <select name="relationship_owner_id" defaultValue="" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm">
            <option value="">Assign later</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>{person.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Role / title</span>
          <input name="title" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Organisation</span>
          <input name="organisation" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Email</span>
          <input name="email" type="email" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Next follow-up</span>
          <input name="next_follow_up_at" type="date" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
        </label>
      </div>
      <label className="space-y-1">
        <span className="text-xs font-semibold text-neutral-700">Bio</span>
        <textarea name="bio" rows={3} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Associated projects</span>
          <OptionList options={initiatives} selectedIds={[]} name="initiative_ids" emptyLabel="No projects available." />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Associated events / podcast episodes</span>
          <OptionList options={events} selectedIds={[]} name="event_ids" emptyLabel="No events available." />
        </label>
      </div>
      <input type="hidden" name="lifecycle_stage" value="nurture" />
      <input type="hidden" name="consent_status" value="unknown" />
      <div className="flex gap-2">
        <button className="w-fit rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700">
          Create contact
        </button>
        <button type="button" onClick={onDone} className="w-fit rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
          Cancel
        </button>
      </div>
    </form>
  )
}

function InteractionForm({ contact }: { contact: CrmContactRecord }) {
  if (!contact.crmContactId) {
    return <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Save this contact to CRM (use Edit) before adding interaction notes.</p>
  }

  return (
    <form action={addCrmInteraction} className="mt-2 grid gap-3 rounded-lg border border-neutral-200 bg-white p-4">
      <input type="hidden" name="crm_contact_id" value={contact.crmContactId} />
      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Type</span>
          <select name="interaction_type" defaultValue="note" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm">
            {CRM_INTERACTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Date</span>
          <input name="occurred_at" type="datetime-local" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Next follow-up</span>
          <input name="next_follow_up_at" type="date" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
        </label>
      </div>
      <label className="space-y-1">
        <span className="text-xs font-semibold text-neutral-700">Summary</span>
        <textarea name="summary" rows={2} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" required />
      </label>
      <button className="w-fit rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50">
        Add interaction
      </button>
    </form>
  )
}

function ContactDetail({
  contact,
  people,
  initiatives,
  events,
  isAdmin,
}: {
  contact: CrmContactRecord
  people: CrmSelectOption[]
  initiatives: CrmSelectOption[]
  events: CrmSelectOption[]
  isAdmin: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [addingInteraction, setAddingInteraction] = useState(false)
  const [inviting, setInviting] = useState(false)

  // Admins can delete any contact that is not a platform user — either a
  // dedicated CRM row or a World Campus record. Platform users are
  // profile-owned and never deletable here.
  const canDelete =
    isAdmin &&
    contact.contactKind !== 'internal_user' &&
    (Boolean(contact.crmContactId) || (contact.sourceType === 'campus_member' && Boolean(contact.sourceId)))

  // Admins can promote a non-user contact with an email to a platform user.
  const canInvite = isAdmin && contact.contactKind !== 'internal_user' && Boolean(contact.email)

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <ContactAvatar contact={contact} />
          <div className="min-w-0">
            <h3 className="text-xl font-semibold text-neutral-950">{contact.fullName}</h3>
            <p className="text-sm text-neutral-500">
              {[contact.title, contact.organisation].filter(Boolean).join(' · ') || 'Role and organisation to enrich'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${toneForKind(contact.contactKind)}`}>
                {getCrmContactKindLabel(contact.contactKind)}
              </span>
              {contact.platformStatus !== 'none' && (
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${toneForPlatformStatus(contact.platformStatus)}`}>
                  {getCrmPlatformStatusLabel(contact.platformStatus)}
                </span>
              )}
              <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-700">
                {getCrmPersonTypeLabel(contact.personType)}
              </span>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${toneForHealth(contact.health)}`}>
                {getCrmHealthLabel(contact.health)}
              </span>
              <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-800">
                Consent: {getCrmConsentLabel(contact.consentStatus)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!editing && (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
              >
                Edit
              </button>
              {canInvite && (
                <button
                  type="button"
                  onClick={() => setInviting((v) => !v)}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                >
                  Invite to platform
                </button>
              )}
              {canDelete && (
                <form
                  action={deleteCrmContact}
                  onSubmit={(event) => {
                    if (!confirm(`Delete ${contact.fullName}? This permanently removes this external contact and its CRM history.`)) {
                      event.preventDefault()
                    }
                  }}
                >
                  <input type="hidden" name="crm_contact_id" value={contact.crmContactId ?? ''} />
                  <input type="hidden" name="source_type" value={contact.sourceType} />
                  <input type="hidden" name="source_id" value={contact.sourceId ?? ''} />
                  <button className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100">
                    Delete
                  </button>
                </form>
              )}
            </>
          )}
          {contact.crmContactId && (
            <form action={markCrmFollowUpDone}>
              <input type="hidden" name="crm_contact_id" value={contact.crmContactId} />
              <button className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100">
                Mark followed up
              </button>
            </form>
          )}
        </div>
      </div>

      {inviting && canInvite && (
        <form
          action={inviteContactToPlatform}
          onSubmit={() => setInviting(false)}
          className="mt-4 grid gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end"
        >
          <input type="hidden" name="crm_contact_id" value={contact.crmContactId ?? ''} />
          <input type="hidden" name="email" value={contact.email ?? ''} />
          <input type="hidden" name="origin" value={typeof window !== 'undefined' ? window.location.origin : ''} />
          <label className="space-y-1">
            <span className="text-xs font-semibold text-blue-900">Invite {contact.fullName} as</span>
            <select name="role" defaultValue={contact.intendedRole ?? 'PatientAdvocate'} className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm">
              {PLATFORM_ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            Send invite
          </button>
          <button type="button" onClick={() => setInviting(false)} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">
            Cancel
          </button>
          <p className="text-[11px] text-blue-800 sm:col-span-3">
            Sends a User-Management invite to {contact.email}. They become an internal platform user once they accept; this contact links automatically — no duplicate is created.
          </p>
        </form>
      )}

      {editing ? (
        <ContactEditForm
          contact={contact}
          people={people}
          initiatives={initiatives}
          events={events}
          onDone={() => setEditing(false)}
        />
      ) : (
        <>
          <p className="mt-4 text-sm leading-6 text-neutral-600">
            {contact.bio || 'Bio not yet added.'}
          </p>

          {(contact.fieldOfExpertise.length > 0 || contact.skills.length > 0) && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {contact.fieldOfExpertise.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Field of expertise</p>
                  <div className="flex flex-wrap gap-2">
                    {contact.fieldOfExpertise.map((item) => (
                      <span key={item} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{item}</span>
                    ))}
                  </div>
                </div>
              )}
              {contact.skills.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Skills</p>
                  <div className="flex flex-wrap gap-2">
                    {contact.skills.map((item) => (
                      <span key={item} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{item}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Relationship owner</dt>
              <dd className="mt-1 text-neutral-700">{contact.relationshipOwner ?? 'Owner to assign'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Preferred channel</dt>
              <dd className="mt-1 text-neutral-700">{contact.preferredChannel ?? 'Not recorded'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Location</dt>
              <dd className="mt-1 text-neutral-700">{[contact.city, contact.country].filter(Boolean).join(', ') || 'Not recorded'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Email</dt>
              <dd className="mt-1 text-neutral-700">
                {contact.email ? (
                  <a href={`mailto:${contact.email}`} className="text-blue-700 hover:text-blue-900">{contact.email}</a>
                ) : 'Not recorded'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Last interaction</dt>
              <dd className="mt-1 text-neutral-700">{formatCrmDate(contact.lastInteractionAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Next follow-up</dt>
              <dd className="mt-1 text-neutral-700">{formatCrmDate(contact.nextFollowUpAt)}</dd>
            </div>
          </dl>

          {(contact.associatedProjects.length > 0 || contact.associatedEvents.length > 0) && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {contact.associatedProjects.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Associated projects</p>
                  <div className="flex flex-wrap gap-2">
                    {contact.associatedProjects.map((project) => (
                      <span key={project} className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">{project}</span>
                    ))}
                  </div>
                </div>
              )}
              {contact.associatedEvents.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Events / podcast links</p>
                  <div className="flex flex-wrap gap-2">
                    {contact.associatedEvents.map((event) => (
                      <span key={event} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{event}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {contact.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {contact.tags.slice(0, 12).map((tag) => (
                <span key={tag} className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-xs font-semibold text-neutral-600">#{tag}</span>
              ))}
            </div>
          )}

          {contact.notes && <p className="mt-4 text-sm leading-6 text-neutral-600">{contact.notes}</p>}

          {contact.recentInteractions.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Recent interactions</p>
              {contact.recentInteractions.map((interaction) => (
                <div key={interaction.id} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm">
                  <p className="font-semibold text-neutral-900">{interaction.type.replaceAll('_', ' ')} · {formatCrmDate(interaction.occurredAt)}</p>
                  <p className="mt-1 text-neutral-600">{interaction.summary}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4">
            {!addingInteraction ? (
              <button
                type="button"
                onClick={() => setAddingInteraction(true)}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
              >
                Add interaction
              </button>
            ) : (
              <InteractionForm contact={contact} />
            )}
          </div>
        </>
      )}
    </div>
  )
}

export function CommsCrmWorkspace({
  records,
  visibleRecords,
  activeKind,
  activePersonType,
  activeFilter,
  query,
  people,
  initiatives,
  events,
  crmReady,
  isAdmin,
}: {
  records: CrmContactRecord[]
  visibleRecords: CrmContactRecord[]
  activeKind: 'all' | CrmContactKind
  activePersonType: string
  activeFilter: CrmFilter
  query: string
  people: CrmSelectOption[]
  initiatives: CrmSelectOption[]
  events: CrmSelectOption[]
  crmReady: boolean
  isAdmin: boolean
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)

  const selected = visibleRecords.find((record) => record.id === selectedId) ?? null

  const userCount = records.filter((record) => record.contactKind === 'internal_user').length
  const internalContactCount = records.filter((record) => record.contactKind === 'internal_contact').length
  const externalCount = records.filter((record) => record.contactKind === 'external').length

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <Link href="/app/comms/crm" className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700 hover:text-orange-900">
          ← CRM
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold text-neutral-900">People</h2>
            <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-700">
              {visibleRecords.length} visible
            </span>
            <span className="text-sm text-neutral-500">{userCount} users · {internalContactCount} internal contacts · {externalCount} external</span>
          </div>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700"
          >
            <span className="text-base leading-none">+</span> Create contact
          </button>
        </div>
      </header>

      {!crmReady && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          CRM schema migration is not applied yet. Existing platform records are still visible, but saving CRM enrichment requires migration 00048.
        </div>
      )}

      <form className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <input type="hidden" name="kind" value={activeKind === 'all' ? '' : activeKind} />
        <input type="hidden" name="type" value={activePersonType} />
        <input type="hidden" name="filter" value={activeFilter ?? ''} />
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-neutral-800">Search people and stakeholders</span>
          <input
            name="q"
            defaultValue={query}
            placeholder="Search names, bio, projects, organisation, events, expertise, skills, or tags"
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          />
        </label>
      </form>

      <div className="space-y-3">
        <nav className="flex flex-wrap gap-2" aria-label="Contact type filters">
          <Link
            href={buildHref({ kind: 'all', personType: activePersonType, filter: activeFilter, query })}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${activeKind === 'all' ? 'bg-neutral-900 text-white' : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'}`}
          >
            All
          </Link>
          {CRM_CONTACT_KIND_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={buildHref({ kind: option.value, personType: activePersonType, filter: activeFilter, query })}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${activeKind === option.value ? 'bg-blue-100 text-blue-800' : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'}`}
            >
              {option.label}
            </Link>
          ))}
        </nav>

        <nav className="flex flex-wrap gap-2" aria-label="Person type filters">
          <Link
            href={buildHref({ kind: activeKind, filter: activeFilter, query })}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${!activePersonType ? 'bg-neutral-900 text-white' : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'}`}
          >
            Any type
          </Link>
          {CRM_PERSON_TYPE_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={buildHref({ kind: activeKind, personType: option.value, filter: activeFilter, query })}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${activePersonType === option.value ? 'bg-violet-100 text-violet-800' : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'}`}
            >
              {option.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Left: compact one-line list */}
        <div className="space-y-2">
          {visibleRecords.length === 0 && (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-12">
              <p className="text-sm font-semibold text-neutral-900">No people match this filter yet.</p>
              <p className="mt-2 text-sm text-neutral-600">Try a broader search or switch segment.</p>
            </div>
          )}

          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
            {visibleRecords.map((contact) => {
              const active = contact.id === selectedId
              return (
                <li key={contact.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(contact.id)}
                    aria-current={active ? 'true' : undefined}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${active ? 'bg-orange-50' : 'hover:bg-neutral-50'}`}
                  >
                    <ContactAvatar contact={contact} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-neutral-900">{contact.fullName}</span>
                      <span className="block truncate text-xs text-neutral-500">
                        {[contact.title, contact.organisation].filter(Boolean).join(' · ') || 'No role / organisation'}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${toneForKind(contact.contactKind)}`}
                    >
                      {getCrmContactKindLabel(contact.contactKind)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Right: detail pane */}
        <div className="xl:sticky xl:top-4 xl:self-start">
          {selected ? (
            <ContactDetail
              key={selected.id}
              contact={selected}
              people={people}
              initiatives={initiatives}
              events={events}
              isAdmin={isAdmin}
            />
          ) : (
            <div className="flex h-full min-h-48 items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-12 text-center">
              <p className="max-w-xs text-sm text-neutral-500">
                Select a person from the list to see their contact details here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New contact modal */}
      {showNew && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 sm:p-8"
          onClick={() => setShowNew(false)}
        >
          <div
            className="w-full max-w-2xl rounded-xl border border-neutral-200 bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-neutral-900">Create CRM contact</h3>
              <button
                type="button"
                onClick={() => setShowNew(false)}
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <NewContactForm
              people={people}
              initiatives={initiatives}
              events={events}
              onDone={() => setShowNew(false)}
            />
          </div>
        </div>
      )}
    </section>
  )
}
