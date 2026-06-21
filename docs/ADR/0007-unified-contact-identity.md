# ADR-0007: Unified Contact Identity (CRM spine + email resolution)

- **Status:** proposed
- **Date:** 2026-06-21
- **Owners:** Michael Wittinger

## Context

Person data is spread across four unlinked stores — `profiles` (platform users), `comms_crm_contacts`
(CRM overlay), `campus_members` (World Campus community), and `member_onboarding` (onboarding checklist) —
plus a separate account-invite path (`auth.admin.inviteUserByEmail`). There is no persisted canonical
identity; the CRM directory is assembled at read time in `loadCrmDirectory()` and deduped only on a
`source_type:source_id` heuristic.

We must support three explicit contact categories and keep them in sync:

- **A — internal platform user** (`profiles` row exists),
- **B — internal non-platform user** (in CRM, typically `@inspire2live.org`, no account yet),
- **C — external** (third-party email).

A key driver is *anticipation*: category-B Inspire2Live stakeholders exist today only as CRM internals but
will later be invited to the platform **according to their user type**. Promotion must be a *link*, not a
*duplicate*.

- Related requirements: `REQ-DATA-CONTACT-001` (single contact identity), `REQ-DATA-CONTACT-002`
  (anticipate stakeholder onboarding by user type), `REQ-SEC-001` (comms-only CRM access preserved).
- Full analysis: `docs/CONTACT_DATA_MODEL_CONCEPT.md`.

## Decision

Make `comms_crm_contacts` the **canonical contact spine** (one row per real person) and resolve identity on
**normalized email**, rather than introducing a new master-person table.

1. Replace the binary `segment` (kept as a derived column) with a stored `contact_kind`
   (`internal_user` / `internal_pending` / `external`).
2. Add explicit links — `profile_id`, `campus_member_id`, `member_onboarding_id` — and a `normalized_email`
   with a partial unique index as the match key.
3. Add anticipation fields — `intended_role`, `intended_user_type`, `platform_status`
   (`not_invited`/`invited`/`active`/`inactive`).
4. Introduce `crm_resolve_contact(email, name, source, source_id)` as the single find-or-create entry point;
   route all contact creation (manual CRM add, campus import, profile creation, onboarding registration)
   through it.
5. On account creation, the `profiles` AFTER INSERT trigger resolves back onto the existing spine by email,
   sets `profile_id`, flips `contact_kind` to `internal_user`, and links the onboarding record — so
   promotion never duplicates.
6. Source-of-truth rules: profile owns identity for `internal_user` (CRM reads live); CRM owns identity for
   `internal_pending`/`external`; CRM always owns relationship data.

## Alternatives considered

1. **New dedicated `contacts` master table** with FKs from every store. Cleanest conceptually, but a large
   migration touching profiles/campus/onboarding and all RLS — high risk for a small team. Rejected for now.
2. **Keep the read-time merge, add only email dedup.** Smaller, but leaves category B unrepresented and
   anticipation fields homeless. Insufficient for the requirement.
3. **CRM spine + email resolution (chosen).** Reuses the existing comms-only table and access model, is
   incrementally shippable, and directly models A/B/C plus onboarding intent.

## Consequences

### Positive

- One person = one row; no duplicates on promotion.
- Category B is first-class and queryable; stakeholders can be pre-staged and invited *by user type*.
- CRM access model (`is_comms_team_or_admin()`) and profile ownership are unchanged.
- The new-member dashboard and CRM share one worklist via linked records.

### Negative / risks

- `comms_crm_contacts` takes on more responsibility (identity + relationship); must be documented clearly.
- Backfill/dedup of existing rows is a one-time data-quality exercise that needs review.
- Email remains the matching key; aliases/shared mailboxes need a manual-merge escape hatch (sprint task).

## Implementation

`sprints/sprint-13-contact-identity-unification/` (`S13-T01…T10`).
