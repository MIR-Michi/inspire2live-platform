/**
 * network/domain/crm-promotion.ts — what a directory person becomes in the CRM.
 *
 * Pure, and separate from the action, because the mapping is the whole design
 * decision: a person here is a professional record with a citation behind every
 * field, and a CRM contact is the beginning of a relationship. Everything that
 * survives the crossing should be a fact somebody could check; nothing that
 * implies a relationship we do not have should be invented on the way.
 *
 * Two of those choices are worth stating outright. The evidence travels — the
 * papers, profiles and appearances become contact links, so the person's
 * standing is legible in the CRM without going back to the podcast planner.
 * And consent does not: being findable in a scholarly index is not permission
 * to be contacted, so the contact is created with consent unknown and no
 * lifecycle beyond "nurture" (`resolveContact`).
 */

import type { ContactLinkInput, ResolveContactInput } from '@/modules/contacts'
import type { NetworkPerson } from '@/modules/network/domain/types'
import { FRICTION_META } from '@/modules/network/domain/types'

/** Marks every contact this path creates, so they can be found again as a set. */
export const PODCAST_CANDIDATE_TAG = 'podcast-candidate'
export const PAST_GUEST_TAG = 'past-podcast-guest'

export const CRM_SOURCE_LABEL = 'Podcast People directory'

function tagsFor(person: NetworkPerson): string[] {
  return person.origin === 'past_guest'
    ? [PODCAST_CANDIDATE_TAG, PAST_GUEST_TAG]
    : [PODCAST_CANDIDATE_TAG]
}

/**
 * The links are deduplicated by URL and ordered by how much they say about the
 * person: their own profile first, then where they have spoken, then the papers
 * the record was built from.
 */
export function contactLinksFor(person: NetworkPerson): ContactLinkInput[] {
  const links: ContactLinkInput[] = []
  const seen = new Set<string>()

  const add = (kind: ContactLinkInput['kind'], label: string, url: string | null | undefined) => {
    const clean = url?.trim()
    if (!clean || seen.has(clean)) return
    seen.add(clean)
    links.push({ kind, label, url: clean })
  }

  for (const profile of person.publicProfileUrls) add('profile', profile.label ?? 'Profile', profile.url)
  for (const appearance of person.appearances) add('media', appearance.show || 'Appearance', appearance.url)
  for (const [field, url] of Object.entries(person.sourceAttribution)) {
    add('publication', `Evidence for ${field.replace(/([A-Z])/g, ' $1').toLowerCase().trim()}`, url)
  }

  return links
}

/**
 * The provenance sentence.
 *
 * A contact that appears in the CRM with no explanation is worse than no
 * contact: the next person to open it cannot tell whether somebody met them or
 * a machine found them. This says which, in words.
 */
export function provenanceNote(person: NetworkPerson): string {
  const lines = [
    person.origin === 'past_guest'
      ? 'Added from the podcast People directory — a past guest of the podcast.'
      : 'Added from the podcast People directory. Found through published work, not through a prior relationship — nobody here has spoken to them yet.',
  ]

  if (person.whatTheyCanSay) lines.push(`What they can speak to: ${person.whatTheyCanSay}`)
  if (person.institutionalFriction !== 'none') {
    lines.push(`Approval to expect: ${FRICTION_META[person.institutionalFriction].note}`)
  }
  if (person.industryRelationship) lines.push(`Industry relationship: ${person.industryRelationship}`)

  const sources = [...new Set(Object.values(person.sourceAttribution).filter(Boolean))]
  if (sources.length > 0) {
    lines.push(`${sources.length} source${sources.length === 1 ? '' : 's'} attached as links.`)
  }

  return lines.join('\n')
}

/**
 * Everything the CRM should know about this person, and nothing it should not.
 *
 * The email is the caller's, never the record's: ADR-0016 forbids storing a way
 * to reach somebody who was retrieved rather than met, so if there is an address
 * here a human typed it.
 */
export function contactInputFromPerson(
  person: NetworkPerson,
  opts: { personType?: string | null; email?: string | null } = {},
): ResolveContactInput {
  return {
    fullName: person.fullName,
    email: opts.email ?? null,
    title: person.roleTitle,
    organisation: person.organisation,
    country: person.country,
    personType: opts.personType ?? null,
    fieldOfExpertise: person.topicTags,
    tags: tagsFor(person),
    bio: person.whatTheyCanSay,
    notes: provenanceNote(person),
    sourceLabel: CRM_SOURCE_LABEL,
    links: contactLinksFor(person),
  }
}
