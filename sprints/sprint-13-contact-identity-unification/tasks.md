# Sprint 13 — Tasks

| ID | Task | Owner | Status | Notes |
|----|------|-------|--------|-------|
| S13-T01 | **Schema migration** — add `contact_kind` (`internal_user`/`internal_contact`/`external` — **no** `internal_pending`), `profile_id`, `member_onboarding_id`, `normalized_email`, `platform_status` (`none`/`invited`/`active`/`inactive`), folded campus fields (`whatsapp_id`, campus affiliations, …), and optional nullable `intended_role`/`intended_user_type` to `comms_crm_contacts`; CHECK constraints; partial unique index on `normalized_email`; keep `segment` as derived/back-compat. **No `campus_member_id`.** | TBD | Not Started | New migration after `00061`. All additive/nullable. Concept §4.1–§4.3. |
| S13-T02 | **`crm_resolve_contact()` RPC** — find-or-create by normalized email; default `contact_kind` = `internal_contact` for I2L emails else `external`, `platform_status='none'`. `security definer`, comms/admin guard. | TBD | Not Started | Single creation entry point (incl. campus import). Never sets pending; never mints a campus identity. Concept §4.4. |
| S13-T03 | **Backfill + dedup migration** — normalize emails; collapse profile/campus/manual rows sharing an email into one spine; populate `profile_id`/`member_onboarding_id` and fold campus fields; set `contact_kind` (`internal_user` where a profile exists, else `internal_contact` for I2L emails **and all campus members**, else `external`) and `platform_status` (from `profiles.status`, else `none`). **Campus members move `external` → `internal_contact`.** Ship a dry-run report query first. | TBD | Not Started | Review report before destructive merge. Concept §6.2. |
| S13-T04 | **Rewire triggers** — update `handle_new_user` (profiles) and `handle_new_member_onboarding` to call `crm_resolve_contact`; new-member/onboarding/campus rows resolve as `internal_contact`/`none` (never pending). On profile insert (= an invite was accepted), match existing spine by email → set `profile_id`, `contact_kind='internal_user'`, `platform_status='active'`, link onboarding. | TBD | Not Started | Kills G4. Promotion only via profile creation. Concept §4.5. |
| S13-T05 | **Refactor `loadCrmDirectory()`** to assemble from explicit links instead of `source_type:source_id`; guarantee no duplicate records; keep profile-wins identity rule. **Stop mapping campus members to `external`** — they are `internal_contact`. | TBD | Not Started | `src/lib/comms-crm-data.ts`. Concept §4.6. |
| S13-T06 | **CRM UI — kinds, account state & filter** — render `internal_user`/`internal_contact`/`external` badges + `platform_status`; add a kind filter; **new contacts default to `internal_contact`/`none`, never pending**. | TBD | Not Started | `comms-crm-workspace.tsx`, `comms-crm.ts`. |
| S13-T07 | **CRM UI — optional invite hints** — nullable `intended_role` + `intended_user_type` inputs (empty by default; do not change kind/status); persisted via `saveCrmContact`; used only to pre-fill the invite dialog. | TBD | Not Started | `src/app/app/comms/crm/actions.ts`. Concept §4.7. |
| S13-T08 | **Unified "Invite to platform" action** — the **only** path that promotes a contact to `internal_user`; from User Management, a CRM contact, and the new-member dashboard; inviter picks `role` + `user_type` (pre-filled from hints if set); extend `inviteUserAccount` to accept `user_type`; create/link `member_onboarding`; set `platform_status='invited'`. | TBD | Not Started | `src/app/app/admin/users/actions.ts`, `member-onboarding-actions.ts`. Concept §4.5, §5. Confirm authorizer (admin vs comms). |
| S13-T09 | **Onboarding ↔ CRM linkage** — `registerNewMember` resolves/links a CRM contact; dashboard shows the linked contact; remove double entry. | TBD | Not Started | `src/lib/member-onboarding.ts`, `member-onboarding-actions.ts`. Concept §3 G6. |
| S13-T10 | **Tests + docs** — unit tests for `crm_resolve_contact` and directory dedup (incl. promotion no-dupe **and** that CRM/new-member entry never yields pending/internal_user); manual-merge escape hatch for alias/shared mailboxes; update `docs/DATA_DICTIONARY.md`; move ADR-0007 to **accepted**. | TBD | Not Started | `src/test/unit/`. ADR risk: email-key aliases. |

## Dependencies / sequence

```
T01 ─▶ T02 ─▶ T03 ─▶ T04 ─▶ T05 ─▶ {T06, T07} ─▶ T08 ─▶ T09 ─▶ T10
```

T06/T07 can run in parallel once the directory refactor (T05) lands. T08 depends on the anticipation fields
(T07) and the resolve RPC (T02). T10 closes the sprint.
