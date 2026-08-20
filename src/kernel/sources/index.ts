/**
 * kernel/sources — thin, typed clients for public research APIs.
 *
 * Each client fetches, parses, normalises and caps. None of them knows what the
 * platform intends to do with the result, which is what makes them kernel: the
 * same OpenAlex client answers "who could speak to this question" for
 * `podcast-planning` and "who has co-authored with whom" for `network`.
 *
 * The rule these exist to serve is ADR-0016: facts about real people come from
 * a source with a stable identifier, never from a model.
 */
export {
  OpenAlexError,
  principalAuthors,
  searchWorks,
} from '@/kernel/sources/openalex'
export type { OpenAlexAuthor, OpenAlexQuery, OpenAlexWork } from '@/kernel/sources/openalex'
export {
  EuropePmcError,
  principalEuropePmcAuthors,
  searchEuropePmc,
} from '@/kernel/sources/europepmc'
export type {
  EuropePmcAuthor,
  EuropePmcQuery,
  EuropePmcRecord,
} from '@/kernel/sources/europepmc'
