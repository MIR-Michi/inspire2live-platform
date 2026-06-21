# Sprint 13 — Contact Identity Unification · Implementation Report

**Date:** 2026-06-21 · **Status:** Delivered · **Branch:** `claude/quirky-thompson-e2vw0l`
**Concept:** `docs/CONTACT_DATA_MODEL_CONCEPT.md` · **Decision:** `docs/ADR/0007-unified-contact-identity.md`

---

## 1 · Summary

This sprint makes **one person = one canonical contact** across the platform and gives the three contact
categories first-class, unambiguous representation:

| Category | `contact_kind` | How it is created | Platform access |
|----------|----------------|-------------------|-----------------|
| **A — Internal platform user** | `internal_user` | **Only** via an "Invite to platform" action in User Management | Yes (`platform_status` = invited → active) |
| **B — Internal contact (non-user)** | `internal_contact` | CRM, new-members dashboard, or World Campus import | No (`platform_status='none'`) — default, terminal |
| **C — External** | `external` | CRM / third-party email | No |

Key rules honoured (per the two clarifications during design):

- **Internal non-users are never "pending."** Adding someone to the CRM or the new-members dashboard yields
  `internal_contact` / `platform_status='none'`. "Pending" is *only* `platform_status='invited'`, which
  arises *only* from a User-Management invite.
- **Campus members are internal contacts, not a separate identity.** There is **no** `campus_member_id`
  link; their channel data folds onto the spine. (This also fixed a pre-existing bug where the directory
  rendered campus members as `external`.)
- **Promotion links, never duplicates.** Inviting a contact and the resulting profile reconcile onto the
  same spine by normalized email.

> **Note on "user type":** `profiles.user_type` was removed in migration `00050`; the platform's user type
> is now the canonical `role`. The implementation therefore uses a single optional `intended_role` hint
> rather than a separate `intended_user_type`.

All **281 unit tests pass** (19 new), `tsc --noEmit` is clean, and `eslint` reports no new issues.

---

## 2 · What was built

### Database (migrations `00062`–`00065`)

- **`00062_contact_identity_columns.sql`** — adds `contact_kind`, `platform_status`, `profile_id`,
  `member_onboarding_id`, `normalized_email`, `intended_role`, and folded campus fields
  (`whatsapp_id`, `welcomed_by_peter`) to `comms_crm_contacts`; CHECK constraints; the
  `crm_contacts_sync_derived()` BEFORE trigger (keeps `normalized_email` + derived `segment` in sync,
  defaults `contact_kind`); and a backfill that classifies existing rows and links profile-sourced rows.
- **`00063_crm_resolve_contact.sql`** — the `crm_resolve_contact(email, name, profile_id)` find-or-create
  function. `SECURITY DEFINER`, locked down (not an RPC for ordinary users; used by triggers/service role).
- **`00064_contact_identity_backfill.sql`** — collapses duplicate-email rows into one spine (repointing
  initiatives, events, interactions, pipeline members with conflict avoidance), links onboarding by
  profile, then adds the **partial unique index** on `normalized_email`. Includes a dry-run report query.
- **`00065_contact_identity_triggers.sql`** —
  - `handle_profile_contact_sync()` (profiles INSERT/UPDATE): resolves onto the spine, sets `profile_id`,
    flips to `internal_user`, and mirrors account state into `platform_status`
    (`invited` while not onboarded → `active` once done → `inactive` when deactivated). Skips
    `IndustryPartner`.
  - `handle_member_onboarding_contact_link()` (member_onboarding INSERT): resolves/links an
    `internal_contact` and records `member_onboarding_id`.

### Application

- **`src/lib/comms-crm.ts`** — new types & pure helpers: `CrmContactKind`, `CrmPlatformStatus`,
  `normalizeEmail`, `isInternalEmail`, `deriveContactKind`, `segmentFromKind`, normalizers, labels, and the
  extended `CrmContactRecord` (now carries `contactKind`, `platformStatus`, `intendedRole`, `profileId`).
- **`src/lib/comms-crm-data.ts`** — extracted a pure, unit-testable **`assembleCrmRecords()`** that does the
  spine-first dedup (profiles → `internal_user`, campus → `internal_contact`, CRM overlay by
  profile/email/legacy link). `loadCrmDirectory()` now fetches (incl. `status`/`onboarding_completed`,
  with graceful fallback) and delegates to it.
