export const CONFERENCE_REGIONS = [
  'europe',
  'north_america',
  'latin_america',
  'asia_pacific',
  'middle_east_africa',
  'global',
] as const
export type ConferenceRegion = (typeof CONFERENCE_REGIONS)[number]

export const CONFERENCE_REGION_LABELS: Record<ConferenceRegion, string> = {
  europe: 'Europe',
  north_america: 'North America',
  latin_america: 'Latin America',
  asia_pacific: 'Asia-Pacific',
  middle_east_africa: 'Middle East & Africa',
  global: 'Global / Virtual',
}

export const CONFERENCE_FORMATS = ['in_person', 'virtual', 'hybrid'] as const
export type ConferenceFormat = (typeof CONFERENCE_FORMATS)[number]

export type ConferenceDetailFact = { label: string; value: string }

export type ConferenceDetail = {
  overview: string | null
  whyRelevant: string | null
  audience: string | null
  keyTopics: string[]
  notableSpeakers: string[]
  registration: string | null
  registrationDeadline: string | null
  earlyBirdDeadline: string | null
  earlyBirdFees: string | null
  regularDeadline: string | null
  regularFees: string | null
  fees: string | null
  facts: ConferenceDetailFact[]
  links: Array<{ label: string; url: string }>
}
