# Contact Data Model — Current State, Target Concept & Gap-Closing Sprint

> **Status:** proposed · **Date:** 2026-06-21 · **Owner:** @michael.wittinger
> **Related:** `docs/ADR/0007-unified-contact-identity.md`, `sprints/sprint-13-contact-identity-unification/`
> **Code touchpoints:** `supabase/migrations/00048,00052,00053,00058`, `src/lib/comms-crm-data.ts`, `src/lib/member-onboarding.ts`, `src/app/app/comms/crm/actions.ts`, `src/app/app/admin/users/actions.ts`

---

## 1 · Purpose

We need **one clear, authoritative way to represent a person** across the platform and to define how the
four places that hold person data — **User Management, CRM, the new-member onboarding dashboard, and the
user Profile** — are set up, integrated and kept in sync.

Three contact categories must be first-class and unambiguous:

| # | Category | Definition | Example |
|---|----------|------------|---------|
| **A** | **Internal — platform user** | Has a Supabase auth account + `profiles` row. | A comms team member who logs in. |
| **B** | **Internal — non-platform user** | An Inspire2Live person (typically `@inspire2live.org`) tracked in the CRM but **not yet** on the platform. | An I2L stakeholder/staff member to be onboarded later. |
| **C** | **External** | A third-party contact (external email), tracked in the CRM only. | A journalist, partner contact, clinician we nurture. |

A core requirement is **anticipation**: category-**B** people exist today only as CRM internals, but will
**later be invited to the platform according to their user type**. The model must make that promotion a
*link*, never a *duplicate*.

---

## 2 · Current State (as built)

Person data lives in **four tables that are not linked by any stable person key**, plus an account-invite
path that bypasses all of them.

### 2.1 The four identity stores

| Store | Table | Represents | Key columns | Access |
|-------|-------|-----------|-------------|--------|
| **Profile / Users** | `profiles` (FK → `auth.users`) | Category **A** | `role` (8 canonical), `user_type` (`default`/`comms`/`board`/`partner`), `status` (`active`/`inactive`), `email` **unique** | User owns own row; admin manages |
| **CRM** | `comms_crm_contacts` | Overlay for **A/B/C** | `segment` (`internal`/`external`), `source_type` (`manual`/`profile`/`campus_member`), `source_id`, `person_type` (`comms`/`patient_advocate`/…) | Comms-team/admin only (`is_comms_team_or_admin()`) |
| **Community** | `campus_members` | World Campus / WhatsApp stakeholders | `platform_profile_id` (optional → `profiles`), `whatsapp_id` | Comms-team/admin |
| **Onboarding** | `member_onboarding` (+ `_tasks`) | New-member checklist | `profile_id` (optional), `status` (`pending`/`active`/`declined`/`completed`) | Comms-team/admin |

Account creation is a **fifth, separate path**: `inviteUserAccount()` in
`src/app/app/admin/users/actions.ts` calls Supabase `auth.admin.inviteUserByEmail` with a `role`. It does
**not** touch the CRM, campus members, or onboarding records.

### 2.2 How they "integrate" today

There is **no persisted unified entity**. Integration happens only at **read time**, inside
`loadCrmDirectory()` (`src/lib/comms-crm-data.ts`):

1. Every `profiles` row (except `IndustryPartner`) becomes an **internal** record.
2. Every `campus_members` row becomes an **external** record (with an optional profile join via
   `platform_profile_id`).
3. Every `comms_crm_contacts` row is overlaid on top, **deduped by the composite key
   `source_type:source_id`**.
4. For internal-profile contacts, **profile identity always wins** (name, picture, bio, role, org, email,
   location, expertise) — the CRM row contributes only relationship data (owner, lifecycle, consent,
   follow-up, tags, notes). This is the one sync rule that is clearly implemented.

`member_onboarding` is auto-created by a trigger **only** for `profiles` whose email ends in
`@inspire2live.org` (migration `00058`), or manually via the new-member dashboard. It is **not** linked to
any CRM contact.

### 2.3 Where each category lives today

- **A (internal user):** `profiles` row → surfaces as an internal CRM record; optional `comms_crm_contacts`
  overlay with `source_type='profile'`.
- **B (internal non-user):** the only home is a `comms_crm_contacts` row with `source_type='manual'`,
  `segment='internal'`. Nothing ties it to a future profile; no intended role/user type is recorded.
- **C (external):** `comms_crm_contacts` (`source_type='manual'`) and/or a `campus_members` record,
  `segment='external'`.

---

## 3 · Gap Analysis

