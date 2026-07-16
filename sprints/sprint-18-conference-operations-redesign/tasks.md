# Sprint 18 — Tasks

> Status values: `Not Started` · `In Progress` · `Completed` · `Blocked`.
> See `sprints/README.md` for the workflow. All tasks start `Not Started`.
> Concept: `docs/CONFERENCE_OPERATIONS_REDESIGN_CONCEPT.md`.

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S18-T01 | **Requirement model (domain).** New `conference-requirements.ts`: declarative `Requirement[]` with `appliesWhen` / `dueFrom` / `isProvided`, plus `deriveRequirementStatus → provided\|due\|upcoming\|na`. Pure + unit-tested. | TBD | Completed | `src/modules/events/domain/conference-requirements.ts` + `src/test/unit/conference-requirements.test.ts` (16 tests). Old `STAGE_CHECKLISTS` kept for its tests but no longer drives the UI. |
| S18-T02 | **Phase engine + attending type.** `deriveConferencePhase(dates, today, stage)` → `before\|during\|after`; unify `has_presentation`/guest `role` into one attending type with back-compat mapping. | TBD | Completed | `deriveConferencePhase` + `toAttendingType` in the domain module. No schema change needed — attending type is derived from the existing `has_presentation` (internal) / `role` (guest). |
| S18-T03 | **De-tab the operating page.** Remove `StageRail` and the per-stage panel switch; add a read-only phase header (Before·During·After) + date-driven status line; all fields editable regardless of phase. | TBD | Completed | `conference-operating-shell.tsx` rewritten. Compact stage setter kept in the phase header (status, not tab nav). |
| S18-T04 | **Collapsible tiles + responsive layout.** Status dot + provided/total count; auto-expand on `due`; persist manual state. Single-column, mobile-first. | TBD | Completed | Built on the existing `CollapsibleCard` primitive (localStorage-persisted). `max-w-3xl` single column replaces the desktop `ResizableSplit`. |
| S18-T05 | **Time-and-role requests wired in.** Presentation tile presenter-only; photos `upcoming` before the event, `due` during/after. | TBD | Completed | Driven by the requirement model on both the internal shell and the guest surface. |
| S18-T06 | **Traffic-light status UI.** Green ✓ provided / red ! due / neutral · upcoming; colour + icon + `aria-label`. | TBD | Completed | `StatusDot`/`StatusPill` + `statusTone`/`statusLabel`. Overview-card parity is BL-06 (backlog). |
| S18-T07 | **Unify uploads.** One shared files store + bucket for internal and guest uploads; internal direct upload (not only pasted links). | TBD | Deferred | Backlog BL-04. Requires a storage-bucket RLS change; kept link-paste for internal this sprint to avoid a blind storage migration. |
| S18-T08 | **Guest-scoped operating page.** Guest edits the operating-page surface (tiles / phase / traffic-light) under token auth, co-writing into the shared operating record. | TBD | Completed | Token-scoped RPC `guest_contribute_to_prep` (migration `00163`, SECURITY DEFINER, `search_path=''`) writes guest photos/takeaways/deck/attending-type into `conference_prep`, scoped to a conference the token reported attending. Wired from `guest-workspace.tsx` via `/api/congress-guest/contribute` (best-effort). |
| S18-T09 | **Guest conference overview.** The workspace is now overview-first: a card grid of the conferences on the guest's list, each opening its operating surface; "Add another conference" kept. | TBD | Completed | `guest-workspace.tsx`. Cards carry the same traffic-light dot + phase label. |
| S18-T10 | **Guest/internal data reconciliation.** Fold guest submission/notes/files into the operating record; retire the read-only guest-reports block. | TBD | Completed | `conference-operating-view.ts` (pure, unit-tested) merges team prep photos + guest photos/summaries/comments/slides into one view; the On-site tile now shows guest contributions inline and the standalone `ConferenceGuestReports` tile is removed. Per-guest submission/notes/files remain as the contribution trail + intake/link event. |
| S18-T11 | **Instant invites.** `generateGuestToken` returns the URL right after the token insert; send moves off the critical path via `after()`. | TBD | Completed | `guest-token-actions.ts`. UI shows the link instantly + "delivering in background". |
| S18-T12 | **Invite log + surface.** `conference_guest_invites` (recipient, channels, per-channel status, `sent_at`, `invited_by`); background send updates status; rendered on the operating page. | TBD | Completed | Migration `00162`; `comms-conference-invites.ts` loader/writer; "Invitations sent" list in the Guest invites tile. |
| S18-T13 | **Docs + traceability.** Concept doc; `REQ-CONF-OPS-*`; update `docs/TRACEABILITY.md`, `sprints/README.md`, `CHANGELOG.md`. | TBD | Completed | This commit. |
| S18-T14 | **Verification.** Typecheck, lint, unit green; smoke both paths. | TBD | In Progress | `pnpm typecheck` + `pnpm lint` + `pnpm test` (493) green; `db-migrations` CI validates `00162`/`00163` apply. E2E + live-DB smoke of the guest→prep write path pending a DB with the migrations applied. |

## Suggestions unlocked by this sprint (backlog — concept §8)

| Ref | Item | Concept § | Note |
|---|---|---|---|
| BL-01 | Bulk "invite all assigned attendees" (deduped, background send) | §8 #1 | Cheap once T11/T12 land. |
| BL-02 | Overdue reminder nudge for still-red `due` requirements | §8 #2 | Reuses invite send. |
| BL-03 | Date-driven auto-advance banner copy per transition | §8 #3 | Extends T03 status line. |
| BL-04 | Direct upload everywhere (finish internal-side) | §8 #4 | May partly land in T07. |
| BL-05 | Purposeful per-tile empty states | §8 #5 | Polish on T04/T05. |
| BL-06 | Overview cards adopt the traffic-light dot fully | §8 #6 | Partly in T06. |
| BL-07 | Query hygiene: drop the `ilike '%[conference:%]%'` interaction scan; trim operating `page.tsx` fan-out | §8 #7 | Performance. |
| BL-08 | Accessibility pass (focus order, labels, mobile) | §8 #8 | Compounds with T04/T06. |
</content>
