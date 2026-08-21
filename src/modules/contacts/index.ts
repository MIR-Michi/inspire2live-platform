/**
 * contacts — public API (the ONLY import surface for other modules).
 *
 * The component is the identity spine: `network` declares it as its single
 * permitted component dependency (ADR-0007) precisely so a directory person can
 * become a CRM contact. That contract was declared in both manifests and
 * exported by neither, which is why every feature needing a contact wrote its
 * own insert. `resolveContact` is that contract, honoured.
 *
 * Other modules import `@/modules/contacts`, never its internals.
 */

export { manifest } from '@/modules/contacts/manifest'

export { loadCrmDirectory } from '@/modules/contacts/domain/comms-crm-data'

export {
  matchExistingContact,
  resolveContact,
} from '@/modules/contacts/domain/contact-resolution'
export type {
  ContactCandidate,
  ContactLinkInput,
  ResolveContactInput,
  ResolvedContact,
} from '@/modules/contacts/domain/contact-resolution'

export {
  CRM_PERSON_TYPE_OPTIONS,
  getCrmPersonTypeLabel,
  normalizeCrmPersonType,
} from '@/modules/contacts/domain/comms-crm'
export type { CrmContactLinkKind, CrmPersonType } from '@/modules/contacts/domain/comms-crm'
