# Sprint 13 — Contact Identity Unification

**Weeks:** TBD (2-week sprint) · **Theme:** One person = one contact spine across CRM, Users, Onboarding & Profile

## Goal

Close the contact-data-model gap described in `docs/CONTACT_DATA_MODEL_CONCEPT.md` and decided in
`docs/ADR/0007-unified-contact-identity.md`. After this sprint:

- Every person is represented by **one canonical contact** (`comms_crm_contacts` spine), resolved on
  normalized email and linked to its `profiles`, `campus_members`, and `member_onboarding` records.
- The CRM models the three categories explicitly: **internal user (A)**, **internal pending (B)**,
  **external (C)** via `contact_kind`.
- Category-B Inspire2Live stakeholders can be **pre-staged with an intended role + user type** and
  **invited to the platform** from one place — promotion **links**, it never duplicates.
- CRM, User Management, the new-member dashboard, and Profile read/write a single, synchronized model with
  documented source-of-truth rules.

## Rationale

Person data currently lives in four unlinked stores plus a separate account-invite path (see Concept §2).
The "internal non-platform user" category has no clean home, and promoting such a contact to a platform user
produces duplicate directory rows (Concept §3, G1–G8). The platform will onboard I2L stakeholders later
*by user type*; the data model must anticipate that now so the transition is a link, not a rebuild.

This sprint sequences after Sprint 12 (WhatsApp hardening) and builds directly on the CRM foundation
(`00048`, `00052`) and member-onboarding (`00058`) already shipped.

## Acceptance criteria

- [ ] `comms_crm_contacts` has `contact_kind`, `profile_id`, `campus_member_id`, `member_onboarding_id`,
      `normalized_email` (partial-unique), `intended_role`, `intended_user_type`, `platform_status`, with
      constraints; `segment` retained as a derived/back-compat column.
- [ ] `crm_resolve_contact(...)` find-or-create RPC exists and is the single creation path; all entry points
      (manual CRM add, campus import, profile creation, onboarding registration) route through it.
- [ ] Backfill+dedup migration collapses profile/campus/manual rows that share an email into one spine and
      populates all links and `contact_kind`; a dry-run report is reviewed before the destructive step.
- [ ] `profiles` AFTER INSERT and `member_onboarding` triggers resolve onto the existing spine; inviting a
      category-B contact and accepting produces **exactly one** `internal_user` directory record (no dupe).
- [ ] `loadCrmDirectory()` assembles from explicit links (not the `source_type:source_id` heuristic) and
      emits no duplicates; existing tests pass and new dedup tests are added.
- [ ] CRM UI shows the three kinds (badge + filter) and exposes `intended_role`/`intended_user_type` on
      internal-pending contacts.
- [ ] A single "Invite to platform" action (from CRM contact and from the new-member dashboard) calls the
      account-invite path with `intended_role` + `intended_user_type`, links/creates the onboarding record,
      and sets `platform_status='invited'`.
- [ ] `member_onboarding` records are linked to their CRM contact; no double data entry between the
      dashboard and the CRM.
- [ ] Source-of-truth/sync rules, the new columns, and the promotion flow are documented in
      `docs/DATA_DICTIONARY.md`; ADR-0007 moved to **accepted**.

## Out of scope

- A dedicated `contacts` master table (ADR-0007 alternative 1) — deferred.
- External CRM connectors (Outlook/Mailchimp/HubSpot) — remain in the connector backlog.
- Self-service signup; invitations stay admin/comms-initiated.
