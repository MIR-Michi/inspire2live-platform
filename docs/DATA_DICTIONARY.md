# Data Dictionary — Inspire2Live Platform

> **Purpose:** Human-readable database schema reference. Table descriptions, key columns, relationships.  
> **Source of truth:** `supabase/migrations/` (00001–00168) and `src/types/database.ts`  
> **Audience:** Developers writing queries, new team members understanding the data model.  
> **Last reviewed:** 2026-07-17

---

## 1 · Schema Overview

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  profiles    │────<│ initiative_members│>────│ initiatives │
└─────────────┘     └──────────────────┘     └─────────────┘
       │                                            │
       │            ┌──────────────────┐     ┌──────┴──────┐
       │────────────│  invitations     │     │   tasks     │
       │            └──────────────────┘     ├─────────────┤
       │                                     │ milestones  │
       │            ┌──────────────────┐     ├─────────────┤
       │────────────│ congress_members │     │  evidence   │
       │            └────────┬─────────┘     └─────────────┘
       │                     │
       │            ┌────────┴─────────┐
       │            │   congresses     │
       │            └────────┬─────────┘
       │                     │
       │            ┌────────┴─────────────────────┐
       │            │ congress_workspace_* tables   │
       │            └──────────────────────────────┘
       │
       │            ┌──────────────────┐
       │────────────│ patient_stories  │
       │            └──────────────────┘
       │
       │            ┌──────────────────┐
       └────────────│  notifications   │
                    └──────────────────┘
