# feat: remove a person from the People list, or hand them to the CRM pre-categorised

- **Date:** 2026-08-21
- **Author:** Michael (with Cursor agent)
- **Type:** feat
- **Scope:** network, contacts, podcast-planning (People tab)
- **Links:** REQ-NET-004 · REQ-DATA-CONTACT-003 · ADR-0007 · ADR-0013 · ADR-0016 · `docs/PODCAST_OPPORTUNITY_ENGINE_CONCEPT.md` §16

## Context

The People tab of the podcast planner gathers four kinds of record — past guests, members, CRM
contacts and externally-retrieved people — into one list, and then let you do nothing with any of
them. After a Radar run put four Brazilian CAR-T researchers on the screen, there was no way to
remove a name that did not belong and no way to keep one that did.

Both halves turned out to be designed and left unwired, which is the pattern this codebase keeps
producing:

- `network.deletePerson` shipped in Sprint 20 exported, declared in the manifest, called by nothing,
  and carrying a docstring claiming it was "where the consequences of a deletion are decided" over a
  body that was a bare `DELETE`.
- `network_people.crm_contact_id` has existed since migration `00171`, and nothing has ever set it.
- `contacts` has declared `provides.api: [..., 'resolveContact']` since it was scaffolded, while its
  `index.ts` exported only the manifest and no such function existed anywhere in the repository.

That third one is the interesting one, because it explains the other two. With no published way to
create a contact, every feature that needed one wrote its own: `saveCrmContact` matches on
`(source_type, source_id)` and never on a person, the three `addPipelineMember` paths match on
nothing at all, and `events` carries `resolveOrCreateCrmContact` whose file header says outright that
it exists because the same logic had already been written three times with different rules. A
missing contract does not stop the work; it multiplies it.

## Change

### `contacts` — the promised API, honoured

`src/modules/contacts/domain/contact-resolution.ts` (new) exports `resolveContact`, and
`index.ts` exports it alongside `loadCrmDirectory` and the person-type vocabulary, so the manifest
stops overstating the surface.

The matching order is email → name + organisation → a name that is unique in the whole CRM.
Normalised email wins outright because it is the only identifier the database enforces (there is a
partial unique index on `normalized_email`). Below that the matcher only acts on evidence it can
defend, and where it cannot it **creates a separate record rather than guessing** — two contacts
called "Maria Silva", neither carrying the organisation we hold, is a question nobody has answered,
and a wrong merge in a CRM with no merge UI is unrecoverable.

`matchExistingContact` is exported as a pure function, so the one real decision in the file is
unit-tested without mocking Supabase. The query is deliberately two narrow lookups rather than one
`or(...)`: a name containing a comma would have to be escaped into PostgREST's filter grammar, and a
mangled name fails *silently*, as the duplicate this function exists to prevent.

### `network` — the delete, guarded

- `domain/deletion.ts` (new, pure): `canDeletePerson`. **Refuses** for a platform member's record
  and for anybody on a card that is not closed. Otherwise **confirms**, naming what the cascade
  takes — including the consequence no screen can show. The database cascades
  `network_introduction_requests` off `network_people`, and introducer fatigue is computed from
  exactly that history, so deleting a person silently hands every colleague who was ever asked about
  them a fresh cooldown. That is not a reason to refuse; it is a reason to say so first.
- `domain/live-cards.ts` (new): `peopleHeldByLiveCards`, factored out of `purgeInactivePeople`.
  `podcast_question_candidates.person_id` carries no foreign key by design (ADR-0013 §2), so this
  check is made by hand — and now in exactly one place, because two implementations of "is this
  person still in use" would eventually disagree about who may be destroyed. It is service-role even
  when a human is driving: a guard that reads through RLS and sees nothing returns the same answer as
  a guard that read everything and found nothing, and here those mean opposite things.
- `domain/actions.ts`: `deletePerson(personId, { confirmed })` now returns one of three answers —
  done, needs confirming with the sentence to show, or refused with the reason — so nothing about the
  cascade is discovered afterwards.

### `network` — the promotion into the CRM

- `domain/crm-promotion.ts` (new, pure): the mapping. Role, organisation, country and topics cross
  over; **every attributed source becomes a contact link** (profiles, then appearances, then the
  papers), deduplicated by URL, so the person's standing is legible in the CRM without going back to
  the planner. `provenanceNote` writes the sentence that says a machine found them and nobody has
  spoken to them yet — a contact that appears with no explanation is worse than no contact.
