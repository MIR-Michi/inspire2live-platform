/**
 * network/ui/people-directory.tsx — the People screen.
 *
 * Everyone the organisation could plausibly invite, from four groups normally
 * kept in separate places (concept §6). A server component: it renders what the
 * published read view returns, which means a person who has objected is already
 * absent — the screen has no filter to forget.
 */

import { StatusBadge } from '@/kernel/ui'
import { CRM_PERSON_TYPE_OPTIONS } from '@/modules/contacts'
import { FRICTION_META, ORIGIN_META } from '@/modules/network/domain/types'
import type { NetworkPerson, PersonOrigin } from '@/modules/network/domain/types'
import { PersonActions } from '@/modules/network/ui/person-actions'

const ORIGIN_TONE: Record<PersonOrigin, 'green' | 'blue' | 'violet' | 'neutral'> = {
  past_guest: 'green',
  member: 'blue',
  crm_contact: 'violet',
  external: 'neutral',
}

/** The single most predictive fact the platform can hold about a person. */
function appearanceLabel(person: NetworkPerson): { label: string; tone: 'green' | 'amber' | 'neutral' } {
  const latest = person.appearances
    .map((a) => a.publishedAt)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1)
  if (!latest) return { label: 'No podcast appearance found', tone: 'neutral' }

  const months = (Date.now() - new Date(latest).getTime()) / (1000 * 60 * 60 * 24 * 30)
  return months <= 12
    ? { label: 'Podcast in the last year', tone: 'green' }
    : { label: 'Has appeared, not recently', tone: 'amber' }
}

export function PeopleDirectory({
  people,
  emptyHint,
  actions = false,
}: {
  people: NetworkPerson[]
  emptyHint?: string
  /**
   * Off by default. The tour renders this component over invented people, where
   * a working Remove button would be a trap.
   */
  actions?: boolean
}) {
  if (people.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-300 bg-white py-12 text-center text-sm text-neutral-500">
        {emptyHint ?? 'Nobody in the list yet.'}
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {people.map((person) => {
        const appearance = appearanceLabel(person)
        return (
          <li
            key={person.id}
            className="rounded-xl border border-neutral-200 bg-white px-5 py-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-neutral-900">{person.fullName}</h3>
                <p className="mt-0.5 text-sm text-neutral-600">
                  {[person.roleTitle, person.organisation, person.country].filter(Boolean).join(' · ') ||
                    'Role not recorded yet'}
                </p>
                {person.whatTheyCanSay && (
                  <p className="mt-1.5 text-sm leading-5 text-neutral-700">{person.whatTheyCanSay}</p>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                <StatusBadge label={ORIGIN_META[person.origin].label} tone={ORIGIN_TONE[person.origin]} />
                <StatusBadge label={appearance.label} tone={appearance.tone} />
                {person.institutionalFriction !== 'none' && (
                  <StatusBadge label={FRICTION_META[person.institutionalFriction].label} tone="amber" />
                )}
                {person.industryRelationship && (
                  <StatusBadge label="Industry relationship" tone="violet" />
                )}
              </div>
            </div>

            {(actions ||
              person.topicTags.length > 0 ||
              Object.keys(person.sourceAttribution).length > 0) && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                {person.topicTags.slice(0, 6).map((tag) => (
                  <span key={tag} className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium">
                    {tag}
                  </span>
                ))}
                {/* Provenance is shown, not implied: a field with no source is
                    treated as unverified and stays out of scoring (concept §16). */}
                <span className="ml-auto">
                  {Object.keys(person.sourceAttribution).length} field
                  {Object.keys(person.sourceAttribution).length === 1 ? '' : 's'} source-attributed
                </span>
                {actions && (
                  <div className="w-full">
                    <PersonActions
                      personId={person.id}
                      fullName={person.fullName}
                      origin={person.origin}
                      crmContactId={person.crmContactId}
                      personTypes={CRM_PERSON_TYPE_OPTIONS}
                    />
                  </div>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
