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
| **A** | **Internal — platform user** | An Inspire2Live person who was **invited via User Management** and therefore has (or is being provisioned with) a Supabase auth account + `profiles` row. | A comms team member who logs in. |
| **B** | **Internal — contact (non-user)** | An Inspire2Live person tracked in the CRM or new-members dashboard who is **not a platform user and is not currently meant to be one**. **World Campus / WhatsApp community members are category B** — internal contacts without platform access (not external). | An I2L stakeholder/staff member, or a World Campus community member, we track but don't give an account. |
| **C** | **External** | A third-party contact (external email), tracked in the CRM only. | A journalist, partner contact, clinician we nurture. |

**Important framing (corrected):** category **B is the normal, terminal state for most internal contacts** —
they are *not* "pending" and carry no implication of future onboarding. A contact becomes category **A only
through an explicit "Invite to platform" action in User Management.** "Pending" is *not* a category; it is a
transient **state of an already-invited internal user** whose invite has not yet been accepted.

A core requirement is **anticipation**: when the organisation *does* decide to onboard a category-B person
(later, by user type), the model must make that promotion a *link*, never a *duplicate* — without forcing
every internal contact to be pre-classified as a future user.

---

## 2 · Current State (as built)

Person data lives in **four tables that are not linked by any stable person key**, plus an account-invite
path that bypasses all of them.

### 2.1 The four identity stores

| Store | Table | Represents | Key columns | Access |
|-------|-------|-----------|-------------|--------|
| **Profile / Users** | `profiles` (FK → `auth.users`) | Category **A** | `role` (8 canonical), `user_type` (`default`/`comms`/`board`/`partner`), `status` (`active`/`inactive`), `email` **unique** | User owns own row; admin manages |
| **CRM** | `comms_crm_contacts` | Overlay for **A/B/C** | `segment` (`internal`/`external`), `source_type` (`manual`/`profile`/`campus_member`), `source_id`, `person_type` (`comms`/`patient_advocate`/…) | Comms-team/admin only (`is_comms_team_or_admin()`) |
| **Community** | `campus_members` | World Campus / WhatsApp stakeholders — **rendered as `external` today (a misclassification: they are internal contacts)** | `platform_profile_id` (optional → `profiles`), `whatsapp_id` | Comms-team/admin |
| **Onboarding** | `member_onboarding` (+ `_tasks`) | New-member checklist | `profile_id` (optional), `status` (`pending`/`active`/`declined`/`completed`) | Comms-team/admin |

Account creation is a **fifth, separate path**: `inviteUserAccount()` in
`src/app/app/admin/users/actions.ts` calls Supabase `auth.admin.inviteUserByEmail` with a `role`. It does
**not** touch the CRM, campus members, or onboarding records. **This invite is the only event that turns a
person into a platform user (category A).**

> Note: `member_onboarding.status` already uses the word `pending`, but it means "the comms team has not yet
> confirmed this onboarding record" — it is *not* the platform-account state and should not be conflated with
> category B. See §4.3.

### 2.2 How they "integrate" today

There is **no persisted unified entity**. Integration happens only at **read time**, inside
`loadCrmDirectory()` (`src/lib/comms-crm-data.ts`):

1. Every `profiles` row (except `IndustryPartner`) becomes an **internal** record.
2. Every `campus_members` row becomes an **external** record (with an optional profile join via
   `platform_profile_id`).
3. Every `comms_crm_contacts` row is overlaid on top, **deduped by the composite key
   `source_type:source_id`**.
4. For internal-profile contacts, **profile identity always wins** (name, picture, bio, role, org, email,
   location, expertise) — the CRM row contributes only relationship data. This is the one sync rule that is
   clearly implemented.

`member_onboarding` is auto-created by a trigger **only** for `profiles` whose email ends in
`@inspire2live.org` (migration `00058`), or manually via the new-member dashboard. It is **not** linked to
any CRM contact.