- `domain/actions.ts`: `addPersonToCrm(personId, { personType, email })` resolves or creates the
  contact through `@/modules/contacts` and then writes `crm_contact_id`. This is the single
  cross-component write the manifest has always licensed
  (`dependsOn.components: ['contacts@^1']`, ADR-0007).

The email is the caller's and never the record's: ADR-0016 forbids storing a way to reach somebody
retrieved rather than met, so if there is an address it was typed by the human clicking Add. Consent
is written `unknown` and never inferred.

### UI

`ui/person-actions.tsx` (new client component) puts two quiet text actions in each card's footer:
*Add to CRM* (which expands to a category select and an optional email box) and *Remove* (two-step,
with the server's own sentence as the confirmation). `PeopleDirectory` gained an opt-in `actions`
prop — off by default, because the onboarding tour renders the same component over invented people
where a working Remove button would be a trap. The CRM's categories are passed **down as data**
rather than imported by the client component, since `@/modules/contacts` reaches server-only code.

### Also

`vitest.config.ts` — `testTimeout` raised to 30s. See Verification.

## Verification

- `pnpm typecheck` · `pnpm lint` · `pnpm test:coverage` · `pnpm governance` · `pnpm build` — all
  green. 877 tests pass; coverage 65.68 % lines / 65.52 % functions against the 60 % gate.
- 34 new unit tests: `network-person-lifecycle.test.ts` (the delete guard's refusals, confirmations
  and precedence; the link mapping, deduplication and provenance sentence) and
  `contacts-resolution.test.ts` (the matcher, including the two same-name contacts it must refuse to
  merge). `deletion.ts` is at 100 % across the board; `crm-promotion.ts` at 100 % lines.
- **Not yet driven in a browser.** The gates prove the rules; they do not prove the two clicks.

### The timeout, and why it is in this change

The full suite failed twice during this work, each time on different tests, and each time the
failure was slowness rather than a defect: the governance dead-code scan (which walks the whole tree
twice) and three admin-invite tests were killed at the five-second default under full parallel load,
then passed in 290ms–1s when run alone. A killed test does not merely fail — it leaves its mocks
behind, so the *next* test in the file fails on a call count it never made, which is why the failures
moved around and looked like flakes. 30s costs nothing on a healthy run (the suite takes ~98s) and
makes the local gate agree with CI. The dead-code scan additionally carries its own 60s budget and a
comment explaining why.

## Risk & rollback

**No migration, no schema change.** Everything writes through columns and tables that already exist.

- The delete is genuinely destructive, which is why the guard sits in the action rather than the
  form, and why the two refusals cannot be overridden by confirming. A hard-deleted person can be
  recreated by re-running the guest import or Radar; their introduction history cannot.
- Promoting somebody to the CRM **ends their eighteen-month retention expiry**, because
  `purgeInactivePeople` exempts anybody with a `crm_contact_id`. Correct — they are now held as a
  relationship rather than a search result — but a real change, now stated in the concept's §16 and
  visible in the UI as the card switching to "In the CRM".
- Rollback is a revert: no data shape depends on this, and `crm_contact_id` rows written by it are
  valid links either way.

## Follow-ups

- **Gate the phantom contract.** Nothing in `pnpm governance` checks that a name in `provides.api`
  is actually exported from `index.ts`. That check is cheap and would have caught `resolveContact`
  three sprints ago. Written up as the fourth reconciliation gap in
  `docs/MODULAR_COMPONENT_ARCHITECTURE.md` §10.
- **`recordObjection` is still uncalled.** The right-to-object flag that concept §16 promises has an
  implementation, a database column and a view that enforces it — and no way for a human to set it.
  Deliberately out of scope here (the user asked for a delete, and an objection is a different
  statement), but it is a compliance commitment with no UI.
- **The remaining uncalled `network` exports:** `createPerson`, `updatePerson`,
  `refreshSuggestedConnections`, `buildIntroducerPackage`, `loadConnectionChecks`.
- **`src/types/database.ts` is stale for the CRM** — missing `is_campus_member`, `linkedin_url`,
  `organisation_url` and `continent` since migration `00101`, which is why every CRM write path
  (including this one) casts through an ad-hoc client type. Regenerating needs a live database.
