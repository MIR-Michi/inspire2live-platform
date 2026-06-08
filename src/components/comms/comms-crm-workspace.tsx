import Link from 'next/link'
import {
  addCrmInteraction,
  markCrmFollowUpDone,
  saveCrmContact,
} from '@/app/app/comms/crm/actions'
import {
  CRM_CONSENT_OPTIONS,
  CRM_FIELD_GROUPS,
  CRM_INTERACTION_OPTIONS,
  CRM_LIFECYCLE_OPTIONS,
  CRM_PERSON_TYPE_OPTIONS,
  CRM_SEGMENT_OPTIONS,
  formatCrmDate,
  formatCrmList,
  getCrmConsentLabel,
  getCrmHealthLabel,
  getCrmPersonTypeLabel,
  getCrmSegmentLabel,
  getInitials,
  type CrmConnectorBacklogItem,
  type CrmContactRecord,
  type CrmSelectOption,
  type CrmSegment,
} from '@/lib/comms-crm'

type CrmFilter = 'follow_up' | 'privacy_review' | null

function buildHref({
  segment,
  personType,
  filter,
  query,
}: {
  segment?: 'all' | CrmSegment
  personType?: string
  filter?: CrmFilter
  query?: string
}) {
  const params = new URLSearchParams()
  if (segment && segment !== 'all') params.set('segment', segment)
  if (personType) params.set('type', personType)
  if (filter) params.set('filter', filter)
  if (query) params.set('q', query)
  return params.size > 0 ? `/app/comms/crm/people?${params.toString()}` : '/app/comms/crm/people'
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

function inputDateTime(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 16)
}

