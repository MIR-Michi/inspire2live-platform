# Sprint 13 — Tasks

> Status legend: `Not Started` · `In Progress` · `Completed` · `Blocked`.
> All implementation tasks shipped in this sprint — see `REPORT.md` for the full write-up and file map.

| ID | Task | Owner | Status | Notes |
|----|------|-------|--------|-------|
| S13-T01 | **Schema migration** — add `contact_kind` (`internal_user`/`internal_contact`/`external` — **no** `internal_pending`), `profile_id`, `member_onboarding_id`, `normalized_email`, `platform_status` (`none`/`invited`/`active`/`inactive`), folded campus fields (`whatsapp_id`, `welcomed_by_peter`), and optional nullable `intended_role` to `comms_crm_contacts`; CHECK constraints; derived-sync trigger; keep `segment` as derived/back-compat. **No `campus_member_id`.** | Claude | Completed | `supabase/migrations/00062_contact_identity_columns.sql`. (`profiles.user_type` was removed in 00050 → the "user type" is the `role`, so a single `intended_role` is used.) |
| S13-T02 | **`crm_resolve_contact()` RPC** — find-or-create by normalized email; default `contact_kind` = `internal_contact` for I2L emails else `external`, `platform_status='none'`. `security definer`, comms/admin (or trigger) guard. | Claude | Completed | `supabase/migrations/00063_crm_resolve_contact.sql`. Single creation entry point (incl. campus import). Never sets pending; never mints a campus identity. |
| S13-T03 | **Backfill + dedup migration** — normalize emails; collapse rows sharing an email into one spine (repoint children with conflict avoidance); link onboarding by profile; add the partial unique index on `normalized_email` (after dedup). Includes a dry-run report query. | Claude | Completed | `supabase/migrations/00064_contact_identity_backfill.sql`. Campus reclassification handled by 00062 + the directory refactor. |
| S13-T04 | **Rewire triggers** — profiles INSERT/UPDATE → `crm_resolve_contact` → link `profile_id`, flip to `internal_user`, mirror account state into `platform_status` (invited while not onboarded, active once done, inactive when deactivated). member_onboarding INSERT → resolve/link `internal_contact` + record `member_onboarding_id`. | Claude | Completed | `supabase/migrations/00065_contact_identity_triggers.sql`. Kills G4 — promotion only via profile creation. |
| S13-T05 | **Refactor `loadCrmDirectory()`** into a pure, testable `assembleCrmRecords()`; spine-first dedup by profile/email/legacy link; **campus members are `internal_contact`, not `external`**; profile-wins identity preserved. | Claude | Completed | `src/lib/comms-crm-data.ts`. |
| S13-T06 | **CRM UI — kinds, account state & filter** — kind badges (`internal_user`/`internal_contact`/`external`) + `platform_status` pill; kind filter nav + page param; counts by kind; **new contacts default to `internal_contact`/`none`, never pending**. | Claude | Completed | `comms-crm-workspace.tsx`, `comms-crm.ts`, `crm/people/page.tsx`, `crm/page.tsx`. |
| S13-T07 | **CRM UI — optional invite hint** — nullable `intended_role` input (empty by default; does not change kind/status); persisted via `saveCrmContact`; pre-fills the invite dialog. | Claude | Completed | `comms-crm-workspace.tsx`, `crm/actions.ts`. |
| S13-T08 | **Unified "Invite to platform" action** — `inviteContactToPlatform`, the **only** path that promotes a contact to `internal_user`; reuses `inviteUserAccount(email, role)` (PlatformAdmin-guarded); records `intended_role` + `platform_status='invited'`; the profile trigger links back (no dupe). Surfaced from the CRM contact pane. | Claude | Completed | `crm/actions.ts`, `comms-crm-workspace.tsx`. Authorizer = PlatformAdmin (see Open questions in REPORT). |
| S13-T09 | **Onboarding ↔ CRM linkage** — `member_onboarding` INSERT trigger resolves/links a CRM contact and records `member_onboarding_id`; no double entry between dashboard and CRM. | Claude | Completed | Handled at the DB layer (00065) so both `registerNewMember` and the auto @inspire2live.org path are covered. |
| S13-T10 | **Tests + docs** — 19 unit tests for the identity helpers + `assembleCrmRecords` (incl. promotion no-dupe and "CRM/campus entry never yields pending/internal_user"); `DATA_DICTIONARY.md` updated; ADR-0007 → **accepted**; this sprint report. | Claude | Completed | `src/test/unit/comms-crm-identity.test.ts` (281/281 suite green). Manual-merge escape hatch noted as follow-up in REPORT. |

## Dependencies / sequence

```
T01 ─▶ T02 ─▶ T03 ─▶ T04 ─▶ T05 ─▶ {T06, T07} ─▶ T08 ─▶ T09 ─▶ T10
```

T06/T07 ran in parallel after the directory refactor (T05). T08 builds on the invite hint (T07) and the
resolve RPC (T02). T10 closes the sprint.