### 2.3 Where each category lives today

- **A (internal user):** `profiles` row → surfaces as an internal CRM record; optional `comms_crm_contacts`
  overlay with `source_type='profile'`.
- **B (internal contact, non-user):** a `comms_crm_contacts` row with `source_type='manual'`,
  `segment='internal'` — indistinguishable from category A (both are just `segment='internal'`). World
  Campus members (`campus_members`) *also* belong here, but are currently mis-rendered as `external`.
- **C (external):** `comms_crm_contacts` (`source_type='manual'`), `segment='external'`. (Campus members
  are wrongly lumped in here today.)

---

## 3 · Gap Analysis

| # | Gap | Why it hurts |
|---|-----|--------------|
| **G1** | **No canonical contact identity / no email-keyed matching.** The same human can simultaneously be a `profile`, a `campus_member`, a `comms_crm_contacts` row, and a `member_onboarding` row, with nothing linking them. | Duplicates and divergent data; impossible to answer "who is this person, everywhere?" |
| **G2** | **`segment` cannot distinguish a platform user (A) from an internal non-user contact (B); and campus members are mis-classified as `external`.** Both A and B are just `segment='internal'`, while World Campus members — who are internal contacts — surface as `external`. | The CRM can't show who actually has an account vs who is "just a contact", and community members appear in the wrong category. |
| **G3** | **No platform-account state on the contact.** Nothing records whether an internal person is not-a-user, invited (pending), active, or deactivated. | Can't tell, from the CRM, who is on the platform; can't safely drive or report on invitations. |
| **G4** | **Promotion = duplication.** When a B contact is invited and a `profiles` row appears, `loadCrmDirectory` emits **two** internal records (one from the manual CRM row, one from the new profile) — there is no email match to merge them. | Dirty directory exactly at the moment that matters; manual cleanup. |
| **G5** | **Account-invite path is disconnected and lossy.** `inviteUserByEmail` ignores CRM/onboarding/campus and only takes `role`, not `user_type`. | Inviting a known contact from the CRM isn't possible; user_type must be set by hand afterwards. |
| **G6** | **Onboarding ↔ CRM not linked.** A manually-registered new member lives in `member_onboarding` but may not exist in the CRM, and vice-versa. | Two parallel lists; double entry. |
| **G7** | **No email normalization / cross-source uniqueness.** CRM/campus emails are free text; matching by email is unreliable (case, whitespace). | Identity resolution can't be trusted. |
| **G8** | **Sync direction only partially formalized.** Profile-wins is implemented for internal records, but no documented rule set for the other directions, and no audit/event when account state changes. | Behaviour is implicit in one function; fragile. |

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
   member_onboarding ───►│ member_onboarding_id          │
                         │                               │
                         │ normalized_email  (match key) │
                         │ contact_kind                  │
                         │ platform_status               │
                         │ whatsapp_id, campus fields …  │  ← campus data folds in (no separate ID)
                         └──────────────────────────────┘