| # | Gap | Why it hurts |
|---|-----|--------------|
| **G1** | **No canonical contact identity / no email-keyed matching.** The same human can simultaneously be a `profile`, a `campus_member`, a `comms_crm_contacts` row, and a `member_onboarding` row, with nothing linking them. | Duplicates and divergent data; impossible to answer "who is this person, everywhere?" |
| **G2** | **`segment` is binary (internal/external).** It cannot distinguish category **B** (internal, *not* a user) from **A** (internal user). | The most important new requirement — the "internal non-platform user" — has no clean representation. |
| **G3** | **No anticipation fields.** A category-B contact carries no `intended_role` / `intended_user_type` / platform-status. | We cannot pre-stage stakeholders for onboarding "by user type", nor report on who is queued. |
| **G4** | **Promotion = duplication.** When a B contact is invited and a `profiles` row appears, `loadCrmDirectory` emits **two** internal records (one from the manual CRM row, one from the new profile) — there is no email match to merge them. | Dirty directory exactly at the moment that matters; manual cleanup. |
| **G5** | **Account-invite path is disconnected.** `inviteUserByEmail` ignores CRM, onboarding and campus data, and only takes `role` (not `user_type`). | The CRM cannot drive onboarding; user_type must be set manually afterwards. |
| **G6** | **Onboarding ↔ CRM not linked.** A manually-registered new member (no profile yet) lives in `member_onboarding` but may not exist in the CRM, and vice-versa. | Two parallel "people to onboard" lists; double entry. |
| **G7** | **No email normalization / cross-source uniqueness.** `profiles.email` is unique in isolation; CRM/campus emails are free text with no normalization. | Matching by email is unreliable (case, whitespace, aliases). |
| **G8** | **Sync direction only partially formalized.** Profile-wins is implemented for internal records, but there is no documented rule set for the other directions, and no audit/event when identity changes (promotion, deactivation). | Behaviour is implicit in one function; fragile as the app grows. |

---

## 4 · Target Concept

### 4.1 Principle: one person = one **Contact spine**

Keep the pragmatic, overlay-based architecture the codebase already uses (no big-bang master-table rewrite),
but make the CRM contact the **canonical spine** for a person and resolve identity on **normalized email**.
Every other store *links to* the contact rather than duplicating it.

```
                         ┌──────────────────────────────┐
                         │      comms_crm_contacts       │   ← canonical Contact spine
                         │  (one row per real person)    │
                         │                               │
   profiles ───1:0..1───►│ profile_id          (→ A)     │
   campus_members ──────►│ campus_member_id    (→ C/B)   │
   member_onboarding ───►│ member_onboarding_id          │
                         │                               │
                         │ normalized_email  (match key) │
                         │ contact_kind                  │
                         │ intended_role, intended_user_type
                         │ platform_status               │
                         └──────────────────────────────┘
```

### 4.2 Replace binary `segment` with `contact_kind`

Add a stored, constrained `contact_kind` (keep `segment` as a derived back-compat column):

| `contact_kind` | Category | Rule | Backing record |
|----------------|----------|------|----------------|
| `internal_user` | **A** | `profile_id IS NOT NULL` | `profiles` is source of truth for identity |
| `internal_pending` | **B** | no `profile_id`; `@inspire2live.org` email **or** explicit internal flag | CRM is the only home until promoted |
| `external` | **C** | third-party email | CRM (± `campus_members`) |

`segment` is derived: `internal_user`/`internal_pending` → `internal`; `external` → `external`. Existing RLS
and filters that read `segment` keep working unchanged during migration.

### 4.3 Anticipation: pre-stage stakeholders by user type

Category-B contacts carry the onboarding intent so they can be invited later **by user type**:

| Column | Purpose |
|--------|---------|
| `intended_role` | The `profiles.role` to assign on invite (8 canonical values). |
| `intended_user_type` | The `profiles.user_type` to assign (`default`/`comms`/`board`/`partner`). |
| `platform_status` | `not_invited` → `invited` → `active` → `inactive`. Mirrors account lifecycle so the CRM shows who is on the platform and who is queued. |

This makes "onboard all `board` stakeholders" a query, and turns the new-member dashboard into a worklist
sourced directly from the CRM.

### 4.4 Identity resolution (find-or-create)

A single DB function `crm_resolve_contact(email, name, source, source_id)` is the **only** way contacts are
created from any entry point. It:

1. Normalizes the email (`lower(trim(email))`).
2. Finds an existing contact by `normalized_email` (or by the relevant link id).
3. Creates one if none exists; otherwise links the new source to the existing spine.
4. Sets/keeps `contact_kind` per the rules in §4.2.

A **partial unique index** on `normalized_email` (where not null) makes the match authoritative.