- **`src/app/app/comms/crm/actions.ts`** — `saveCrmContact` persists `contact_kind`, `intended_role`, and
  `profile_id`; `deleteCrmContact` gates on `contact_kind`/`profile_id` (platform users undeletable);
  **new `inviteContactToPlatform()`** — the only path that promotes a contact to a user (PlatformAdmin,
  reuses `inviteUserAccount`, records `intended_role` + `platform_status='invited'`).
- **CRM UI** (`comms-crm-workspace.tsx`, `crm/people/page.tsx`, `crm/page.tsx`) — kind badges, a
  `platform_status` pill, a kind filter (replacing the binary internal/external filter), kind-based counts,
  an "Intended role if invited" hint field, and the "Invite to platform" action surfaced on the contact
  pane. New contacts default to `internal_contact` and can never be created as users/pending.

### Tests & docs

- **`src/test/unit/comms-crm-identity.test.ts`** — 19 tests covering the helpers and `assembleCrmRecords`
  (campus = internal_contact; pending only from incomplete onboarding; **promotion produces no duplicate**;
  campus-linked-to-profile dedup; external stays external).
- `docs/DATA_DICTIONARY.md` §9 documents the model; ADR-0007 moved to **accepted**; concept + sprint docs
  reconciled with the `role`-as-user-type reality.

---

## 3 · File map

```
supabase/migrations/
  00062_contact_identity_columns.sql      (S13-T01)
  00063_crm_resolve_contact.sql           (S13-T02)
  00064_contact_identity_backfill.sql     (S13-T03)
  00065_contact_identity_triggers.sql     (S13-T04, T09)
src/lib/
  comms-crm.ts                            (helpers/types — T02 pure parts, T06, T07)
  comms-crm-data.ts                       (assembleCrmRecords + loadCrmDirectory — T05)
src/app/app/comms/crm/
  actions.ts                              (saveCrmContact, deleteCrmContact, inviteContactToPlatform — T07, T08)
  people/page.tsx                         (kind filter — T06)
  page.tsx                                (kind counts — T06)
src/components/comms/
  comms-crm-workspace.tsx                 (kinds, status, hint, invite — T06, T07, T08)
src/test/unit/
  comms-crm-identity.test.ts              (T10)
docs/
  DATA_DICTIONARY.md (§9), ADR/0007-unified-contact-identity.md, CONTACT_DATA_MODEL_CONCEPT.md
```

---

## 4 · End-to-end flows

**Add an internal contact (B).** Comms creates a contact in the CRM (or registers a new member, or a
campus member is imported) → `crm_resolve_contact` / the BEFORE trigger sets `internal_contact` /
`platform_status='none'`. No account, not pending.

**Invite to platform (B → A).** Admin clicks "Invite to platform" on the contact, picks a role →
`inviteContactToPlatform` → `inviteUserAccount` (Supabase invite) and `platform_status='invited'` →
Supabase creates `auth.users` → `handle_new_user` creates the profile → `handle_profile_contact_sync`
resolves **the same spine** by email, sets `profile_id`, flips to `internal_user`, sets `platform_status`
(`invited` until onboarding completes, then `active`). **No duplicate row.**

**Deactivate.** Admin sets `profiles.status='inactive'` → the profile-sync trigger mirrors
`platform_status='inactive'` onto the spine.

---

## 5 · Verification

| Check | Result |
|-------|--------|
| `pnpm typecheck` | ✅ clean |
| `pnpm lint` | ✅ no new issues (1 pre-existing unrelated warning) |
| `pnpm test` | ✅ 281/281 (30 files), incl. 19 new identity tests |

> Migrations were authored against the live schema but not executed here (no Supabase instance in this
> environment). Apply with `pnpm db:push`. The backfill (`00064`) ships a dry-run report query — run it in
> a populated environment before the destructive dedup step.

---

## 6 · Decisions & follow-ups

- **Authorizer for "Invite to platform" = PlatformAdmin** (reuses `inviteUserAccount`'s existing guard).
  The sprint flagged "confirm admin vs comms"; defaulting to admin is the safe choice. *Open question for
  the product owner:* should the comms team also be able to invite, or only stage `intended_role`?
- **Email is the identity key.** Shared/alias mailboxes can't be auto-distinguished. Follow-up: a manual
  **merge/split** tool for contacts (noted in the concept's risks). Until then, the partial unique index
  prevents accidental duplicate emails.
- **A spine row is materialised per internal profile** by the sync trigger. This is intentional (the spine),
  comms-only by RLS, and cheap; `IndustryPartner` profiles are excluded to match existing directory scope.
- **`segment` is retained as a derived column** for back-compat and is still written by the BEFORE trigger;
  it can be retired once nothing reads it.