function ContactAvatar({ contact }: { contact: CrmContactRecord }) {
  if (contact.pictureUrl) {
    return (
      <img
        src={contact.pictureUrl}
        alt={contact.fullName}
        className="h-14 w-14 rounded-lg border border-neutral-200 object-cover"
      />
    )
  }

  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-neutral-900 text-sm font-semibold text-white">
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
}: {
  contact: CrmContactRecord
  people: CrmSelectOption[]
  initiatives: CrmSelectOption[]
  events: CrmSelectOption[]
}) {
  return (
    <form action={saveCrmContact} className="mt-4 grid gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <input type="hidden" name="crm_contact_id" value={contact.crmContactId ?? ''} />
      <input type="hidden" name="source_type" value={contact.sourceType} />
      <input type="hidden" name="source_id" value={contact.sourceId ?? ''} />
      <input type="hidden" name="source_label" value={contact.sourceLabel} />

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Name</span>
          <input name="full_name" defaultValue={contact.fullName} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" required />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Intern / extern</span>
          <select name="segment" defaultValue={contact.segment} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm">
            {CRM_SEGMENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
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
          <span className="text-xs font-semibold text-neutral-700">Phone</span>
          <input name="phone" defaultValue={contact.phone ?? ''} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Preferred channel</span>
          <input name="preferred_channel" defaultValue={contact.preferredChannel ?? ''} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">City</span>
          <input name="city" defaultValue={contact.city ?? ''} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Country</span>
          <input name="country" defaultValue={contact.country ?? ''} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
        </label>
      </div>

      <label className="space-y-1">
        <span className="text-xs font-semibold text-neutral-700">Bio</span>
        <textarea name="bio" defaultValue={contact.bio ?? ''} rows={3} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
      </label>

      <div className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 md:grid-cols-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500 md:col-span-2">
          Internal profile — picture, bio, field of expertise, and skills
        </p>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Field of expertise</span>
          <input
            name="field_of_expertise"
            defaultValue={formatCrmList(contact.fieldOfExpertise)}
            placeholder="Comma or newline separated, e.g. Oncology, Patient engagement"
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Skills</span>
          <input
            name="skills"
            defaultValue={formatCrmList(contact.skills)}
            placeholder="Comma or newline separated, e.g. Public speaking, Data analysis"
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
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
          <span className="text-xs font-semibold text-neutral-700">Fallback owner label</span>
          <input name="relationship_owner_label" defaultValue={contact.relationshipOwner ?? ''} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
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
          <span className="text-xs font-semibold text-neutral-700">Last interaction</span>
          <input name="last_interaction_at" type="datetime-local" defaultValue={inputDateTime(contact.lastInteractionAt)} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Next follow-up</span>
          <input name="next_follow_up_at" type="date" defaultValue={inputDate(contact.nextFollowUpAt)} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Retention review</span>
          <input name="retention_review_at" type="date" defaultValue={inputDate(contact.retentionReviewAt)} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Tags</span>
          <input name="tags" defaultValue={formatCrmList(contact.tags)} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
        </label>
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
        <span className="text-xs font-semibold text-neutral-700">Event relationship type</span>
        <select name="event_relationship_type" defaultValue="related" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm md:w-64">
          {['related', 'speaker', 'host', 'guest', 'owner', 'attendee', 'follow_up'].map((value) => (
            <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>
          ))}
        </select>
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Notes</span>
          <textarea name="notes" defaultValue={contact.notes ?? ''} rows={3} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-neutral-700">Privacy notes</span>
          <textarea name="privacy_notes" defaultValue={contact.privacyNotes ?? ''} rows={3} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
        </label>
      </div>

      <button className="w-fit rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
        Save CRM record
      </button>
    </form>
  )
}

function NewContactForm({
  people,
  initiatives,
  events,
}: {
  people: CrmSelectOption[]
  initiatives: CrmSelectOption[]
  events: CrmSelectOption[]
}) {
  return (
    <details className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <summary className="cursor-pointer list-none text-sm font-semibold text-neutral-900">Create CRM contact</summary>
      <form action={saveCrmContact} className="mt-4 grid gap-4">
        <input type="hidden" name="crm_contact_id" value="" />
        <input type="hidden" name="source_type" value="manual" />
        <input type="hidden" name="source_id" value="" />
        <input type="hidden" name="source_label" value="Manual CRM contact" />
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-neutral-700">Name</span>
            <input name="full_name" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" required />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-neutral-700">Intern / extern</span>
            <select name="segment" defaultValue="internal" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm">
              {CRM_SEGMENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
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
            <span className="text-xs font-semibold text-neutral-700">Email</span>
            <input name="email" type="email" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-neutral-700">Organisation</span>
            <input name="organisation" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
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
            <span className="text-xs font-semibold text-neutral-700">Field of expertise</span>
            <input name="field_of_expertise" placeholder="Comma separated" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-neutral-700">Skills</span>
            <input name="skills" placeholder="Comma separated" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
          </label>
        </div>
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
        <button className="w-fit rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
          Create contact
        </button>
      </form>
    </details>
  )
}

function InteractionForm({ contact }: { contact: CrmContactRecord }) {
  if (!contact.crmContactId) {
    return <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Save this source record to CRM before adding interaction notes.</p>
  }

  return (
    <form action={addCrmInteraction} className="mt-4 grid gap-3 rounded-lg border border-neutral-200 bg-white p-4">
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

export function CommsCrmWorkspace({
  records,
  visibleRecords,
  activeSegment,
  activePersonType,
  activeFilter,
  query,
  people,
  initiatives,
  events,
  connectorBacklog,
  crmReady,
}: {
  records: CrmContactRecord[]
  visibleRecords: CrmContactRecord[]
  activeSegment: 'all' | CrmSegment
  activePersonType: string
  activeFilter: CrmFilter
  query: string
  people: CrmSelectOption[]
  initiatives: CrmSelectOption[]
  events: CrmSelectOption[]
  connectorBacklog: CrmConnectorBacklogItem[]
  crmReady: boolean
}) {
  const followUpRecords = records
    .filter((record) => record.health === 'follow_up' || Boolean(record.nextFollowUpAt))
    .sort((a, b) => (a.nextFollowUpAt ?? '9999-12-31').localeCompare(b.nextFollowUpAt ?? '9999-12-31'))
  const withProjectsCount = records.filter((record) => record.associatedProjects.length > 0).length

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <Link href="/app/comms/crm" className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700 hover:text-orange-900">
          ← CRM
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-semibold text-neutral-900">People</h2>
          <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-700">
            {visibleRecords.length} visible
          </span>
        </div>
        <p className="max-w-3xl text-sm text-neutral-600">
          Search and filter every person comms works with — internal team members and external stakeholders — with
          ownership, projects, events, and follow-up state in one place.
        </p>
      </header>

      {!crmReady && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          CRM schema migration is not applied yet. Existing platform records are still visible, but saving CRM enrichment requires migration 00048.
        </div>
      )}

      <NewContactForm people={people} initiatives={initiatives} events={events} />

      <form className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <input type="hidden" name="segment" value={activeSegment === 'all' ? '' : activeSegment} />
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
        <nav className="flex flex-wrap gap-2" aria-label="Intern / extern filters">
          <Link
            href={buildHref({ segment: 'all', personType: activePersonType, filter: activeFilter, query })}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${activeSegment === 'all' ? 'bg-neutral-900 text-white' : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'}`}
          >
            All
          </Link>
          {CRM_SEGMENT_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={buildHref({ segment: option.value, personType: activePersonType, filter: activeFilter, query })}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${activeSegment === option.value ? 'bg-blue-100 text-blue-800' : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'}`}
            >
              {option.label}
            </Link>
          ))}
        </nav>

        <nav className="flex flex-wrap gap-2" aria-label="Person type filters">
          <Link
            href={buildHref({ segment: activeSegment, filter: activeFilter, query })}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${!activePersonType ? 'bg-neutral-900 text-white' : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'}`}
          >
            Any type
          </Link>
          {CRM_PERSON_TYPE_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={buildHref({ segment: activeSegment, personType: option.value, filter: activeFilter, query })}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${activePersonType === option.value ? 'bg-violet-100 text-violet-800' : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'}`}
            >
              {option.label}
            </Link>
          ))}
          <Link
            href={buildHref({ segment: activeSegment, personType: 'unclassified', filter: activeFilter, query })}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${activePersonType === 'unclassified' ? 'bg-violet-100 text-violet-800' : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'}`}
          >
            Unclassified
          </Link>
        </nav>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Total people</p>
          <p className="mt-2 text-3xl font-semibold text-neutral-950">{records.length}</p>
        </article>
        <article className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Internal</p>
          <p className="mt-2 text-3xl font-semibold text-neutral-950">
            {records.filter((record) => record.segment === 'internal').length}
          </p>
        </article>
        <article className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">External</p>
          <p className="mt-2 text-3xl font-semibold text-neutral-950">
            {records.filter((record) => record.segment === 'external').length}
          </p>
        </article>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.9fr)]">
        <div className="space-y-4">
          {visibleRecords.length === 0 && (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-12">
              <p className="text-sm font-semibold text-neutral-900">No CRM records match this filter yet.</p>
              <p className="mt-2 max-w-2xl text-sm text-neutral-600">
                Try a broader search or switch segment. Existing platform records remain visible while dedicated CRM records are added.
              </p>
            </div>
          )}

          <div className="grid gap-4">
            {visibleRecords.map((contact) => (
              <article key={contact.id} className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-4">
                    <ContactAvatar contact={contact} />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-700">
                          {getCrmSegmentLabel(contact.segment)}
                        </span>
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
                      <div>
                        <h3 className="text-lg font-semibold text-neutral-950">{contact.fullName}</h3>
                        <p className="text-sm text-neutral-500">
                          {[contact.title, contact.organisation].filter(Boolean).join(' · ') || 'Role and organisation to enrich'}
                        </p>
                      </div>
                    </div>
                  </div>
                  {contact.crmContactId && (
                    <form action={markCrmFollowUpDone}>
                      <input type="hidden" name="crm_contact_id" value={contact.crmContactId} />
                      <button className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100">
                        Mark followed up
                      </button>
                    </form>
                  )}
                </div>

                <p className="mt-4 text-sm leading-6 text-neutral-600">
                  {contact.bio || 'Bio not yet added. Capture expertise, relationship context, and why this person matters to comms.'}
                </p>

                {contact.segment === 'internal' && (contact.fieldOfExpertise.length > 0 || contact.skills.length > 0) && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {contact.fieldOfExpertise.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Field of expertise</p>
                        <div className="flex flex-wrap gap-2">
                          {contact.fieldOfExpertise.map((item) => (
                            <span key={item} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {contact.skills.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Skills</p>
                        <div className="flex flex-wrap gap-2">
                          {contact.skills.map((item) => (
                            <span key={item} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Associated projects</p>
                    <div className="flex flex-wrap gap-2">
                      {(contact.associatedProjects.length > 0 ? contact.associatedProjects : ['Project to link']).map((project) => (
                        <span key={project} className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                          {project}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Events / podcast links</p>
                    <div className="flex flex-wrap gap-2">
                      {(contact.associatedEvents.length > 0 ? contact.associatedEvents : ['Event to link']).map((event) => (
                        <span key={event} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                          {event}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
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
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Last interaction</dt>
                    <dd className="mt-1 text-neutral-700">{formatCrmDate(contact.lastInteractionAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Next follow-up</dt>
                    <dd className="mt-1 text-neutral-700">{formatCrmDate(contact.nextFollowUpAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Source</dt>
                    <dd className="mt-1 text-neutral-700">{contact.sourceLabel}</dd>
                  </div>
                </dl>

                {(contact.email || contact.phone || contact.tags.length > 0 || contact.notes || contact.privacyNotes) && (
                  <div className="mt-4 grid gap-3 rounded-lg bg-neutral-50 p-4 md:grid-cols-2">
                    <div className="space-y-2">
                      {contact.email && (
                        <p className="text-sm text-neutral-700">
                          <span className="font-semibold text-neutral-900">Email:</span>{' '}
                          <a href={`mailto:${contact.email}`} className="text-blue-700 hover:text-blue-900">
                            {contact.email}
                          </a>
                        </p>
                      )}
                      {contact.phone && <p className="text-sm text-neutral-700"><span className="font-semibold text-neutral-900">Phone:</span> {contact.phone}</p>}
                      {contact.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {contact.tags.slice(0, 8).map((tag) => (
                            <span key={tag} className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-xs font-semibold text-neutral-600">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      {contact.notes && <p className="text-sm leading-6 text-neutral-600">{contact.notes}</p>}
                      {contact.privacyNotes && <p className="text-sm leading-6 text-neutral-600"><span className="font-semibold text-neutral-900">Privacy:</span> {contact.privacyNotes}</p>}
                      {contact.retentionReviewAt && <p className="text-sm text-neutral-600">Retention review: {formatCrmDate(contact.retentionReviewAt)}</p>}
                    </div>
                  </div>
                )}

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

                <details className="mt-4">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-neutral-900">Edit CRM details</summary>
                  <ContactEditForm contact={contact} people={people} initiatives={initiatives} events={events} />
                </details>

                <details className="mt-3">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-neutral-900">Add interaction</summary>
                  <InteractionForm contact={contact} />
                </details>
              </article>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <article className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-rose-700">Follow-up queue</p>
            <h3 className="mt-2 text-lg font-semibold text-neutral-950">{followUpRecords.length} contacts to watch</h3>
            <div className="mt-4 space-y-3">
              {followUpRecords.slice(0, 8).map((contact) => (
                <div key={contact.id} className="rounded-lg bg-rose-50 px-4 py-3">
                  <p className="text-sm font-semibold text-rose-950">{contact.fullName}</p>
                  <p className="mt-1 text-xs text-rose-800">Next: {formatCrmDate(contact.nextFollowUpAt)}</p>
                </div>
              ))}
              {followUpRecords.length === 0 && <p className="text-sm text-neutral-600">No follow-up items are due.</p>}
            </div>
          </article>

          <details className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
            <summary className="cursor-pointer list-none text-sm font-semibold text-neutral-900">
              More — record standard &amp; connector backlog
            </summary>

            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-orange-700">CRM standard</p>
                <h3 className="mt-1 text-sm font-semibold text-neutral-950">Record structure</h3>
                <div className="mt-3 space-y-3">
                  {CRM_FIELD_GROUPS.map((group) => (
                    <div key={group.title}>
                      <p className="text-xs font-semibold text-neutral-900">{group.title}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {group.fields.map((field) => (
                          <span key={field} className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
                            {field}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-neutral-200 pt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">Connector backlog</p>
                <h3 className="mt-1 text-sm font-semibold text-neutral-950">Future sync guardrails</h3>
                <div className="mt-3 space-y-2">
                  {connectorBacklog.map((item) => (
                    <div key={item.id} className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                      <p className="text-xs font-semibold text-blue-950">{item.integrationTarget} · {item.status}</p>
                      <p className="mt-1 text-xs text-blue-900">{item.useCase}</p>
                      <p className="mt-1 text-[11px] font-medium text-blue-800">{item.guardrail}</p>
                    </div>
                  ))}
                  {connectorBacklog.length === 0 && <p className="text-sm text-neutral-600">Connector backlog appears after migration 00048 is applied.</p>}
                </div>
                <p className="mt-3 text-xs text-neutral-600">
                  {withProjectsCount} people already resolve to at least one project.
                </p>
              </div>
            </div>
          </details>
        </aside>
      </div>
    </section>
  )
}