### 4.5 Promotion flow (B/C → A) — link, never duplicate

```
CRM contact (internal_pending)            ┌── 1. Comms/Admin clicks "Invite to platform"
   intended_role / intended_user_type ───►│      on the contact (or new-member dashboard)
                                          │
                                          ▼
                       inviteUserAccount(email, intended_role, intended_user_type)
                                          │   (Supabase auth.admin.inviteUserByEmail)
                                          ▼
                          auth.users insert → handle_new_user() trigger
                                          │   creates profiles row (role + user_type)
                                          ▼
                 profiles AFTER INSERT trigger → crm_resolve_contact(email…)
                                          │   matches existing spine by normalized_email
                                          ▼
            contact.profile_id = new profile · contact_kind = 'internal_user'
            platform_status = 'active' · member_onboarding linked/created
```

No duplicate internal record is ever emitted, because the profile trigger resolves back onto the existing
contact spine.

### 4.6 Synchronization / source-of-truth matrix

| Field group | Source of truth | Sync rule |
|-------------|-----------------|-----------|
| **Identity** (name, picture, bio, email, org, location, expertise) for `internal_user` | `profiles` (user-owned) | CRM **reads live** from profile; never writes back (already implemented in `loadCrmDirectory`). |
| **Identity** for `internal_pending` / `external` | `comms_crm_contacts` | CRM is authoritative until/unless a profile is linked. |
| **Relationship** (owner, lifecycle, consent, follow-up, tags, notes, pipelines) | `comms_crm_contacts` | Always on the spine, for all kinds. |
| **Community / channel** (WhatsApp id, campus affiliations) | `campus_members` | Linked via `campus_member_id`; CRM reads, comms edits in campus log. |
| **Provisioning** (onboarding checklist, account status) | `member_onboarding` + `profiles.status` | Linked via `member_onboarding_id`; `platform_status` mirrors `profiles.status`. |
| **Role / user_type** | `profiles` once `internal_user`; `intended_*` on the contact before that | On promotion, `intended_*` seed the profile; thereafter the profile wins. |

### 4.7 Access / RLS

The spine stays in `comms_crm_contacts`, so the existing **comms-team/admin chokepoint
(`is_comms_team_or_admin()`) is unchanged**. Profiles remain user-owned. The only new surface is the
"Invite to platform" action, which already requires `PlatformAdmin` (reuse `inviteUserAccount`'s guard) or a
comms-with-admin escalation — to be confirmed in the sprint.

---

## 5 · What changes for each surface

| Surface | Today | Target |
|---------|-------|--------|
| **Profile** | Source of truth for an internal user's identity. | Unchanged. On creation it resolves onto the contact spine (no orphan). |
| **User Management** (`/app/admin/users`) | Invites by `role` only; separate from CRM. | `inviteUserAccount` also accepts `user_type`; can be launched from a CRM contact; sets `platform_status`. |
| **CRM** (`/app/comms/crm`) | Internal/External only; duplicates on promotion. | Three kinds (A/B/C) with badges + filter; `intended_role`/`intended_user_type` on B; "Invite to platform"; dedup-safe. |
| **New-member dashboard** | Standalone onboarding list; auto-row only for `@inspire2live.org` profiles. | Each onboarding record links a CRM contact; can be created from a B contact; invites flow through the same path. |

---

## 6 · Migration & rollout strategy

1. **Additive schema first** (`contact_kind`, `profile_id`, `campus_member_id`, `member_onboarding_id`,
   `normalized_email`, `intended_role`, `intended_user_type`, `platform_status`) — all nullable/defaulted,
   nothing breaks.
2. **Backfill + dedup**: normalize emails; collapse profile/campus/manual rows that share an email into one
   spine; populate links; set `contact_kind` from existing data.
3. **Switch reads**: refactor `loadCrmDirectory` to assemble from the explicit links instead of the
   `source_type:source_id` heuristic.
4. **Switch writes**: route all creation through `crm_resolve_contact`; update the `profiles` and
   `member_onboarding` triggers.
5. **Ship UI**: kinds, intent fields, invite action.
6. **Retire** `segment` writes (keep the derived column) once nothing depends on it.

Each step is independently shippable behind the existing comms-only access, so risk stays contained.

---

## 7 · The gap-closing sprint

See **`sprints/sprint-13-contact-identity-unification/`** for the two-week sprint (`S13-T01…T10`) that
implements §4–§6: schema, identity-resolution RPC, backfill/dedup, trigger rewiring, directory refactor,
CRM kind/intent UI, the unified "Invite to platform" action, onboarding↔CRM linkage, and tests + data-
dictionary/ADR updates.
