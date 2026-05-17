# Role & Permission Model

> Purpose: human-readable reference for platform roles, space defaults, user overrides, and the Sprint 01 communications access rule.
> Code reference: `src/lib/platform-roles.ts`, `src/lib/permissions.ts`, `src/lib/role-access.ts`, `middleware.ts`
> Last reviewed: 2026-05-17

## 1. Canonical Platform Roles

The application uses 8 canonical role values stored in `profiles.role`.

| Role Label | Code Value | Primary intent |
|---|---|---|
| Patient Advocate | `PatientAdvocate` | Patient voice and initiative participation |
| Clinician | `Clinician` | Clinical collaboration and initiative work |
| Researcher | `Researcher` | Research collaboration and initiative work |
| Moderator | `Moderator` | Community moderation and communications operations |
| Hub Coordinator | `HubCoordinator` | Cross-initiative and operational coordination |
| Industry Partner | `IndustryPartner` | Scoped external collaboration |
| Board Member | `BoardMember` | Governance and oversight |
| Platform Admin | `PlatformAdmin` | Full platform administration |

Legacy values such as `admin`, `patient_advocate`, and `board_member` are normalized in code by `normalizeRole()` before access is resolved.

## 2. Access Levels

Every platform space resolves to one of four access levels:

| Level | Meaning |
|---|---|
| `invisible` | Hidden from navigation and treated as inaccessible |
| `view` | Read-only access |
| `edit` | Can create and modify content in the space |
| `manage` | Full control including administrative actions |

## 3. Space Defaults

This matrix reflects `ROLE_SPACE_DEFAULTS` in `src/lib/permissions.ts`.

| Space | PatientAdvocate | Clinician | Researcher | Moderator | HubCoordinator | IndustryPartner | BoardMember | PlatformAdmin |
|---|---|---|---|---|---|---|---|---|
| `dashboard` | `view` | `view` | `view` | `view` | `view` | `view` | `view` | `manage` |
| `comms` | `invisible` | `invisible` | `invisible` | `invisible` | `invisible` | `invisible` | `invisible` | `manage` |
| `initiatives` | `edit` | `edit` | `edit` | `view` | `manage` | `invisible` | `view` | `manage` |
| `tasks` | `edit` | `edit` | `edit` | `invisible` | `manage` | `invisible` | `invisible` | `manage` |
| `congress` | `view` | `view` | `view` | `view` | `view` | `view` | `view` | `manage` |
| `stories` | `edit` | `view` | `view` | `manage` | `manage` | `invisible` | `view` | `manage` |
| `resources` | `view` | `view` | `view` | `view` | `manage` | `view` | `view` | `manage` |
| `partners` | `invisible` | `invisible` | `invisible` | `invisible` | `manage` | `edit` | `invisible` | `manage` |
| `network` | `view` | `view` | `view` | `view` | `view` | `view` | `view` | `manage` |
| `board` | `invisible` | `invisible` | `invisible` | `invisible` | `invisible` | `invisible` | `manage` | `manage` |
| `bureau` | `invisible` | `invisible` | `invisible` | `invisible` | `manage` | `invisible` | `invisible` | `manage` |
| `notifications` | `view` | `view` | `view` | `view` | `view` | `view` | `view` | `manage` |
| `profile` | `edit` | `edit` | `edit` | `edit` | `edit` | `edit` | `edit` | `manage` |
| `admin` | `invisible` | `invisible` | `invisible` | `invisible` | `invisible` | `invisible` | `invisible` | `manage` |

## 4. Communications Workspace Rule

Sprint 01 adds a second gate for the communications workspace:

1. The user must be `PlatformAdmin`, or
2. The user must be `Moderator` and have `profiles.comms_team = true`

This is implemented in `src/lib/comms-access.ts` and enforced in three places:

- middleware route protection for `/app/comms/*`
- post-login redirect selection
- navigation visibility in the app shell

Important nuance:

- The default role matrix still keeps `comms` at `invisible` for non-admin roles.
- Eligible moderators gain runtime access only when `comms_team = true`.
- `PlatformAdmin` always has full communications access.

## 5. Runtime Resolution Order

The permission system currently resolves access in this order:

1. `PlatformAdmin` shortcut: always `manage`
2. Explicit `user_space_permissions` override for the requested space
3. Role default from `ROLE_SPACE_DEFAULTS`

Two helper paths exist:

- `resolveAccessFromRole()` is synchronous and used in middleware and client-side filtering
- `resolveAccess()` and `resolveAllSpaces()` read `user_space_permissions` for server-side effective access

## 6. Database-Layer Enforcement

Sprint 01 adds a communications-specific database helper:

- `public.is_comms_team_or_admin()`

RLS is enabled on:

- `intake_items`
- `content_calendar`
- `events`
- `campus_sessions`
- `campus_members`
- `media_assets`

Each of those tables uses a single policy that allows full access only when `public.is_comms_team_or_admin()` returns true.

## 7. Navigation Rules

The side navigation uses two layers:

1. Role-based nav definitions in `src/lib/role-access.ts`
2. Effective access filtering in `src/components/layouts/side-nav.tsx`

For `comms`, there is an extra runtime rule:

- `PlatformAdmin` always sees the Communications item
- `Moderator` sees it only when `showComms` is true, which is derived from `comms_team`
- All other roles do not see it

## 8. Troubleshooting

| Symptom | Check |
|---|---|
| Moderator cannot access `/app/comms/intake` | Confirm `profiles.role = 'Moderator'` and `profiles.comms_team = true` |
| Communications nav missing | Check `showCommsNav` in `src/app/app/layout.tsx` and the user profile query |
| Login redirects to dashboard instead of comms | Check `getPostLoginLandingPath()` and whether the auth callback fetched `comms_team` |
| User can see a space but should not edit it | Check `user_space_permissions` for a global override |
| Database access differs from UI access | Confirm the table has RLS enabled and the policy uses `public.is_comms_team_or_admin()` |

## 9. Related Files

- `src/lib/platform-roles.ts`
- `src/lib/permissions.ts`
- `src/lib/role-access.ts`
- `src/lib/comms-access.ts`
- `src/app/auth/callback/route.ts`
- `src/app/app/layout.tsx`
- `middleware.ts`
- `supabase/migrations/00034_profiles_comms_team.sql`
- `supabase/migrations/00035_comms_permissions_rls.sql`
