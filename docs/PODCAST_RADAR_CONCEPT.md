# Podcast Radar (Phase B) — Concept

> **Status:** **Built** in [Sprint 22](../sprints/sprint-22-podcast-radar/description.md) (B1 and B2;
> B3 — routes from co-authorship — deferred). Decision: [ADR-0016](ADR/0016-radar-structured-sources.md).
> This document remains the design rationale; where it and the code disagree, the code wins.
> Two things landed differently: **two source clients** (OpenAlex *and* Europe PMC) rather than one,
> which forced cross-catalogue DOI de-duplication so a single paper cannot satisfy the two-source
> floor twice; and **three tables** rather than two, the third being the run-status singleton.
> No model call has yet been made against a live provider — see the sprint outcome.
> **Scope:** Phase B of the [Podcast Opportunity Engine](PODCAST_OPPORTUNITY_ENGINE_CONCEPT.md) —
> assisted discovery of questions and of the people who could answer them.
> **Primary user:** Amit, podcast producer, in a fortnightly session of about thirty minutes.
> **Owning modules:** `src/modules/podcast-planning` (proposals, review, promotion) and
> `src/modules/network` (people and connections — written only through its public API).
> **Builds on:** engine concept §5 (where questions and names come from), §8 (the connection map),
> §13 (where AI helps and where it must not decide), §16 (data protection).
> **Decision record:** [ADR-0013](ADR/0013-opportunity-engine-components.md) fixed the module split.
> An additional ADR is owed at implementation time — see [§13](#13-what-still-needs-deciding).

---

## Table of contents

1. [What Radar is, in one sentence](#1-what-radar-is-in-one-sentence)
2. [Why this is more urgent than it looks](#2-why-this-is-more-urgent-than-it-looks)
3. [The one object: a proposal](#3-the-one-object-a-proposal)
4. [The screens](#4-the-screens)
5. [What accepting actually writes](#5-what-accepting-actually-writes)
6. [Where the facts come from](#6-where-the-facts-come-from)
7. [Turning four hundred links into ten cards](#7-turning-four-hundred-links-into-ten-cards)
8. [Names: the part that must not be wrong](#8-names-the-part-that-must-not-be-wrong)
9. [Routes from co-authorship](#9-routes-from-co-authorship)
10. [Data model](#10-data-model)
11. [Running it](#11-running-it)
12. [Where AI decides nothing](#12-where-ai-decides-nothing)
13. [What still needs deciding](#13-what-still-needs-deciding)
14. [Delivery](#14-delivery)

---

## 1. What Radar is, in one sentence

**Radar proposes a question or a name, shows the evidence behind it, and asks for one gesture in
reply.**

That sentence contains the entire user-experience requirement, and the rest of this document is
mostly about defending it. Three things follow from it.

| Principle | What it rules out |
|---|---|
| **A proposal, not a feed.** The unit on screen is a decision Amit can take, not a link he has to interpret. | A list of articles. A relevance-sorted river. Anything with the word "inbox" in it. |
| **Ten cards, not four hundred.** Grouping happens before Amit sees anything; the count is a design target, not an outcome. | An unread badge that grows. A screen that punishes you for being away. |
| **One gesture per card.** Accept, dismiss, or later — each a single tap, with the default path pre-filled. | A form. A modal with required fields. Reading before deciding. |

> **The anti-goal, stated plainly.** The failure mode for this feature is not that it finds nothing.
> It is that it finds too much, becomes a second inbox, and generates the guilt that the fortnightly
> rhythm in engine concept §14 exists to avoid. *"If it needs daily attention it has failed"* applies
> to Radar more than to anything else in the planner. A Radar that surfaces five good cards a
> fortnight and stays silent otherwise is a success; one that surfaces sixty is a failure even if
> every one of them is correct.

The measure to hold it to: **a fortnightly Radar review takes under ten minutes and ends at zero.**
If clearing Radar cannot be finished in one sitting, the threshold is wrong, not the user.

---

## 2. Why this is more urgent than it looks

Phase A shipped a complete board — from Wishlist through to the content-calendar handover — and one
thing was deferred without anyone quite saying so: **there is no way to add a candidate.**

`addCandidate` is implemented, exported and enforced; it has no caller. `createPerson` is the same.
The People screen is read-only. The only path that creates people is the one-shot past-guest import.
The board is a machine with no hopper.

So Radar is not an enhancement layered onto a working flow. **It is the front door**, and that
reframes its priority: the fastest useful version of Radar is not the ambient topic scanner from
engine concept §5, it is *"I have a live question with three names on it — find me more"*. That mode
needs no schedule, no new tab and no relevance threshold, and it turns a board nobody can fill into
one that fills itself.

---

## 3. The one object: a proposal

Everything Radar produces is one shape, in two modes.

```
Proposal
├─ the question        either a live question it attaches to, or one it is proposing
├─ why now             one sentence + the dated evidence behind it
├─ sources             2–6 records, each a real row with a real URL
└─ names               0–6 people, each with what they could say and where they came from
```

| Mode | Trigger | `question_id` | What accepting creates |
|---|---|---|---|
| **Find names** | A human presses the button on a live question | set | People + wishlist cards |
| **New topic** | The fortnightly scheduled run | null | A draft question + people + wishlist cards |

One object, two modes, one review interaction. That is deliberate: the reviewer learns a single card
and a single set of buttons, and the difference between "you asked for this" and "we noticed this"
is a heading, not a different screen.

### The card

Reusing the planner's existing visual vocabulary rather than inventing one — the same score dot,
check-chips, initials avatars and single-primary-button grammar the board and drawer already use.

```
┌──────────────────────────────────────────────────────────────┐
│  Why has the EU HTA regulation not changed national …        │  ← the proposed question
│  ● ● ●  three independent sources · newest 4 days ago        │  ← chips, not sentences
│                                                              │
│  ▸ The evidence                                     (folded) │  ← 3 rows, title + source + date
│                                                              │
│  ☑ AB  Prof. A. Bergmann   EMA · what they'd say …           │  ← pre-ticked, untick to exclude
│  ☑ LM  Dr L. Moreau        Zorginstituut · …                 │
│  ☐ JK  J. Kowalski         (one source only)                 │  ← unticked: weaker evidence
│                                                              │
│  [ Open as a question ]        Not this ▾      Later         │
└──────────────────────────────────────────────────────────────┘
```

Three properties of that layout carry the whole "without thinking" requirement:

- **The evidence is folded by default.** The chips already say what the fold would: three sources,
  four days old. A reviewer who trusts the chips never opens it; one who does not, can. This is the
  `<details>` fold the candidate drawer already uses.
- **The names are pre-ticked on the strong ones.** The default path is one tap. Excluding a name is
  one more. Nobody is asked to fill anything in.
- **"Not this" is a dropdown, not a dialogue.** Three fixed reasons — *not our agenda · already
  covered · not really a question* — each a single tap. No free text, ever. Those three taps are the
  only training signal the system gets, which is why they must cost nothing.

---

## 4. The screens

### 4.1 Find names — in the flow, not in a tab

The button lives where the need appears: on a question in the Questions screen and on the question
header in its board group, shown when the wishlist is thin.

The call takes thirty to sixty seconds, so it must not block. The pattern already exists in this
codebase (`after()` plus status polling plus a written progress line, as `/api/comms/conferences`
does): the button becomes **"Looking…"** with a sentence underneath that says what is happening, and
the proposal appears in place when it lands. The run lock prevents a second press doing anything
except joining the first.

> **A zero-result run must explain itself.** *"Looked at 41 papers and 2 congress programmes
> published since 6 August. Nothing crossed the bar — the closest was a Lancet Oncology editorial
> with one named author already on your wishlist."* A silent empty result is indistinguishable from a
> broken feature, and the conference job already sets this precedent.

### 4.2 The Radar tab

A fifth screen alongside Board · Questions · People · Introductions, carrying a count badge. It
exists only in mode two, and it holds the fortnightly run's topic proposals.

The shell currently omits Radar on purpose — *"an empty tab teaches nothing"*. The resolution is an
empty state that is genuinely informative rather than blank: **"Radar last looked on Tuesday and
found nothing new. Next look: Friday."** That is a tab worth having at zero, because it tells you the
machine is alive.

### 4.3 The digest line — the screen you do not have to visit

The weekly digest cron already exists. Radar's best surface is not its own tab but one line in that
digest: *"Radar has 4 new topics"*, linking straight to the tab. The fortnightly reviewer should
never have to remember Radar exists.

---

## 5. What accepting actually writes

The sequence matters, and so does what is deliberately absent.

| # | Write | Through | Note |
|---|---|---|---|
| 1 | People | `network.upsertPeopleByName` | Idempotent name+organisation match; `origin: 'external'`; `sourceAttribution` populated per field |
| 2 | The question, if proposing one | `createQuestion` | **Always `status: 'draft'`** |
| 3 | Wishlist cards | `addCandidate` | One per ticked name, with the angle as its `angle` |
| 4 | The proposal | status → `opened`, linked to the question it created | Auditable, and the input to "is Radar any good" |

What accepting does **not** write, each for a specific reason:

- **`ask_type` / `ask_destination_url` — never.** The listener action is the editorial decision the
  whole readiness gate is built on. Radar may pre-fill a *suggestion* the human confirms; it may
  never set `ask_verified_at`, which is deliberately a human act because an HTTP 200 is not the same
  as a page that does the job.
- **No stage past Wishlist, ever.** Wishlist and Research are uncapped; Ask is capped at six for a
  reason. Radar filling the wishlist is harmless by design. Radar touching Ask would break the one
  limit the product has.
- **No score.** Cards arrive unscored and sort last, exactly as a hand-added name would. Scoring
  begins when a human fills the Research form. The score is arithmetic over stored fields and must
  stay that way.
- **No contact details.** Engine concept §16: none at all for names still on a wishlist.

> Because a question arrives as a **draft**, the existing readiness gate does the rest of the work
> for free: no Radar name can be researched until a human has written the question properly, given
> it a why-now, chosen a listener action, verified where it points, and picked a format. **Radar
> cannot smuggle a half-formed question into the pipeline**, and no new gate had to be invented to
> ensure that.

---

## 6. Where the facts come from

Engine concept §5 lists the source families and sets the hard constraint: open APIs, official feeds
and things people typed. No scraping, no bridge tools, no LinkedIn. That constraint is unchanged and
non-negotiable.

The design question §5 leaves open is *how* those sources are read, and there are two answers with
very different properties.

| | Provider web search | Structured open APIs |
|---|---|---|
| Integration cost | Zero — already wired and proven twice | One client per source |
| Facts | Asserted by a model, cited afterwards | Returned by the source, with a stable ID |
| Names | Extracted from prose | Author records with affiliations |
| Date filtering | Unreliable | Exact |
| Cost | Per search, per lane | Free |
| Reproducible | No | Yes |

**Decided (2026-08-20): both, with a rule that decides which does what.**

> **The model never sources a fact a database can supply.** OpenAlex and Europe PMC return the
> papers, the authors and their affiliations as structured records; congress programmes and
> regulator feeds return the sessions and the rulings. Those are the spine. The model's only jobs
> are **grouping** (these eleven records are about one underlying question) and **phrasing** (here is
> that question as one arguable sentence). Both are judgement tasks a database cannot do, and
> neither can invent a person.

This is not purism. It is what makes the rest of the system honest: *"three independent sources"* is
worth six points of timeliness, and it should be a count of rows that exist, not a number a model
felt was about right. Web search stays in the design for corroborating a *why now* — a ruling, a
public row, a news moment — where there is no API and a cited URL is the appropriate evidence.

---

## 7. Turning four hundred links into ten cards

Three filters, as in engine concept §5, with the arithmetic separated from the judgement.

| Filter | How | Who decides |
|---|---|---|
| **Relevance** | Topic tags of live questions and the advocacy agenda, matched against source metadata | Arithmetic — no model call |
| **Grouping** | Records that share authors, terms and a time window are bundled into one candidate topic | Model, with the records as input |
| **Phrasing** | The bundle becomes one arguable sentence, plus a dated why-now | Model, human rewrites freely |

Two thresholds keep the count at ten rather than four hundred:

- **A bundle needs at least two independent sources to become a card.** One paper is not a topic.
  Three in a fortnight is itself the reason to record now — and, not coincidentally, is exactly where
  the timeliness score saturates.
- **A hard cap per run.** If more bundles clear the bar than the cap allows, the surplus is dropped,
  not queued. A backlog is the inbox this design exists to avoid.

### How dismissals teach

Engine concept §5 says dismissals tune the threshold. The honest, cheap implementation: the last
several dismissed topics, with their one-tap reason, go into the **cached system prefix** as
rejected examples — the same technique conference discovery uses to avoid re-proposing what it
already has, billed once per run rather than once per lane. No model training, no learned threshold,
no unexplainable behaviour drift. It works, and a human can read the reason a topic was skipped.

---

## 8. Names: the part that must not be wrong

A fabricated person is this feature's worst failure. It is a data-protection incident, an
embarrassment if anyone emails them, and a permanent stain on trust in every other number the
planner shows. So the discipline is stricter here than anywhere else.

> **Every name must arrive attached to a source record that resolves — an OpenAlex author ID, a DOI,
> a congress programme URL. A name without one is dropped, silently, before Amit sees it.** This is
> the same rule three existing features already enforce: an item with no verifiable source is
> discarded rather than shown with a caveat.

What a Radar-created person record carries: name, role title, organisation, country, topic tags,
what they can say — each with its source URL in `sourceAttribution`, and `origin: 'external'`. A
field with no source is unverified and, by the existing rule, excluded from scoring. What it never
carries: any contact detail.

**Matching before creating.** `upsertPeopleByName` already resolves a name against the directory
case-insensitively on name plus organisation, with a name-only fallback. Radar's most common
correct outcome is *"this person is already in your People list"*, which should be shown as such —
an existing person attached to a new question is a stronger signal than a new name, not a weaker
one.

### 8.1 The other failure mode: an empty shortlist that is not the truth (2026-08-21)

Everything above guards against a name that should not be there. The first real use hit the mirror
image — no name at all, on a question with a large literature — and it is worth recording because
nothing was broken, in the sense that every layer did what it had been told.

Asked *"how to make CAR-T cell therapy available in Brazil"*, the search ran the query **`cancer
make`**: terms were taken in sentence order, so the verb was kept and `brazil` cut, and because the
widening ladder drops terms from the end, the word with the least meaning was the one that survived
to the last rung. Thirty authors of unrelated recent oncology papers were handed to the model, which
had been instructed that "an empty answer is a useful answer", judged correctly that none of them
could speak to CAR-T access in Brazil, and returned nothing. The screen said no suitable guest
existed. A fabricated name is a visible failure that somebody will report; **a false empty is
invisible, and reads as a considered verdict**. Three principles came out of it:

- **Rank terms by specificity, not by position.** Words that name no subject (`make`, `available`)
  are removed outright, and the rest ordered by technical markers and length. Since the ladder drops
  from the end, ordering by specificity means the subject noun is the last thing surrendered.
- **An empty result is a fact about the window, not about the question.** The narrow query is
  retried over three years before any term is given up, because broadening is the expensive move: it
  is what turns "CAR-T in Brazil" into "CAR-T". Results accumulate across rungs rather than
  overwriting, and people are then ranked by **how narrow the query that found them was** — without
  which the five authors of the one on-topic paper sit below five hundred generic CAR-T papers.
- **The model ranks; the coordinator decides.** Judging whether somebody is worth inviting is a
  human call made on a card with the evidence attached. The "empty answer is useful" rule belongs
  only to the *topics* mode, where an ungroupable set of records genuinely is nothing. Filtering
  before ranking was the same mistake in another place: keeping only first, last and corresponding
  authors is the right convention for who **led** a piece of work and the wrong one for who could
  **talk** about it.

The floor that follows from this — topping a short list up from ranked retrieved people the model
did not reach — is not a softening of §8. Those people were retrieved from a catalogue before any
model ran, carry the same citation as any other, and say in their own angle that nobody has yet
judged the fit. The rule that a name must resolve to a source record is untouched.

---

## 9. Routes from co-authorship

The route is worth **12 of the 25 chance-of-yes points** — the single heaviest input in the model,
and today entirely hand-set. Engine concept §8 identifies the one source of real second-degree
network data that can be used without touching any platform's connection graph: the published
co-author graph, exposed by OpenAlex and Europe PMC.

Radar can therefore pre-fill a route. Under one condition, which is already how the network
component works:

> An inferred connection is written with `status: 'suggested'` and never `confirmed`. Only a human
> answering the map question promotes it. **The platform never claims two people know each other.**
> A co-authorship is the strongest suggestion available — it is verifiable and it gives the
> introducer an opening line that cannot be argued with — but it is still a suggestion.

`routeCategory` already exists to map a graph route onto the candidate's route enum, and like
`addCandidate` it has no caller yet. This is the second piece of Phase A machinery that Phase B was
supposed to feed.

---

## 10. Data model

Two of the three reserved Phase B table names, plus one column. `podcast_episode_results` belongs to
the Results screen, which is a separate feature and not part of this concept.

**`podcast_signals`** — one row per external record found. Source kind, external ID, URL, title,
published date, raw payload, and the fingerprint used to group it. This table is what makes
"independent sources" a count. A deterministic dedupe key computed identically in app code and in
the database, as conference discovery does, so every insert path converges on one row and re-runs
are idempotent.

**`podcast_topic_groups`** — one row per proposal. The proposed question, the why-now and its date,
the extracted names as a JSON array, `question_id` (null in topic mode, set in find-names mode), the
model and effort that produced it, the raw response, and a status lifecycle of
`pending · opened · dismissed · later · superseded` with the dismissal reason and who decided. A
partial unique index on `where status = 'pending'` enforces "at most one live proposal" as a database
rule rather than a code convention — the pattern `intake_ai_suggestions` established.

**`podcast_question_candidates.origin`** — a new column, `'human' | 'radar'`, plus the proposal ID.
There is nowhere today to record that Radar put a name on a question, and without it the honest
question — *does Radar produce candidates that get booked?* — cannot be answered later.

Both new tables are declared in the module manifest, gated by the same
`is_comms_team_or_admin()` policy as the rest of podcast planning, and land in a migration numbered
**above 00174**, the current high-water mark.

---

## 11. Running it

**Cadence is the cost guardrail.** The working rhythm is fortnightly; a fortnightly scan is also the
cheapest option and the one least likely to produce a backlog. Product rhythm and spend control turn
out to be the same decision. Implementation is the established one: a daily cron that self-throttles
against a configured interval, so the cadence is an operator setting rather than a deploy.

**The service-role caveat.** Every podcast table is gated by `is_comms_team_or_admin()` evaluated
against `auth.uid()`. A session-less cron writing through the ordinary client would have its writes
silently filtered by RLS. Background ingestion must use the service role — and must still write
people through `network`'s public API rather than touching `network_people`, because module
boundaries are CI-enforced.

**The AI workload.** `AiWorkloadId` is a closed union in the kernel model catalog, so Radar needs an
entry there with a recommended model, effort and a written justification. `conference_discovery` is
the closest existing analogue and a reasonable starting point: a fast model at low effort, because
the task is factual grouping and citation discipline rather than reasoning. Note that when server
tools are present the client deliberately skips provider structured-output mode and injects the
schema as a text contract, so Radar needs its own validator regardless.

**The first budget ceiling in the codebase.** Today `ai_usage_log` records every call and its
estimated cost, and *nothing reads it to make a decision*. There is no cap, no per-feature ceiling
and no kill switch short of disabling AI entirely. A scheduled fan-out is the first feature that
genuinely warrants one, and the smallest honest version is two numbers: a hard cap on searches per
run, and a check of the trailing thirty days' spend before a scheduled run starts — refusing, and
saying so in the run status, rather than proceeding quietly.

---

## 12. Where AI decides nothing

Engine concept §13 sets the boundary; Radar's two Phase B rows are *grouping* and *pulling out
names*, both human-gated. Restated as the specific things this feature must never do:

| Never | Because |
|---|---|
| Set or influence a score | The score is plain arithmetic over stored fields, versioned and snapshotted. A model term would make it unreproducible. |
| Create a person nobody reviewed | Engine concept §13 and §16. Accepting a proposal *is* the review. |
| Assert that two people know each other | Inferred connections stay `suggested` until a human answers. |
| Move a card past Wishlist | The six-open-ask ceiling is the product's one hard limit. |
| Open a question as `live` | Drafts must pass the human readiness gate. |
| Contact anybody | Nothing in this platform sends anything. The human sends everything. |
| Treat ingested text as instruction | All external content is delimited with `wrapExternalData()` and described, never obeyed. |

> Worth noting honestly, because it bears on this design: the claim in `AGENTS.md` §6 that AI output
> is a draft until a human confirms it **is not currently true of every feature** — the organisation
> news feed and conference discovery both publish unreviewed. Radar handles people rather than
> links, so it should hold the stricter line, and the drift in the older features is worth fixing
> separately.

---

## 13. What still needs deciding

### Settled

| Decision | Outcome | When |
|---|---|---|
| Which mode ships first | **Find names for a live question.** The board has no front door (§2), and this mode needs no schedule, no tab and no relevance threshold. The fortnightly scan follows in B2. | 2026-08-20 |
| Web search only, or structured APIs too | **Both, under the §6 rule.** Structured APIs supply papers, authors and affiliations; web search only corroborates a why-now. Names are where a hallucination is unacceptable. | 2026-08-20 |

### Still open

| Decision | Recommendation |
|---|---|
| Should Radar propose questions at all, or only find names for questions a human wrote? | Yes to proposing — but as a **draft the human rewrites**, never as a finished question. The risk is anchoring: a mediocre machine-phrased question accepted because it was there. Not urgent: it is a B2 question. |
| Are the names pre-ticked, or does each need a deliberate tick? | Pre-ticked makes the common path one tap — but the tap creates a **person record about someone who never signed up**, which is the one act in this feature that deserves friction. See the note below. |
| Scan cadence | Fortnightly, matching the working rhythm. Operator-configurable. |
| Does the Radar tab appear before it has content? | Yes, with an informative empty state (§4.2). B2. |
| Who owns a "not our agenda" dismissal? | Anyone with comms access. There is no read-only tier on this board today, and inventing one for Radar alone would be inconsistent. |
| An ADR? | Yes, at implementation: the load-bearing architectural choice is §6's rule — structured sources are the spine, the model groups and phrases — together with the first AI budget ceiling. |

> **The pre-ticking tension, stated honestly.** §3 argues for pre-ticked names because one tap is the
> whole point. §16 of the engine concept promises that *every new person record is reviewed before it
> enters the list*. A pre-ticked box that a tired reviewer accepts wholesale satisfies the letter of
> that and not its spirit. The middle position, if the friction is wanted: names are pre-ticked only
> when they carry **two or more independent sources**, and single-source names arrive unticked with
> the reason shown. That keeps the common path fast while making the weakest records the ones a human
> must actively choose.

**One risk that is not a decision.** Radar will multiply the number of people records held about
individuals who never signed up to anything. Engine concept §16 promises an eighteen-month purge of
inactive people records and twelve-month anonymisation of closed cards. **Neither is implemented,
and there is no retention job of any kind in the codebase.** At Phase A volumes that is a small debt.
At Phase B volumes it is the compliance position the Board was asked to approve, unbuilt. Retention
should ship *with* Radar, not after it.

---

## 14. Delivery

Three steps, each independently useful and each shippable without the next.

**B1 — Find names for a live question.** The proposal object, the two tables, the origin column, the
workload entry, one structured source (OpenAlex, which gives authors and affiliations in one call),
the review card, and promotion into people plus wishlist cards. No schedule, no tab, no relevance
threshold.
*Proves itself when: the first candidate booked through the platform started as a Radar suggestion.*

**B2 — The fortnightly scan.** Topic mode: the remaining sources, grouping and phrasing, the Radar
tab with its count badge and empty state, the cron with its interval self-throttle and run lock,
dismissal reasons feeding the cached prefix, the digest line, and the budget ceiling.
*Proves itself when: three consecutive fortnightly reviews are cleared to zero in under ten minutes.*

**B3 — Routes from co-authorship.** OpenAlex co-author import, affiliation matching, suggested
connections and a pre-filled route on new cards.
*Proves itself when: acceptance through suggested routes beats cold approaches — the central bet of
the whole design, and the one measure engine concept §15 says should cause the network machinery to
be cut if it fails.*

Retention (§13) attaches to B1, because it is B1 that starts creating people at volume.

---

*Concept v0.1. Proposed, not built. Numbers and thresholds here are starting values to be calibrated
against real outcomes, which is why they belong in manifest config rather than in constants.*

*Last reviewed: 2026-08-21.*
