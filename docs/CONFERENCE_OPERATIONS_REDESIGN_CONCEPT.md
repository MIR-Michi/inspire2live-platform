# Conference Operations Redesign — Concept

> **Status:** In implementation (Sprint 18) — §3–§5 (requirement model, phase engine, traffic-light)
> and §7 (instant/logged invites) shipped; §6 guest unification delivered at the experience layer
> (shared design + token RPCs), with the single-record storage merge still to come.
> **Scope:** The Conferences space — the per-conference *operating page*, the guest
> experience, and the invite flow.
> **Owning module:** `src/modules/events` (UI in `ui/conferences/`, domain in `domain/`).
> **Supersedes behaviour in:** `conference-operating-shell.tsx`, `guest-workspace.tsx`,
> `guest-attendance-form.tsx`, `guest-token-actions.ts`.

## 1. Problem

The operating page and the overview page have grown apart from each other and from the
guest flow. Concretely:

1. **Duplicated navigation.** The operating page renders a `StageRail`
   (`conference-operating-shell.tsx` → `StageRail`) with the exact same five tabs —
   *Intended · Registered · Ongoing · Follow-up · Archived* — that the overview already
   uses (`comms-conferences.ts` → `partitionConferences`). The user navigates stages
   twice: once to open the conference, again inside it.
2. **Static per-stage checklists.** Requests are a fixed `STAGE_CHECKLISTS` map
   (`comms-conference-prep.ts`) shown regardless of *who is attending* or *when we are
   relative to the event*. A "Presentation delivered" checkbox shows for attendees who
   never present; a "Photos" field is offered weeks before anyone is on-site.
3. **No sense of "what's missing vs what's simply not due yet."** Everything is a
   neutral checkbox. There is no signal that abstract is *overdue* while photos are
   *legitimately empty because the conference hasn't happened*.
4. **A parallel guest app.** Guests get a **different form** (`guest-attendance-form.tsx`)
   and a **different workspace** (`guest-workspace.tsx`) writing to a **different data
   model** (`conference_guest_submissions/files/notes`). Their input lands on the
   operating page only as a read-only `ConferenceGuestReports` block — so the guest and
   the team are editing two different pictures of the same conference.
5. **Slow, unlogged invites.** `generateGuestToken` (`guest-token-actions.ts`) awaits the
   WhatsApp **and** email send before returning the link, so the coordinator waits on two
   external APIs. For single invites nothing durably records *who was invited, through
   which channel, when, and whether it succeeded*.

## 2. Design principles

- **One conference, one operating page.** The team and the guest edit the *same* page,
  the same record; only their permission mask differs.
- **Time and role decide what to ask, not a tab.** The page asks for exactly the material
  that applies to this attendee, at the moment it becomes relevant.
- **Status is honest.** Green = provided. Red = missing *and due*. Neutral = missing but
  not due yet. Never red before its time.
- **The page is a stack, not a wizard.** Collapsible tiles, expanded when they need
  attention, collapsed when done or not-yet-relevant — no forced linear stage stepping.
- **Never block a human on an external API.** Create the link now; deliver it in the
  background; show delivery status as it resolves.

## 3. The requirement model (core new abstraction)

Replace the static `STAGE_CHECKLISTS` with a declarative list of **requirements**. Each
requirement is one piece of info or one file the conference needs, described by three
predicates and rendered to one of four statuses.

```ts
type ConferencePhase = 'before' | 'during' | 'after'      // derived from dates + stage
type AttendingType   = 'attendee' | 'presenter' | 'organizer'

type Requirement = {
  key: string                          // 'abstract' | 'deck' | 'presentation' | 'photos' | 'takeaways' | 'report' …
  label: string
  tile: string                         // which collapsible tile it belongs to
  appliesWhen: (ctx) => boolean        // e.g. presenter-only, or always
  dueFrom: ConferencePhase             // the phase at which "missing" becomes "due" (red)
  isProvided: (prep, files) => boolean // material present?
}

type RequirementStatus =
  | 'provided'   // green  — material present
  | 'due'        // red    — applies, due now, not provided
  | 'upcoming'   // neutral — applies, not due yet, not provided (e.g. photos before the event)
  | 'na'         // hidden  — does not apply to this attendee/format
```

**Derivation** (`deriveRequirementStatus`, pure, unit-tested):

```
if !appliesWhen(ctx)            → 'na'      (hidden)
else if isProvided(...)         → 'provided' (green)
else if phase >= dueFrom        → 'due'      (red)
else                            → 'upcoming' (neutral)
```

