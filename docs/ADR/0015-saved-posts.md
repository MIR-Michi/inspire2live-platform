# ADR-0015: A saved post is its own entity, and it owns the handover

- **Status:** accepted
- **Date:** 2026-08-19
- **Owners:** @michaelwittinger-prog
- **Amends:** [ADR-0014](0014-publishing-space.md) §6 (handover moves from the draft to the post)
- **Migration:** `00174`

## Context

Sprint 21 shipped the Publishing space as a three-step wizard — source · draft · approve — whose only
persisted copy is `publishing_drafts`, one row per generated variant. That table is deliberately a
*calibration record*: `ai_body` is never overwritten, an approved draft can no longer be edited, and
regeneration supersedes the previous run. Those properties are what make the distance between the
model's output and the approved text an honest signal (ADR-0014).

They also mean the space has no object for the thing a person actually has in their head — **a post**.
Four gaps followed from that, all reported from real use:

1. **You cannot stop halfway.** A variant exists only inside a live pending run. Walk away and there
   is nothing to come back to; the wizard is the only view, and it is keyed by *source*, not by post.
2. **Nothing is visible.** With no post entity there is no board, so work in progress is invisible —
   which is how the same post gets written twice.
3. **You cannot change it afterwards.** `canEditDraft` is `status === 'pending'`, and the picture
   belongs to the *source*, so it can never be added, swapped or removed once drafting has happened.
4. **Nobody owns it.** `created_by` is stored on both tables and displayed nowhere, and there is no
   way to hand a post to a colleague.

There is a fifth problem hiding behind the fourth: the draft's `status` vocabulary
(`pending · approved · dismissed · superseded · published`) is the mechanics of a generation run, not
a lifecycle a communications coordinator recognises. Worse, `published` on a draft means *handed over
to the calendar* — the platform cannot post to LinkedIn, so nothing it calls "published" ever was.

## Decision

**Introduce `publishing_posts` (migration `00174`): the human-owned artifact of the space.** A post is
materialised from a draft variant and from that moment carries its own `body`, `hashtags`,
`image_ref`, `owner_id` and `status`. `publishing_drafts` is untouched and keeps every property
ADR-0014 relied on.

Five things follow.

### 1. The post is editable at every status; the draft never is

This is the whole point of the split. The frozen artifact — `ai_body` beside the approved text — stays
on the draft row, so the calibration signal survives intact while the human edits freely. `canEditPost()`
returns `true` unconditionally, and that is a deliberate statement, not an oversight.

### 2. Three states, in the user's language

`draft → ready_to_publish → published`, and backwards again. `published` is a **human statement that
the copy went out**, set by a person after they posted it; the platform never sets it, because the
platform never posts. Moving backwards is always allowed — a post marked published by mistake that
nobody can correct is worse than a loose transition.

### 3. Handover moves from the draft to the post — amending ADR-0014 §6

ADR-0014 put `handOverApprovedDraft` on the draft. That is now wrong, and not cosmetically: once the
post is editable after approval, handing the *draft* over would put pre-edit text on the calendar. So
`handOverPost` replaces it, and reads the post's current body. Everything else ADR-0014 §6 decided is
unchanged — it still goes through `content`'s own `createCalendarEntry` (ADR-0009 §9 rule 3), still
logs a delivery intent, still runs the provider's `onPublished` hook. The calendar entry's author is
the post's **owner**, not whoever happened to click.

### 4. The rights gate widens from handover to every forward move

`handoverBlockReason` guarded exactly one action. Its replacement, `rightsBlockReason`, is consulted by
`postTransitionBlockReason` *and* by handover, so uncleared material cannot be marked ready to publish,
cannot be marked published, and cannot reach the calendar. There is still exactly one chokepoint and
still no setting that disables it (ADR-0014 §8). Moving a post *backwards* is never gated.

### 5. Ownership is responsibility, not access

`owner_id` is reassignable and displayed; `created_by` records who made it and never changes. RLS stays
role-scoped (`is_comms_team_or_admin`) — everyone on the comms team can open every post. An owner-scoped
policy was considered and rejected: this is a small team whose problem is *coordination*, and a post
only its author can see reproduces gap 2 at a different scale.

## Consequences

- **Three places now hold post-like text**: the draft (frozen, for calibration), the post (live, human),
  and the calendar entry (scheduled). That is one more than before, and it is the cost of the split. It
  is bounded by direction: draft → post → calendar, never backwards, and only the post is editable.
- **`handOverApprovedDraft` and `handoverBlockReason` are removed** from the component's public API.
  `REQ-PUB-005` is now satisfied by `handOverPost`; its test coverage moved to
  `src/test/unit/publishing-posts.test.ts`, which additionally pins the behaviour the old design could
  not express — that an edited post hands over its edits.
- **The wizard's step 3 stops being a destination.** It shows the approved copy and points at the post;
  the picture, the owner and the status live on the post page.
- **A post always has a source.** Creating one from nothing was considered and deliberately not built:
  the readiness and groundedness gates hang off a source, and a blank post has no provenance to check.
  Should a truly free-form post be wanted later, it needs its own decision, not a nullable column.
- **The draft's `published` status is now unreachable.** It stays in the CHECK constraint for rows
  written before `00174`; nothing sets it any more.

## Alternatives considered

- **Extend `publishing_drafts` into the post.** Rejected: it would require making `ai_body`,
  `run_id`, `source_fingerprint` and `variant_index` optional, which dissolves precisely the invariants
  that make the table a calibration record, and it would put the partial unique index on live pending
  runs in conflict with rows that belong to no run.
- **Use `content_calendar` as the post.** Rejected for the reason ADR-0014 already gave — `content` is
  the *destination*, and welding the composer to the editorial calendar is the entanglement ADR-0009
  exists to prevent. Concretely it also does not fit: one `body_draft` on a row whose `channels` is an
  array has no home for per-channel copy, its media link is a free-text `attached_media_refs` array with
  no upload path, and half-written ideas would pollute the schedule.
- **Owner-scoped RLS.** Rejected; see §5 above.