```

> **Campus members have no separate identity.** They are not a distinct keyed source linked from the spine —
> they are simply `internal_contact` rows (without platform access). Their channel attributes (WhatsApp id,
> campus affiliations, "welcomed by Peter") fold onto the contact. The `campus_members` table is retained
> only as an optional per-contact detail keyed *by* the contact, never as a separate person identity.

### 4.2 Replace binary `segment` with `contact_kind`

Add a stored, constrained `contact_kind` (keep `segment` as a derived back-compat column):

| `contact_kind` | Category | Rule | Notes |
|----------------|----------|------|-------|
| `internal_user` | **A** | `profile_id IS NOT NULL` — i.e. invited via User Management | `profiles` is source of truth for identity. Created **only** by the invite action. |
| `internal_contact` | **B** | internal I2L person (`@inspire2live.org` email or explicit internal flag) with **no** `profile_id` | **Default, terminal state.** *Not* a user, *not* pending. The normal home for most internal contacts set up in the CRM or new-members dashboard. **World Campus / WhatsApp community members are `internal_contact`** (without platform access) — no separate campus identity. |
| `external` | **C** | third-party email | CRM only. |

`segment` is derived: `internal_user`/`internal_contact` → `internal`; `external` → `external`. Existing RLS
and filters that read `segment` keep working unchanged during migration.

> **There is no `internal_pending` kind.** Being in the CRM or new-members dashboard never makes a contact
> "pending." "Pending" is expressed solely by `platform_status` (next section), and only ever applies once a
> User-Management invite has been sent.

### 4.3 Platform-account state: where "pending" actually lives

Add `platform_status` to the contact, describing the person's relationship to the *platform account*, not
the CRM:

| `platform_status` | Meaning | Applies to |
|-------------------|---------|------------|
| `none` | Not a platform user and none intended. | All `internal_contact` and `external` (the majority). |
| `invited` | **= "pending".** A User-Management invite has been sent; the account is not yet active. | `internal_user` only, transiently. |
| `active` | Has an active platform account. | `internal_user`. |
| `inactive` | Account deactivated (mirrors `profiles.status='inactive'`). | `internal_user`. |

So the only "pending" people are those someone **deliberately invited via User Management**; everyone else is
`none`. This matches the rule: *only I2L contacts invited via User Management are internal users.*

### 4.4 Identity resolution (find-or-create)

A single DB function `crm_resolve_contact(email, name)` is the **only** way contacts are created from any
entry point (manual CRM add, campus import, profile creation, onboarding registration). It:

1. Normalizes the email (`lower(trim(email))`).
2. Finds an existing contact by `normalized_email`.
3. Creates one if none exists (default `contact_kind` = `internal_contact` for I2L emails, else `external`;
   `platform_status='none'`); otherwise updates the existing spine in place.

Campus import calls this like everything else — a campus member resolves to (or creates) an
`internal_contact`; it does **not** mint a separate identity.

A **partial unique index** on `normalized_email` (where not null) makes the match authoritative.

### 4.5 Promotion flow (B → A) — explicit, opt-in, link-never-duplicate

Promotion happens **only** when someone clicks **"Invite to platform"** in User Management (or launches the
same action from a CRM contact / the new-members dashboard). It is never automatic and never implied by
CRM/dashboard data entry. The inviter chooses the `role` and `user_type` **at invite time** (optionally
pre-filled from planning hints — see §4.7).

```
internal_contact (platform_status='none')
        │  Comms/Admin clicks "Invite to platform"; picks role + user_type
        ▼
inviteUserAccount(email, role, user_type)            → platform_status='invited' ("pending")
        │   (Supabase auth.admin.inviteUserByEmail)
        ▼
auth.users insert → handle_new_user() creates profiles row (role + user_type)
        │
        ▼
profiles AFTER INSERT → crm_resolve_contact(email…) matches existing spine by normalized_email
        │
        ▼