**Phase** is derived once per render from the conference dates and today, reconciled with
the pipeline stage (`deriveConferencePhase`):

| Condition | Phase |
|---|---|
| `today < startDate` (or stage ∈ intended/registered) | `before` |
| `startDate ≤ today ≤ endDate` (or stage = ongoing) | `during` |
| `today > endDate` (or stage ∈ follow_up/archived) | `after` |

This makes the two headline rules fall out of the model:

- **Presentation** → `appliesWhen: attendingType === 'presenter'`, so it is `na` (hidden)
  for attendees and never shows red for them.
- **Photos** → `appliesWhen: always`, `dueFrom: 'during'`. Before the event photos are
  `upcoming` (neutral, still visible so the guest knows it's coming); during/after and
  empty, they turn `due` (red).

### Attending type

Today the internal model uses `conference_prep.has_presentation` (bool) and the guest form
uses `role` (attendee/speaker/panelist/organizer/other). We collapse both into a single
**attending type** on the operating record (`attendee` / `presenter` / `organizer`), with a
back-compat mapping (`speaker|panelist|organizer` → `presenter`/`organizer`,
`has_presentation === true` → `presenter`). The requirement model reads only the unified
field.

## 4. Operating page redesign

- **Remove `StageRail`.** No stage tabs on the operating page. Replace with a slim,
  **read-only phase header**: `Before → During → After`, current phase highlighted, plus a
  one-line status banner driven by dates ("Starts in 3 days" · "Happening now" · "Ended —
  time to follow up"). Stage still advances automatically (`auto_advance_conference_stage`
  RPC already runs on load); the header reflects it rather than asking the user to click.
- **Everything is editable anytime.** No "you must be on the Registered tab to edit the
  abstract." Fields render whenever their requirement applies.
- **Collapsible tiles.** The body becomes a single-column stack of tiles (Details ·
  Presentation · People to connect · On-site & photos · Takeaways · Amplify · Tasks ·
  Guests). Each tile header carries a **status dot** (green/red/neutral) and a small
  provided/total count. Auto-expand a tile when it has a `due` requirement; auto-collapse
  when all its requirements are `provided` or all `upcoming`/`na`; expansion state is
  user-overridable and persisted (localStorage, same pattern as `ResizableSplit`).
- **Responsive / mobile-first.** The current `max-w-5xl` + desktop `ResizableSplit` layout
  is replaced by a single column that reflows to one tile-per-row on phones — guests fill
  this in *at the venue on a phone*, so mobile is the primary case, the sidebar becomes a
  collapsible "Details" tile on small screens.

## 5. Traffic-light status, shared vocabulary

One status vocabulary used on **both** the operating page tiles and the overview cards:

| Status | Colour | Icon | Meaning |
|---|---|---|---|
| provided | emerald | ✓ | material is present |
| due | red | ! | applies, due now, still missing |
| upcoming | neutral/grey | · | applies, not due yet |
| na | (hidden) | — | doesn't apply to this attendee |

Status is **never colour-only** — every dot pairs an icon + accessible label
(`aria-label`), so red/green isn't the sole signal (accessibility + colour-blind safety).

## 6. Guest unification

**Goal:** the invite link drops the guest onto the *real operating page* of the conference
they're attending, editable and savable, plus a personal overview of the conferences on
their list. No separate form, no separate workspace, no separate data model.

- **Single surface, two auth paths.** The operating page is rendered for (a) an
  authenticated comms user (RLS `is_comms_team_or_admin`) or (b) a **token-scoped guest**
  (magic link). A guest permission mask hides internal-only tiles (comms owner/contributor
  assignment, CRM internals) and shows the on-the-ground tiles the guest owns
  (registration, presentation upload *if presenter*, photos, takeaways/summary, comments).
- **Guest overview page.** `/congress/attend/[token]` becomes the guest's **conference
  overview** — the same card layout as the internal overview, scoped to the conferences on
  their list (the conferences their token is linked to / they've reported). Each card opens
  that conference's operating page. "Add another conference" stays.
- **One record.** Guest edits write to the *same* operating record the team reads. We
  reconcile the guest tables onto the shared model: `conference_prep` (+ a shared files
  table that both internal and guest uploads use) becomes the operating record;
  `conference_guest_submissions` is kept only as the **link/intake event** that attaches a
  guest+token to a conference and seeds their attending type. The read-only
  `ConferenceGuestReports` block is retired — its content is now just the operating page.
- **Token RPCs** (SECURITY DEFINER, `search_path=''`, same pattern as the existing guest
  RPCs) gate every guest read/write to the token's conference set, so token auth can edit
  the operating record without a platform account.

> This is the largest piece of the sprint and is phased: (T07) unify uploads, then (T08)
> render the operating page under token auth with a mask, then (T09) the guest overview,
> then (T10) fold the guest submission/notes data into the operating record.

## 7. Invite performance & the invite log

- **Decouple send from token creation.** `generateGuestToken` returns the URL as soon as
  the `conference_guest_tokens` row is inserted. The WhatsApp/email sends move off the
  critical path (Next.js `after()` / background task), and their result is written back to
  the invite log rather than awaited by the UI. The coordinator sees the link instantly.
- **Persist an invite log.** Record, per invite: recipient (name + email/phone), channels,
  per-channel delivery status (`queued → sent/failed`), `sent_at`, and `invited_by`. A
  small `conference_guest_invites` record (or a reuse/extension of
  `conference_contact_assignments.notification_status`, which today only exists for the
  assignment path).
- **Surface it.** The operating page and overview show *"Invited: Jane Doe · email +
  WhatsApp · sent 2m ago ✓"*, with a retry affordance on failure. This answers "mark
  somewhere that the invitation was sent and to whom."

## 8. Additional suggestions (for review — not all in Sprint 18 core)

These came out of reading the space; the user asked for them explicitly. Prioritised:

1. **Bulk "invite all assigned attendees"** — one action fans out invites to every
   assigned contact, deduped, using the same background-send path.
2. **Overdue reminder nudge** — when a `due` (red) requirement stays red *N* days past its
   due phase, offer a one-click reminder to the responsible guest (reuses the invite send).
3. **Date-driven auto-advance banner** — the phase header's status line (already above)
   nudges the team at each transition without manual stage clicks.
4. **Direct upload everywhere** — internal users currently *paste links* for deck/photos
   (`deck_url`, `photo_urls` textareas) while guests get real uploads to the
   `congress-guest-uploads` bucket. Unify on real upload for both.
5. **Consistent empty-states** — each tile gets a purposeful empty state ("No photos yet —
   they'll be requested during the conference") instead of a bare textarea.
6. **Overview/operating status parity** — the overview cards adopt the same traffic-light
   dot so a coordinator scanning the list sees which conferences have *due* gaps.
7. **Query hygiene / performance** — the overview's
   `loadAssignedContactsFromInteractions` fallback scans
   `comms_crm_interactions` with `ilike '%[conference:%]%'` (full scan); the operating
   `page.tsx` fires ~9 parallel queries + an RPC per load. Trim to the
   `conference_contact_assignments` table (already migrated) and cache where safe.
8. **Accessibility pass** — status not by colour alone (done in §5), focus order, and the
   mobile single-column layout double as an a11y win.

## 9. Data model summary

| Concern | Today | After |
|---|---|---|
| Operating work product | `conference_prep` (internal only) | `conference_prep` extended with `attending_type`; shared files table for uploads |
| Attending type | `has_presentation` bool (internal) **and** `role` (guest) | single `attending_type` (+ back-compat mapping) |
| Guest input | `conference_guest_submissions/files/notes` (parallel model) | submission kept as link/intake event; content folded into the operating record |
| Requests | static `STAGE_CHECKLISTS` | declarative `Requirement[]` + `deriveRequirementStatus` |
| Invite record (single) | none durable; `sends[]` returned to UI only | `conference_guest_invites` (recipient, channels, status, sent_at, invited_by) |
| Navigation inside a conference | `StageRail` (duplicate tabs) | read-only phase header; collapsible tiles |

## 10. Out of scope

- Rebuilding the overview/discovery pipeline or AI discovery.
- Changing the pipeline **stage** concept itself (stages stay; only the operating page's
  *tab UI* is removed).
- New notification channels beyond the existing WhatsApp/email senders.
- Full offline support for the venue.

## References

- Current operating page: `src/modules/events/ui/conferences/conference-operating-shell.tsx`
- Requests/checklists: `src/modules/events/domain/comms-conference-prep.ts`
- Overview + stages: `src/modules/events/domain/comms-conferences.ts`
- Guest form/workspace: `src/app/congress/attend/[token]/**`
- Invite flow: `src/app/app/comms/conferences/guest-token-actions.ts`,
  `src/modules/events/domain/congress-guest-tokens.ts`
- Data model: migrations `00088`, `00100`, `00108`, `00110`, `00112`
- Conventions: `sprints/README.md`, `docs/IMPLEMENTATION_GUIDE.md`, ADR-0009
</content>
</invoke>
