# Sprint 13 — Tasks

| ID | Task | Owner | Status | Notes |
|----|------|-------|--------|-------|
| S13-T01 | **Schema migration** — add `contact_kind` (`internal_user`/`internal_pending`/`external`), `profile_id`, `campus_member_id`, `member_onboarding_id`, `normalized_email`, `intended_role`, `intended_user_type`, `platform_status` to `comms_crm_contacts`; CHECK constraints; partial unique index on `normalized_email`; keep `segment` as derived/back-compat. | TBD | Not Started | New migration after `00061`. All additive/nullable. Concept §4.2–§4.3. |
| S13-T02 | **`crm_resolve_contact()` RPC** — find-or-create by normalized email (or link id); link source; set `contact_kind` per rules. `security definer`, comms/admin guard. | TBD | Not Started | Single creation entry point. Concept §4.4. |
| S13-T03 | **Backfill + dedup migration** — normalize emails; collapse profile/campus/manual rows sharing an email into one spine; populate `profile_id`/`campus_member_id`/`member_onboarding_id` and `contact_kind`. Ship a dry-run report query first. | TBD | Not Started | Review report before destructive merge. Concept §6.2. |
| S13-T04 | **Rewire triggers** — update `handle_new_user` (profiles) and `handle_new_member_onboarding` to call `crm_resolve_contact`; on profile insert, match existing spine by email → set `profile_id`, `contact_kind='internal_user'`, `platform_status='active'`, link onboarding. | TBD | Not Started | Kills G4 (promotion duplicates). Concept §4.5. |
| S13-T05 | **Refactor `loadCrmDirectory()`** to assemble from explicit links instead of `source_type:source_id`; guarantee no duplicate records; keep profile-wins identity rule. | TBD | Not Started | `src/lib/comms-crm-data.ts`. Concept §4.6. |
| S13-T06 | **CRM UI — kinds & filter** — render `internal_user`/`internal_pending`/`external` badges; add a segment/kind filter; surface `platform_status`. | TBD | Not Started | `comms-crm-workspace.tsx`, `comms-crm.ts`. |
| S13-T07 | **CRM UI — anticipation fields** — `intended_role` + `intended_user_type` inputs on internal-pending contacts; persisted via `saveCrmContact`. | TBD | Not Started | `src/app/app/comms/crm/actions.ts`. Concept §4.3. |
| S13-T08 | **Unified "Invite to platform" action** — from a CRM contact and the new-member dashboard; extend `inviteUserAccount` to accept `user_type`; pass `intended_role`/`intended_user_type`; create/link `member_onboarding`; set `platform_status='invited'`. | TBD | Not Started | `src/app/app/admin/users/actions.ts`, `member-onboarding-actions.ts`. Concept §4.5, §5. Confirm authorizer (admin vs comms). |
| S13-T09 | **Onboarding ↔ CRM linkage** — `registerNewMember` resolves/links a CRM contact; dashboard shows the linked contact; remove double entry. | TBD | Not Started | `src/lib/member-onboarding.ts`, `member-onboarding-actions.ts`. Concept §3 G6. |
| S13-T10 | **Tests + docs** — unit tests for `crm_resolve_contact` and directory dedup (incl. promotion no-dupe); manual-merge escape hatch for alias/shared mailboxes; update `docs/DATA_DICTIONARY.md`; move ADR-0007 to **accepted**. | TBD | Not Started | `src/test/unit/`. ADR risk: email-key aliases. |

## Dependencies / sequence

```
T01 ─▶ T02 ─▶ T03 ─▶ T04 ─▶ T05 ─▶ {T06, T07} ─▶ T08 ─▶ T09 ─▶ T10
```

T06/T07 can run in parallel once the directory refactor (T05) lands. T08 depends on the anticipation fields
(T07) and the resolve RPC (T02). T10 closes the sprint.