```

---

## 2 · Core Tables

### `profiles`
User accounts — one row per authenticated user. Extends Supabase `auth.users`.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Matches `auth.users.id` |
| `email` | text | User email (unique) |
| `name` | text | Display name |
| `role` | text | Platform role (see Role Permission Model) |
| `avatar_url` | text | URL to avatar in Supabase Storage |
| `bio` | text | Short biography |
| `organization` | text | Affiliated organization |
| `country` | text | Country of residence |
| `onboarding_complete` | boolean | Whether onboarding wizard was completed |
| `created_at` | timestamptz | Account creation time |
| `updated_at` | timestamptz | Last profile update |

**RLS:** Owner can read/write own row. Admins can read all.

---

### `initiatives`
Research initiatives — the core organizational unit.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `title` | text | Initiative name |
| `description` | text | Full description |
| `status` | text | `active`, `completed`, `archived` |
| `health` | text | RAG status: `green`, `amber`, `red` |
| `lead_id` | uuid (FK → profiles) | Initiative lead |
| `created_at` | timestamptz | Creation time |
| `updated_at` | timestamptz | Last update |

**RLS:** Authenticated users with space access can read. Members can edit.

---

### `initiative_members`
Many-to-many: users ↔ initiatives.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `initiative_id` | uuid (FK → initiatives) | The initiative |
| `user_id` | uuid (FK → profiles) | The member |
| `role` | text | `lead`, `contributor`, `observer` |
| `joined_at` | timestamptz | When user joined |

---

### `tasks`
Work items within an initiative.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `initiative_id` | uuid (FK → initiatives) | Parent initiative |
| `title` | text | Task name |
| `description` | text | Task details |
| `status` | text | `todo`, `in_progress`, `done`, `blocked` |
| `priority` | text | `low`, `medium`, `high`, `urgent` |
| `assignee_id` | uuid (FK → profiles) | Assigned user |
| `due_date` | date | Deadline |
| `created_at` | timestamptz | Creation time |

---

### `milestones`
Key deliverables within an initiative.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `initiative_id` | uuid (FK → initiatives) | Parent initiative |
| `title` | text | Milestone name |
| `due_date` | date | Target date |
| `completed_at` | timestamptz | Actual completion (null if pending) |
| `status` | text | `pending`, `completed`, `overdue` |

---

### `evidence`
Supporting documents / files for initiatives.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `initiative_id` | uuid (FK → initiatives) | Parent initiative |
| `title` | text | Document title |
| `file_url` | text | Supabase Storage URL |
| `uploaded_by` | uuid (FK → profiles) | Uploader |
| `created_at` | timestamptz | Upload time |

---

## 3 · Congress Tables

### `congresses`
Congress events with lifecycle states.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `title` | text | Congress name |
| `year` | integer | Congress year |
| `status` | text | `planning`, `active`, `post_event`, `archived` |
| `start_date` | date | Event start |
| `end_date` | date | Event end |
| `location` | text | Venue / virtual |
| `created_at` | timestamptz | Creation time |

### `congress_members`
Congress participation roles.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `congress_id` | uuid (FK → congresses) | The congress |
| `user_id` | uuid (FK → profiles) | The participant |
| `role` | text | `organizer`, `speaker`, `moderator`, `attendee`, `volunteer` |

### Congress Workspace Tables

Created in migration 00014:

| Table | Purpose |
|-------|---------|
| `congress_workstreams` | Workstream tracks within a congress |
| `congress_workspace_tasks` | Tasks for congress preparation |
| `congress_raid_items` | Risk, Assumption, Issue, Dependency log |
| `congress_approvals` | Approval workflows |
| `congress_messages` | Communication threads |
| `congress_activity_log` | Audit trail of workspace actions |

---

## 4 · Patient Stories

### `patient_stories`
Patient-authored narratives with review workflow.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `author_id` | uuid (FK → profiles) | Story author |
| `title` | text | Story title |
| `content` | text | Full narrative |
| `slug` | text | URL-friendly identifier |
| `status` | text | `draft`, `in_review`, `published`, `withdrawn` |
| `reviewer_id` | uuid (FK → profiles) | Assigned reviewer |
| `published_at` | timestamptz | Publication date |
| `created_at` | timestamptz | Creation time |

**RLS:** Drafts visible only to author + assigned reviewer. Published stories are public.

---

## 5 · Invitations & Notifications

### `invitations`
Invitation records for initiative/congress membership.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `scope` | text | `initiative`, `congress`, `platform` |
| `initiative_id` | uuid (FK, nullable) | Target initiative |
| `congress_id` | uuid (FK, nullable) | Target congress |
| `inviter_id` | uuid (FK → profiles) | Who sent the invitation |
| `invitee_email` | text | Invitee email |
| `invitee_user_id` | uuid (FK, nullable) | Invitee if already registered |
| `invitee_role` | text | Proposed role |
| `status` | text | `pending`, `accepted`, `declined`, `revoked` |
| `message` | text | Personal message |
| `created_at` | timestamptz | Sent time |
| `responded_at` | timestamptz | Response time |

### `notifications`
In-app notification feed.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `user_id` | uuid (FK → profiles) | Recipient |
| `type` | text | Notification category (constrained by check) |
| `title` | text | Notification title |
| `body` | text | Notification content |
| `read` | boolean | Read status |
| `link` | text | Deep link URL |
| `created_at` | timestamptz | Creation time |

**Allowed types (notifications_type_check):** `task_assigned`, `milestone_due`, `invitation_received`, `invitation_accepted`, `story_review`, `congress_update`, `initiative_invite`, `congress_invite`, `system`

---

## 6 · Permission System

### `user_space_permissions`
Per-user access level overrides.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `user_id` | uuid (FK → profiles) | Target user |
| `space` | text | Space name or `*` for global |
| `access_level` | text | `invisible`, `view`, `edit`, `manage` |
| `is_global` | boolean | Whether this is a global override |
| `granted_by` | uuid (FK → profiles) | Admin who set the override |
| `created_at` | timestamptz | When override was set |

### `role_default_overrides`
Admin-configurable defaults per role (replaces hardcoded defaults).

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `role` | text | Platform role |
| `space` | text | Space name |
| `access_level` | text | Override level |
| `set_by` | uuid (FK → profiles) | Admin who configured |

---

## 7 · Storage Buckets

| Bucket | Purpose | Access |
|--------|---------|--------|
| `avatars` | User profile photos | Public read, owner write |
| `evidence` | Initiative evidence documents | RLS: initiative members |

---

## 8 · Key Constraints & Indexes

| Constraint | Table | Description |
|-----------|-------|-------------|
| `notifications_type_check` | notifications | CHECK constraint on `type` column |
| `initiative_members_unique` | initiative_members | Unique on `(initiative_id, user_id)` |
| `congress_members_unique` | congress_members | Unique on `(congress_id, user_id)` |
| `invitations_unique_pending` | invitations | Prevents duplicate pending invitations |
| `uq_comms_crm_contacts_normalized_email` | comms_crm_contacts | Partial unique on `normalized_email` (the contact identity match key) |

---

## 9 · Contact Identity Model (Sprint 13)

`comms_crm_contacts` is the **canonical contact spine** — one row per real person —
unifying the CRM, User Management, the new-member dashboard, and Profile. See
`docs/CONTACT_DATA_MODEL_CONCEPT.md` and `docs/ADR/0007-unified-contact-identity.md`.

### `comms_crm_contacts` (identity columns)

| Field | Type | Notes |
|-------|------|-------|
| `contact_kind` | text | `internal_user` (platform user) · `internal_contact` (internal non-user, incl. World Campus members) · `external` (third party). **No `internal_pending`.** |
| `platform_status` | text | `none` · `invited` (= "pending") · `active` · `inactive`. "Pending" only ever arises from a User-Management invite. |
| `profile_id` | uuid (FK → profiles) | Set when the contact is a platform user (category A). |
| `member_onboarding_id` | uuid (FK → member_onboarding) | Links the onboarding checklist. |
| `normalized_email` | text | `lower(trim(email))`; the identity match key (partial-unique). |
| `intended_role` | text | Optional, nullable hint: the platform role ("user type") to apply if/when invited. Does not change kind/status. |
| `segment` | text | **Derived** from `contact_kind` (internal kinds → `internal`, else `external`). Kept for back-compat. |
| `whatsapp_id`, `welcomed_by_peter` | text / boolean | World Campus channel attributes folded onto the spine (campus members are not a separate identity). |

### Functions & triggers

| Object | Purpose |
|--------|---------|
| `crm_resolve_contact(email, name, profile_id)` | Single find-or-create entry point; resolves on normalized email; never duplicates or sets pending. `SECURITY DEFINER`. |
| `crm_contacts_sync_derived()` | BEFORE trigger: keeps `normalized_email` + derived `segment` in sync and defaults `contact_kind`. |
| `handle_profile_contact_sync()` | profiles INSERT/UPDATE: links the spine, flips to `internal_user`, mirrors account state into `platform_status`. |
| `handle_member_onboarding_contact_link()` | member_onboarding INSERT: resolves/links an `internal_contact` and records `member_onboarding_id`. |

### Source-of-truth rules

- **Identity** of an `internal_user` → `profiles` (CRM reads live, never writes back).
- **Identity** of `internal_contact` / `external` → `comms_crm_contacts`.
- **Relationship** data (owner, lifecycle, consent, tags, notes, pipelines) → always the spine.
- **Promotion** (B → A) happens **only** via the "Invite to platform" action; the profile-creation trigger
  links back onto the existing spine, so no duplicate is created.

---

## 10 · Dashboard Composition Preferences (Sprint 19)

### `user_dashboard_preferences`

Kernel-owned, versioned presentation preferences for the adaptive dashboard system. One row exists per user and dashboard. The JSON layout stores presentation choices only and never grants access to widget data.

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | uuid (PK, FK → profiles) | Preference owner; cascades on profile deletion |
| `dashboard_id` | text (PK) | Stable dashboard catalog identifier |
| `layout_version` | integer | Dashboard-definition version used for safe migration |
| `layout` | jsonb | Validated split ratio, preset, density, widget zone/order/size/visibility/collapse state |
| `created_at` | timestamptz | Initial preference creation |
| `updated_at` | timestamptz | Last successful layout save |

**Constraints:** composite primary key `(user_id, dashboard_id)`; dashboard ID format check; positive layout version; `layout` must be a JSON object.

**RLS:** authenticated users can select, insert, update, and delete only rows where `auth.uid() = user_id`; `anon` has no access. Superadmin view-as reads the target layout only through the existing privileged server path and renders it read-only.

**Migration:** `00168_user_dashboard_preferences.sql`.

**Source-of-truth rule:** dashboard catalog/defaults live in `src/kernel/dashboard/catalog.ts`; persisted rows are user overrides and cannot introduce an unknown or unauthorized widget.

---

*Last updated: 2026-07-17 · Maintainer: Michael Wittinger*
