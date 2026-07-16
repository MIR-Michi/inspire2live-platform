# Sprint 18 — Conference Operations Redesign

> **Status:** In progress — operating-page redesign, requirement model, guest overview, and
> instant/logged invites implemented (T01–T06, T09, T11–T13). Guest single-record storage merge
> (T07, T08, T10) and E2E smoke (T14) remain. See `tasks.md` for per-task status.
> **Theme:** Make the per-conference **operating page** the single, honest, time-and-role-aware
> surface for both the team and invited guests — and make invites instant and logged.
> **Depends on:** Sprint 16 modular foundation (`src/modules/events`), the existing
> Conferences space (pipeline stages, prep, guest tokens).
> **Concept:** `docs/CONFERENCE_OPERATIONS_REDESIGN_CONCEPT.md`

## Goal

Shipping this sprint produces:

1. **A de-tabbed operating page.** The `StageRail` (duplicate of the overview's tabs) is
   removed. In its place: a read-only **phase header** (Before → During → After) with a
   date-driven status line, and a single-column stack of **collapsible tiles**. Every field
   is editable at any time.
2. **Time-and-role-aware requests.** The static `STAGE_CHECKLISTS` are replaced by a
   declarative **requirement model**. The page asks for exactly the material that applies
   to *this attendee* at the moment it becomes relevant — presentation only for presenters;
   photos always, but only requested (red) *during/after* the conference.
3. **Traffic-light status.** Provided material is **green (✓)**; missing-and-due material is
   **red (!)**; missing-but-not-yet-due is **neutral (·)**; inapplicable is hidden. Colour is
   always paired with an icon + label. The same vocabulary is reused on the overview cards.
4. **A unified guest experience.** The invite link lands the guest on the **real operating
   page** of the conference they're attending — editable and savable — plus a personal
   **conference overview** of the conferences on their list. The separate guest form,
   separate workspace, and read-only "guest reports" block are retired; guest and team edit
   one record.
5. **Instant, logged invites.** Creating an invite returns the link immediately; delivery
   (WhatsApp/email) runs in the background. Every invite is durably logged — *who, which
   channels, when, delivered or failed* — and surfaced on the operating page and overview.

## Rationale

- **The operating page duplicates the overview's navigation.** `StageRail`
  (`conference-operating-shell.tsx`) renders the same five stage tabs as
  `partitionConferences` (`comms-conferences.ts`). Stage is already chosen in the overview;
  repeating it inside the conference is friction, not information.
- **Static checklists ask the wrong things at the wrong time.** `STAGE_CHECKLISTS`
  (`comms-conference-prep.ts`) shows "Presentation delivered" to pure attendees and offers a
  photos field weeks early. Requests should follow attending type and event timing.
- **There is no honest "missing vs not-due-yet" signal.** Everything is a neutral checkbox,
  so a genuinely overdue abstract looks the same as legitimately-empty photos.
- **Guests live in a parallel app.** `guest-attendance-form.tsx` + `guest-workspace.tsx`
  write `conference_guest_submissions/files/notes`; the team reads `conference_prep`. The two
  only meet as a read-only report block. Guest edits should *be* the operating page.
- **Invites block the coordinator and vanish.** `generateGuestToken` awaits two external
  sends before returning the link, and single invites leave no durable "invited whom" record.

See `docs/CONFERENCE_OPERATIONS_REDESIGN_CONCEPT.md` for the full design (requirement model,
phase engine, guest unification, invite log, and the additional suggestions).

## Technical approach

**Requirement model (domain, pure).** New `conference-requirements.ts` in
`src/modules/events/domain`: a declarative `Requirement[]` with `appliesWhen` / `dueFrom` /
`isProvided`, a `deriveConferencePhase(dates, today, stage)` helper, and
`deriveRequirementStatus(req, ctx) → 'provided'|'due'|'upcoming'|'na'`. Fully unit-tested;
replaces `STAGE_CHECKLISTS` as the source of what-to-ask. Attending type is unified onto a
single `attending_type` field with a back-compat mapping from `has_presentation`/`role`.

**Operating shell.** `conference-operating-shell.tsx` loses `StageRail` and the per-stage
panel switch; it renders a phase header + a `<CollapsibleTile>` stack driven by the
requirement model. Auto-expand tiles with a `due` requirement; persist manual expand state.
Single-column, mobile-first; the sidebar collapses into a Details tile on small screens.

**Guest = operating page.** Token-scoped RPCs (SECURITY DEFINER, `search_path=''`) let a
magic-link guest read/write the operating record for the conference(s) their token covers,
behind a guest permission mask. `/congress/attend/[token]` becomes the guest overview (their
conference list, same cards as internal); each card opens the operating page. Uploads unify
on one files table + storage bucket for internal and guest alike. Guest submission/notes data
is folded into the operating record; the submission row remains as the intake/link event.

**Invites.** `generateGuestToken` inserts the token, returns the URL, and schedules the send
via `after()` (Next.js) instead of awaiting it. A `conference_guest_invites` record captures
recipient/channels/status/`sent_at`/`invited_by`; the background send updates its status. The
operating page + overview render the invite log with a retry affordance.

**One migration group.** `attending_type` on `conference_prep`; a shared guest/internal files
table (or generalisation of `conference_guest_files`); `conference_guest_invites`; token RPCs
for operating-record read/write scoped to the token's conferences. RLS mirrors the existing
comms/guest split.

## Acceptance criteria

- [ ] The operating page renders **no stage tabs**; a read-only phase header (Before ·
      During · After) with a date-driven status line replaces `StageRail`; all fields are
      editable regardless of phase. _(S18-T03)_
- [ ] The static `STAGE_CHECKLISTS` are gone; requests are produced by the declarative
      requirement model; **presentation** only appears for presenters and **photos** appear
      always but only turn red **during/after** the conference. _(S18-T01, T02, T05)_
- [ ] Every requirement/tile shows **green = provided, red = due, neutral = not-yet-due**,
      colour paired with icon + accessible label; inapplicable items are hidden; the overview
      cards reuse the same status dot. _(S18-T06)_
- [ ] Tiles are collapsible/expandable, auto-expand when something is due, and the layout is
      single-column and usable on a phone. _(S18-T04)_
- [ ] Internal and guest uploads use one shared files store; internal users can upload files
      directly (not only paste links). _(S18-T07)_
- [ ] An invited guest opening their link lands on the **operating page** of their conference,
      can **edit and save** it, and can open a **personal overview** of the conferences on
      their list; the separate guest form/workspace and the read-only guest-reports block are
      retired. _(S18-T08, T09, T10)_
- [ ] Creating an invite returns the link **without waiting** on WhatsApp/email; delivery runs
      in the background. _(S18-T11)_
- [ ] Every invite is durably logged (recipient, channels, status, `sent_at`, `invited_by`)
      and shown on the operating page + overview, with a retry on failure. _(S18-T12)_
- [ ] Docs + `REQ-CONF-OPS-*` recorded; `docs/TRACEABILITY.md`, `docs/README.md`,
      `sprints/README.md` updated. _(S18-T13)_
- [ ] Typecheck, lint, unit+coverage, and e2e green; both the internal and guest paths
      smoke-tested end-to-end. _(S18-T14)_

## Out of scope (later / backlog)

- Rebuilding conference discovery / the overview pipeline or AI enrichment.
- Removing or changing the pipeline **stage** concept itself (stages stay; only the operating
  page's tab UI is removed).
- New notification channels beyond the existing WhatsApp/email senders.
- Offline venue support.
- Suggestions BL-01…BL-08 below unless pulled into a task.

## References

- Concept: `docs/CONFERENCE_OPERATIONS_REDESIGN_CONCEPT.md`
- Operating page: `src/modules/events/ui/conferences/conference-operating-shell.tsx`
- Requests/prep: `src/modules/events/domain/comms-conference-prep.ts`
- Overview/stages: `src/modules/events/domain/comms-conferences.ts`
- Guest flow: `src/app/congress/attend/[token]/**`, `src/app/app/comms/conferences/guest-token-actions.ts`
- Invite send: `src/modules/events/domain/congress-guest-tokens.ts`
- Migrations: `00088`, `00100`, `00108`, `00110`, `00112`
- Conventions: `sprints/README.md`, `docs/IMPLEMENTATION_GUIDE.md`, ADR-0009
</content>