contact.profile_id = new profile · contact_kind='internal_user' · platform_status='active'
member_onboarding linked/created
```

Because the profile trigger resolves back onto the existing spine, no duplicate internal record is emitted.
If the invite is never sent, the contact simply stays `internal_contact` / `none` forever — the correct
default.

### 4.6 Synchronization / source-of-truth matrix

| Field group | Source of truth | Sync rule |
|-------------|-----------------|-----------|
| **Identity** (name, picture, bio, email, org, location, expertise) for `internal_user` | `profiles` (user-owned) | CRM **reads live** from profile; never writes back (already implemented). |
| **Identity** for `internal_contact` / `external` | `comms_crm_contacts` | CRM is authoritative (no profile exists). |
| **Relationship** (owner, lifecycle, consent, follow-up, tags, notes, pipelines) | `comms_crm_contacts` | Always on the spine, for all kinds. |
| **Community / channel** (WhatsApp id, campus affiliations) | the contact spine (campus data folds in) | Stored on / keyed by the contact; `campus_members` is at most a per-contact detail table, **not** a separate identity. Campus members are `internal_contact`. |
| **Provisioning** (onboarding checklist) | `member_onboarding` | Linked via `member_onboarding_id`. |
| **Account state** (`platform_status`) | `profiles` + the invite action | `none` until invited; `invited`→`active`→`inactive` thereafter, mirroring `profiles.status`. |
| **Role / user_type** | `profiles` (chosen at invite time) | Only exist once promoted; the profile wins thereafter. |

### 4.7 Anticipating onboarding *without* mislabelling contacts

The original requirement to "anticipate" stakeholder onboarding is satisfied by the promotion flow itself
(§4.5) plus **two optional, non-defaulting planning hints** on the contact:

- `intended_role` and `intended_user_type` — **nullable, empty by default.** Filled only when there is an
  actual plan to invite a specific person, purely to pre-fill the invite dialog. They **do not** change
  `contact_kind` or `platform_status`, and an empty value is the norm.

This keeps category B clean (most contacts have no intent recorded) while still letting the team queue a
named person for a future invite "by user type" when a decision is actually made.

### 4.8 Access / RLS

The spine stays in `comms_crm_contacts`, so the existing **comms-team/admin chokepoint
(`is_comms_team_or_admin()`) is unchanged**. Profiles remain user-owned. The "Invite to platform" action
reuses `inviteUserAccount`'s `PlatformAdmin` guard (comms-with-admin escalation to be confirmed in the
sprint).

---

## 5 · What changes for each surface

| Surface | Today | Target |
|---------|-------|--------|
| **Profile** | Source of truth for an internal user's identity. | Unchanged. On creation it resolves onto the contact spine (no orphan). |
| **User Management** (`/app/admin/users`) | Invites by `role` only; separate from CRM. **The single place that creates internal users.** | `inviteUserAccount` also accepts `user_type`; can be launched from a CRM contact; sets `platform_status='invited'`. |
| **CRM** (`/app/comms/crm`) | Internal/External only; can't tell users from contacts; duplicates on promotion. | Three kinds (A/B/C) with badges + `platform_status`; dedup-safe; optional invite hints. Adding a contact defaults to `internal_contact`/`none` — never pending. |
| **New-member dashboard** | Standalone onboarding list; auto-row only for `@inspire2live.org` profiles. | Each onboarding record links a CRM contact (created as `internal_contact`); becoming a user still requires an explicit User-Management invite. |

---

## 6 · Migration & rollout strategy

1. **Additive schema first** (`contact_kind`, `profile_id`, `member_onboarding_id`, `normalized_email`,
   `platform_status`, the folded campus fields, optional `intended_role`/`intended_user_type`) — all
   nullable/defaulted, nothing breaks. **No `campus_member_id`** — campus members are not a separate identity.
2. **Backfill + dedup**: normalize emails; collapse profile/campus/manual rows sharing an email into one
   spine; populate links; set `contact_kind` (`internal_user` where a profile exists, else `internal_contact`
   for I2L emails **and for all campus members**, else `external`) and `platform_status` (from
   `profiles.status`, else `none`). Campus members move from `external` → `internal_contact`.
3. **Switch reads**: refactor `loadCrmDirectory` to assemble from explicit links instead of the
   `source_type:source_id` heuristic.
4. **Switch writes**: route all creation through `crm_resolve_contact`; update the `profiles` and
   `member_onboarding` triggers.
5. **Ship UI**: kinds, account-state badges, invite action, optional hints.
6. **Retire** `segment` writes (keep the derived column) once nothing depends on it.

Each step is independently shippable behind the existing comms-only access, so risk stays contained.

---

## 7 · The gap-closing sprint

See **`sprints/sprint-13-contact-identity-unification/`** for the two-week sprint (`S13-T01…T10`) that
implements §4–§6.
