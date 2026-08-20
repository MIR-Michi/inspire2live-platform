# Podcast Opportunity Engine — Concept

> **Status:** Phase A in implementation (Sprint 20). Phases B and C are planned, not built.
> **Scope:** The Comms workspace → Podcast space. Replaces the **Guests** tab with a
> **Planning & Strategy** tab.
> **Primary user:** Amit, podcast producer. Secondary: Peter (founder signal), Inspire2Live
> members who act as introducers.
> **Owning modules:** `src/modules/network` (generic relationship graph, introductions) and
> `src/modules/podcast-planning` (questions, candidates, scoring, invitations).
> **Source:** *Planning & Strategy: Podcast Opportunity Engine*, concept v0.2 (July 2026).
> **Decision record:** [ADR-0013](ADR/0013-opportunity-engine-components.md).

> **Presentation amended (2026-08-20).** The screens in §4 were re-cut for visual navigation:
> explanatory sentences became icons, check-chips and single-word labels, the drawer leads with a
> stage stepper and **one primary next-move button** (derived from the same `canAdvance` gate), and
> the board gained a "Next up" strip surfacing what `boardAgenda` says needs a decision. Every gate,
> stage, screen and rule below is unchanged — only how it is *shown*. See
> `docs/changes/2026-08-20-podcast-planner-visual-ux.md`.
>
> **The in-app "How it works" tour narrates the reasoning in this document** — §1 (why the tab
> exists), §2 (question before names), §3 (the stages, the gates and the one limit), §5 (what Radar
> reads and the rule that keeps it grounded), §7, §8 and §10 (chance of a yes, routes and the score).
> The script lives in `src/modules/podcast-planning/ui/onboarding-tour-scenes.tsx` and walks a
> worked example through the real screens (`onboarding-tour-fixture.ts` ·
> `onboarding-tour-screens.tsx`) — including the real Radar review; when the thinking here changes,
> change it there too. See `docs/changes/2026-08-20-podcast-onboarding-tour.md` and
> `docs/changes/2026-08-21-radar-in-the-tour.md`.

---

## Table of contents

1. [Why this tab exists](#1-why-this-tab-exists)
2. [How the planner is organised](#2-how-the-planner-is-organised)
3. [The six stages](#3-the-six-stages)
4. [The screens](#4-the-screens)
5. [Where questions and names come from](#5-where-questions-and-names-come-from)
6. [The people list](#6-the-people-list)
7. [Chance of a yes](#7-chance-of-a-yes)
8. [Using the network to reach people](#8-using-the-network-to-reach-people)
9. [Episode formats](#9-episode-formats)
10. [The score](#10-the-score)
11. [Reach and follow-up](#11-reach-and-follow-up)
12. [Data model](#12-data-model)
13. [Where AI helps, and where it must not decide](#13-where-ai-helps-and-where-it-must-not-decide)
14. [The working rhythm](#14-the-working-rhythm)
15. [Measuring whether this works](#15-measuring-whether-this-works)
16. [Data protection and compliance](#16-data-protection-and-compliance)
17. [Delivery in three phases](#17-delivery-in-three-phases)
18. [Open decisions](#18-open-decisions)

---

## 1. Why this tab exists

A Guests tab is a record of the past: who appeared, on which episode, with a link — information
that already lives on the episode record. Its own tab spends prime navigation space on a lookup
table.

The scarce resource in this podcast is not editing or publishing. It is the **booking work**:
choosing a question worth asking, working out who can answer it, finding a way to reach those
people, and persuading them. Today that work happens in one person's head and in their inbox,
one guest at a time. Nobody else can see it, nothing is learned from the people who said no, and
the network of advocates in more than 45 countries that could open half these doors is unused.

| Question | Today | With this tab |
|---|---|---|
| What should the podcast ask next? | Whatever came up recently in conversation or in the WhatsApp channel. | A small set of live questions, each with a reason it matters now and a list of people who could answer it. |
| Who should we invite? | Someone Peter knows, or a name someone remembered. | A researched shortlist per question, ranked by how likely they are to say yes and how much reach they bring. |
| How do we reach them? | A cold email, or a message from Peter. | A named person inside Inspire2Live who can introduce them, with a ready-to-send request. |
| Where did that invitation get to? | Buried in an inbox. | On a card, with who we are waiting on and for how many days. |
| Will the episode land? | Found out afterwards, if at all. | Expected reach and a defined listener action agreed before recording, measured after. |
| What did we learn from a no? | Nothing. | Every refusal is recorded with a reason, so the routes that actually work become visible. |

**Where the old guest data goes.** Nothing is deleted. Past guests move into the People list
(§6), where they become the most valuable records in the system: a proven willingness to appear,
a known relationship, and one of the best possible introducers for the next guest.

---

## 2. How the planner is organised

Three levels, nested.

| Level | What it is | How many at once | How long it lives |
|---|---|---|---|
| **Question** | The thing the podcast is asking. One sentence someone could disagree with. | Three or four live | Months. It survives any number of people saying no. |
| **Candidate** (person on a question) | Someone who could answer that question on the show. This is the card that moves through the stages. | Ten to twenty per question | Weeks. Ends in a recording, a no, or a "not now". |
| **Invitation** | One attempt to reach one person by one route. Direct, through an introducer, or cold. | One or two per candidate | Days to a few weeks. |

Separating question from person matters because a good question outlives the people who decline
it. If the card were the question, a refusal would throw away all the framing work; because the
card is the person and the question is the folder they sit in, a refusal costs one card.

### Before any names: defining the question

A question is not opened until four things are written down.

| Field | What good looks like | Why it matters |
|---|---|---|
| **The question** | Not "molecular diagnostics" but "why is a proven diagnostic still unreimbursed three years after parliament heard the case". | Subject areas do not travel and do not persuade anyone to give up an hour. Arguable questions do both. |
| **Why now** | A publication, a ruling, an approval, a congress, a consultation deadline, a public row. | Timeliness is the biggest single reason people accept, and the biggest driver of listens. |
| **The ask** | What a listener should do afterwards: join an initiative, register for the congress, submit a story, subscribe. | Follow-up traffic does not happen by accident. |
| **The shape** | Which of the six episode formats (§9), and whether it needs one voice or two. | Two-voice formats need two people secured, which changes the whole booking plan. |

**Two rules that come from doing this alone.**

1. **Several people per question, always.** Most invitations fail. A wishlist of ten to twenty
   names per question means a no is an inconvenience rather than a restart.
2. **Land one strong name first.** Within each question one candidate is marked the **anchor**.
   Effort concentrates there, including the best available route. Once the anchor confirms,
   every other candidate on that wishlist gains points, because "X has already agreed" is the
   single most useful sentence in an invitation.

---

## 3. The six stages

Each candidate moves through six stages, plus two exits. Two stages are **waiting** states — the
work sits with somebody else — and are shown differently, because "waiting" and "to do" are
different problems.

| Stage | Who acts | What it means |
|---|---|---|
| **Wishlist** | Amit | A name and one line on why. No research yet. |
| **Research** | Amit | Is this the right person, and how would he reach them. |
| **Ask** | *waiting* | The request is out, with an introducer or with the guest. |
| **Planning** | *waiting* | They are in. Date, format and scope being settled. |
| **Booked** | Amit | Date fixed. Brief, prep and launch plan. |
| **Recorded** | Amit | Recording done. Hands over to the content calendar. |
| **Not now** | — | Interested but unavailable. Sleeps until a wake date, then returns to Research. |
| **Closed** | — | Declined, no reply, no route, wrong person, or the moment passed — always with a reason. |

**Research** is the quality gate. Four things are answered and stored on the card: *what exactly
can this person say that nobody else can* (if the answer is "they are senior and work in this
field", that is not an angle and the card goes back to the wishlist), *is now a good moment for
them*, *do they do this sort of thing* (any podcast appearance in the last year — the single best
predictor available), and *how would he reach them*.

**Ask** is where the platform counts days. One nudge after seven days. Silence past fourteen days
is treated as a no: the card returns to Research for a different route, or to the wishlist for a
different person.

**Planning** is where bookings quietly die, almost always because a date drifts. A card sitting
here for three weeks is flagged.

**Recorded** is a handover, not a working stage: the card closes and creates an item in the
existing content calendar, which then runs the normal comms workflow. The planner feeds the
calendar; it never duplicates it.

### Gates

| Move | What has to be true |
|---|---|
| Wishlist → Research | Amit picks it up. Nothing else. |
| Research → Ask | An angle written down, a route chosen, and a score. The real quality gate. |
| Ask → Planning | The guest has said yes in principle. |
| Planning → Booked | A date, consent to record and publish, and every seat filled. |
| Booked → Recorded | The recording exists. A content-calendar item is created and the card closes. |

### One limit, for one person

Research is unlimited; **chasing** is not. Every open request needs following up and every
introducer request spends somebody's goodwill. **Six cards in Ask, across all questions**, is the
working ceiling. Wishlist and Research have no limit. That asymmetry is the difference between a
pipeline that helps one person and a list that makes them feel behind.

---

## 4. The screens

Planning & Strategy opens onto six screens. **Board** is the default.

| Screen | What it shows | Phase |
|---|---|---|
| **Board** | One card per candidate, in the six stages, grouped by question. Ask and Planning cards show who is being waited on and for how many days. | A |
| **Questions** | The live questions with wishlist size, how many are in play, and how many episodes produced. | A |
| **People** | Everyone the podcast could plausibly invite: past guests, Inspire2Live people, CRM contacts, external candidates. | A |
| **Introductions** | Open and completed introduction requests, by person, with age and outcome. | A |
| **Radar** | Incoming material grouped into emerging topics, with the names attached. | B |
| **Results** | Expected against actual reach, and follow-up conversion, per episode and per question. | B |

**The candidate card.** Opening any card slides in a drawer with seven blocks, in this order:
who and why (the angle) · score with breakdown · chance of a yes · route · background ·
invitations · draft message.

---

## 5. Where questions and names come from

> **Radar is designed in detail in [`PODCAST_RADAR_CONCEPT.md`](PODCAST_RADAR_CONCEPT.md)** — the
> review interaction, how these sources are actually read, and what accepting a proposal writes.
> This section stays the statement of *which* sources and under what constraint.

The Radar screen (Phase B) watches two families of source. The internal ones are more valuable,
because nobody else has them.

**Inside Inspire2Live:** World Campus WhatsApp intake (`comms_intake_items` — read, never
copied), congress topic submissions, initiative activity, patient stories, hub coordinators,
newsletter/LinkedIn engagement, past episodes.

**Outside:** Europe PMC · PubMed · OpenAlex · medRxiv · bioRxiv (open APIs; OpenAlex also
supplies the co-authorship data used in §8) · EMA, European Commission health, EU Cancer Mission,
Zorginstituut, national HTA bodies · congress programmes (ESMO, ASCO, AACR, EHA, ECO, ECPC — the
densest source of qualified names anywhere, because a speaker list is a list of people who
already agreed to talk in public) · KWF, ZonMw, IKNL, NFK · EU CTR, ClinicalTrials.gov, Horizon
Europe · news APIs · public podcast RSS.

> **Hard constraint on data collection.** No scraping of LinkedIn, and no third-party bridge or
> automation tool against a platform whose terms prohibit it — the same reasoning that ruled out
> the WhatsApp bridge tools. A terms-of-service violation is not a technical risk, it is an
> organisational one. Every source is an open API, an official feed, or something a person typed
> in. The network intelligence in §8 is built **without touching any platform's connection data.**

Incoming items pass three filters before Amit sees them: **relevance** (matched against the
advocacy agenda; dismissals tune the threshold), **grouping** (items about one underlying question
are bundled, so Radar shows ~10 topics rather than 400 links; three independent sources in one
week is itself a reason to record now), and **name extraction** (authors, quoted experts, session
chairs, officials — each matched to the People list or created as a candidate).

---

## 6. The people list

Everyone the podcast could plausibly invite, from four groups normally kept in separate places:
**past guests** (proven willingness, live relationship), **Inspire2Live people** (`profiles` —
available at short notice as second voices, and the source of every introduction),
**CRM contacts** (`comms_crm_contacts` — an existing, usually dormant relationship), and
**external candidates** (the growth frontier).

A person record holds *what they can say* (role, organisation, topics, notable publications and
public positions, languages — a reason to be on a specific episode, not a biography), *what they
bring* (public audience indicators, recent media appearances, and whether they promote their own
appearances — a guest who will share the episode is worth more than one with twice the followers
who will not), *how to reach them* (route, available introducers, prior contact including any
refusal, and anything that slows a booking: pharma media approval, regulator press policy, civil
service rules), and *whether now is a good time* — all source-linked.

> **The single most useful field:** whether the person has appeared on any podcast in the last
> twelve months. It settles whether they do this sort of thing at all, which is where most of the
> uncertainty sits. It is filled from public episode feeds and weighted heavily.

---

## 7. Chance of a yes

A score out of **25** — the part of the system that matters most, because a perfect question with
an unreachable guest produces no episode at all. Set during Research and recalculated whenever
something changes.

**The route — 12 of the 25.**

| Route | Meaning | Points | How Amit approaches it |
|---|---|---|---|
| Already known | Past guest, ambassador, active partner, or a Peter contact. | 12 | Direct invitation from whoever holds the relationship. |
| One introduction | A named Inspire2Live person knows them and has confirmed it. | 10 | Introduction request to that person. |
| Two steps | An I2L person knows somebody who knows them, or a strong shared context exists. | 7 | A two-step introduction, or a direct approach naming the mutual contact. |
| Cold, with a hook | No connection, but something public to hang the request on. | 4 | Direct approach built entirely on the hook. |
| Through a press office | All access runs through institutional media approval. | 1 | Formal request, long lead time, plan around a fixed date. |

**The other thirteen points.**

| Factor | Points | How it is judged |
|---|---|---|
| Does this sort of thing | 0…4 | Confirmed podcast appearances: 4 within twelve months, 2 if older, 0 if none found. |
| Good moment for them | 0…3 | They have something to promote or defend right now. |
| Someone they respect is already in | 0…3 | The anchor or a known peer has confirmed on this question. Recalculated on every acceptance. |
| Institutional friction | −3…0 | Pharma employees, active regulators, civil servants carry approval overhead. |
| Practicalities | 0…3 | Language, time zone, remote, proportionate preparation. |
| Said no before | −4…0 | Weighted by recency and phrasing. A "not now" is close to neutral; a firm no stands. |

> **Why a patient organisation gets invitations a magazine does not.** The pitch that works is
> rarely "come on our podcast". It is "patients want to ask you this specific question, and you
> are the person who can answer it". Inspire2Live offers legitimacy with the constituency the
> guest's own work depends on. These scores assume that difference is being used.

---

## 8. Using the network to reach people

Inspire2Live has advocates in more than 45 countries who between them can reach almost every
oncologist, regulator, researcher and policymaker worth talking to. Right now that is unused,
because nobody can see it.

The idea is the familiar one — find the person you want, then see who you know who knows them —
but LinkedIn's connection data cannot be harvested and should not be. The platform rebuilds the
capability three other ways.

1. **People tell the platform where they have been.** Members opt in to a short profile. They do
   not upload contacts; they tick **contexts**: institutions and rough years, professional
   societies and working groups, congresses they attend, boards and advisory panels, universities,
   disease areas and countries. Compared against a target's publicly stated affiliations, an
   overlap does not prove they know each other — it produces a **testable guess**.
2. **Who has published with whom.** OpenAlex and Europe PMC expose the full co-author graph
   through open APIs — a real second-degree network, published deliberately by the people in it,
   and an opening line that cannot be argued with. *(Phase B.)*
3. **One question, five seconds.** Guesses become routes only when a person confirms them:
   *"We are planning an episode on reimbursement delays for molecular diagnostics. Do you know
   Prof. [Name] at [Institution]?"* — **Yes, well · Yes, a little · No, but I know someone who
   does · No · I would rather not ask.**

> **Two separate asks, in this order.** The map question is cheap: it can go to several people at
> once, commits nobody, and moves no card. **The favour comes second**, and only to the strongest
> confirmed contact: *"would you introduce us"*. That is what moves a card into Ask. Nothing ever
> reaches the guest before the introducer has agreed, because the introducer is the one who sends
> it. Keeping these apart is what lets the map get built without wearing anybody out.
> "I would rather not ask" is a first-class answer and is never shown as a failure.

**Connection strength.**

| Type of connection | Strength | Where it comes from |
|---|---|---|
| Knows them well, confirmed | 0.95 | Answered "Yes, well" |
| Published together | 0.85 | Verifiable; gives the introduction an unarguable opening |
| Knows them a little, confirmed | 0.65 | Answered "Yes, a little" |
| Same board, committee or working group | 0.60 | Small groups, repeated contact, mutual obligation |
| Same congress session | 0.45 | Published programmes |
| Same institution, overlapping years | 0.40 | Declared plus public |
| Same professional society | 0.25 | Weak alone, useful as corroboration |
| Same country or hub | 0.15 | Context only |

A two-step route multiplies its two connections and takes off **15 %**, because asking somebody to
ask somebody else really does cost more. The platform shows the **three strongest** routes and
hides anything below **0.20**, since offering a weak route wastes goodwill on a request that was
never going to work.

**What the introducer receives:** a three-sentence message they can send as it is, in their voice,
naming the actual connection (they edit or rewrite freely — nothing is ever sent for them); a short
forwardable episode brief; one link so the guest can check who is asking; and a clear statement of
what happens next, so they know they are making an introduction rather than taking on a project.

> **Not wearing people out.** Three rules are enforced in the product: nobody receives more than
> **one favour request per fortnight** by default; any request can be declined without explanation
> and without visible consequence; and the Introductions screen shows each person's request history
> so nobody is quietly over-drawn. Who opened which door is recorded as **recognition, not a
> leaderboard** — ranking people by favours asked would corrode exactly the culture that makes this
> work.

---

## 9. Episode formats

| Format | Shape | Best for | What it does for reach |
|---|---|---|---|
| **Advocate meets expert** | An advocate puts the constituency's question to an authority. One guest + advocate. | Researchers, clinicians, new evidence | Steady. The signature format and the easiest yes. |
| **The disagreement** | Two people who genuinely differ, advocate holds the frame. Two guests. | Contested topics: access, pricing, screening thresholds | Highest peaks, hardest to produce. |
| **How it actually works** | One guest walks through a mechanism and where it fails. | Reimbursement, HTA, regulatory pathways, trial design | Lower peak, long tail, best follow-up conversion. |
| **Hub story** | A regional coordinator and a local expert on a problem invisible from Europe. | Kenya, Nigeria, Ghana, Costa Rica, China | Nobody else is making these. |
| **Congress episode** | Recorded around a congress. | Keynote speakers, session chairs | A burst of episodes; the most efficient booking there is. |
| **Initiative update** | Progress and obstacles on a live initiative. | Initiative leads and their counterparts | Modest reach, high conversion, builds institutional memory. |

Format contributes only a few points to the score, but it works as a filter: a question that fits
no format is reframed or dropped. The Questions screen also watches variety — five consecutive
explainers is how a podcast loses its audience.

---

## 10. The score

One number out of 100 per candidate, from six parts. It ranks the wishlist so Amit knows who to
research next and who to chase first. **The breakdown is always shown, never just the number.**

| Part | Max | What goes into it |
|---|---|---|
| **Chance of a yes** | 25 | Route (12), does this sort of thing (4), good moment (3), peer already in (3), practicalities (3), minus institutional friction and any earlier refusal. |
| **Reach** | 20 | The guest's own audience and whether they share (8), the pull of the question judged against past content (7), who else will push it — hubs and partners (5). |
| **Timeliness** | 20 | How recent the reason is (8), how many independent sources (6), whether a fixed date anchors it (6). |
| **Follow-up** | 15 | Whether an ask is defined (5), whether the page it points at exists and works (5), how that kind of ask has converted before (5). |
| **Mission** | 15 | Connected to a live initiative (6), on the advocacy agenda (5), matters to patients rather than only to the field (4). |
| **Format** | 5 | Format assigned (2), realistically producible (2), adds variety (1). |

| Band | Meaning | What to do |
|---|---|---|
| 80–100 | Chase now | Research immediately, best available route. Anchor candidate. |
| 60–79 | Strong | Research it. Fix the weakest part before asking. |
| 40–59 | Fixable | Usually a route problem or a missing ask. Leave on the wishlist until something changes. |
| < 40 | Leave it | Timeliness decays on its own, so it will sink unless a new reason appears. |

> **Two rules that keep the score honest.**
> **Timeliness decays** over a set period, so wishlists clean themselves and stale names sink
> without anyone pruning.
> **The score never overrules a person.** Amit or Peter can push any card to the top regardless of
> its number, and the platform records that as a deliberate decision rather than hiding it. Those
> overrides are reviewed in Results, because an override that keeps being right is evidence the
> model is wrong, not the person.

Scoring is **plain arithmetic over stored fields**, versioned by a `weights_version` and snapshotted
per computation, so any number on screen can be inspected and reproduced.

---

## 11. Reach and follow-up

**Getting it heard** is decided before recording, not after. Four levers, all handled at Booked:
the guest sharing it (asked explicitly during Planning and recorded); the pull of the question
(estimated from comparable past content, not guessed); the launch plan (which hubs, partners and
contributors post, and when — generated as a task list at Booked, not improvised in publication
week); and the series effect (episodes on the same question promote each other).

**Getting them to act.** Every question defines one listener action *before any name is
researched*:

| Ask | Where it points | Works well with |
|---|---|---|
| Join an initiative | Initiative workspace signup | Initiative update, how it actually works |
| Register for the Annual Congress | Congress registration | Congress episode, the disagreement |
| Submit a patient story | Patient story intake | Advocate meets expert, hub story |
| Join a hub or World Campus | Hub signup | Hub story |
| Subscribe | Newsletter | Any, as the fallback |
| Respond to a policy moment | Consultation response, open letter | How it actually works, the disagreement |

The ask appears in the guest brief, is said out loud in the episode, sits in the show notes, and
uses a tracked link so conversions can be attributed per episode. Results compares expected against
actual, and that comparison is what corrects the scoring over time.

---

## 12. Data model

Two components own the tables (see [ADR-0013](ADR/0013-opportunity-engine-components.md) for why
the split is where it is). Conventions follow the repository: `snake_case`, UUID primary keys,
`created_at` / `updated_at`, RLS on everything, Frankfurt residency unchanged.

**`network` — the generic relationship graph (migration `00171`).**

| Table | What it holds |
|---|---|
| `network_people` | The people directory: professional information only, per-field source attribution, `objection_received`, optional `crm_contact_id` / `profile_id` links into the identity spine. |
| `network_person_affiliations` | Publicly stated affiliations of an external person. |
| `network_member_affiliations` | A member's **opt-in, item-by-item, revocable** declared contexts. |
| `network_connections` | One row per known or suspected connection, with type, strength, evidence, and who confirmed it. |
| `network_connection_checks` | The cheap map question. Commits nobody, moves no card. |
| `network_introduction_requests` | The favour. Only after a connection is confirmed. Carries a generic `context_type` / `context_id` so the component stays reusable. |
| `network_people_public` *(view)* | `security_invoker` read contract for other components. |

**`podcast-planning` — the questions and the board (migration `00172`).**

| Table | What it holds |
|---|---|
| `podcast_questions` | The question, why now (+ source URLs), the ask and its destination, format, topic tags, owner, status. |
| `podcast_question_candidates` | One card per person per question: angle, stage, anchor flag, route, chance of a yes, total score, wake date, closed reason, override, `content_calendar_id`. |
| `podcast_candidate_scores` | Versioned score snapshots (`weights_version` + per-part breakdown + explanation) so weight changes stay auditable. |
| `podcast_invitations` | Every attempt to reach one person for one question, with nudges, response and recall date. |

**Phase B adds** `podcast_signals`, `podcast_topic_groups` and `podcast_episode_results`; they are
deliberately not created before there is a reader for them.

> **Reuse rather than duplicate.** World Campus material is read from `comms_intake_items`, not
> copied. Members are referenced from `profiles`. CRM contacts are referenced from
> `comms_crm_contacts`. A recorded episode writes into the content calendar rather than creating a
> parallel episode table. This is the platform's *connect rather than migrate* principle, applied
> internally.

---

## 13. Where AI helps, and where it must not decide

The kernel AI client (`@/kernel/ai-client`) serves this tab, under the standing rule in
`docs/AI_INTEGRATION.md`: every task below produces a **draft** for Amit to accept, edit or throw
away, and ingested source text is wrapped with `wrapExternalData()` and never treated as
instructions.

| Task | What it does | What stays with the human | Phase |
|---|---|---|---|
| Grouping Radar items | Bundles incoming material into one underlying question and phrases it. | Amit confirms or rewrites the question. | B |
| Pulling out names | Extracts people and stated roles from source text. | Every new person record is reviewed before it enters the list. | B |
| Background on a topic | Assembles context, prior I2L positions, what other podcasts covered. | Briefing material only. Never published unverified. | C |
| Explaining a route | Turns a computed connection into a sentence an introducer understands. | The introducer sees the evidence, not just the claim. | C |
| Drafting messages | Writes the introduction request and the invitation in the sender's voice. | Nothing is sent by the platform. The human sends everything. | C |
| After the recording | Pulls quotable moments, show notes and follow-up leads from the transcript. | Arrives in the content calendar as drafts. | C |

> **The boundary.** The model never sets a final score, never contacts anybody, and never claims
> two people know each other unless a human confirmed it. A number nobody can explain would be
> worse than the instinct it replaced.

---

## 14. The working rhythm

Built around a fortnightly session of about thirty minutes plus short check-ins. If it needs daily
attention it has failed. The board reads left to right, which means it is also the agenda.

| When | Who | What happens |
|---|---|---|
| Continuous | Platform | Radar collects and groups. Timeliness decays. Sleeping cards wake on their date. |
| Weekly, 5 min | Amit | Digest: top new topics, anything in Ask quiet > 7 days, anything stuck in Planning > 3 weeks. |
| Fortnightly, 30 min | Amit + Peter | Clear Radar. Research two or three names. Send invitations up to the limit of six open. Chase or reroute stalled cards. Settle dates. |
| On a yes | Amit | Agree date and scope, confirm consent, secure the second voice if the format needs one. |
| Before recording | Amit | Guest brief out, own questions prepared, launch plan generated, ask destination checked. |
| After recording | Amit | Card closes, content-calendar item created, guest moves to past guests. |
| 30 days after publishing | Platform → Amit | Results pulled; scoring weights reviewed quarterly. |
| Around each congress | Whole team | Programme imported, speakers matched to open questions, slots booked in advance. |

---

## 15. Measuring whether this works

| Measure | What should happen | Why |
|---|---|---|
| **Acceptance rate by route** | Introductions clearly beat cold approaches | The central bet of the whole design. If it does not hold, the network machinery should be cut rather than kept out of loyalty. |
| Time from name to booked recording | Down | Timeliness is worth 20 points; slow booking destroys it. |
| Score of booked vs unbooked people | Booked scores higher | Tests whether the score predicts anything. |
| Expected vs actual reach | The gap narrows | A model that never improves is a spreadsheet. |
| Follow-up conversion per episode | Up, and attributable | The mission outcome rather than the vanity one. |
| Introductions made, and requests per person | First up, second flat | Whether the network is engaged or being exhausted. |

---

## 16. Data protection and compliance

This tab stores information about people who have not signed up to anything, which makes it the
most sensitive module in the platform so far. It needs a written position **before** it is built.

| Issue | Position |
|---|---|
| **Lawful basis for people records** | Legitimate interest, for editorial and journalistic purposes, covering **professional information only**. A written legitimate interest assessment is required, prepared alongside the outstanding WhatsApp lawful basis decision so the Board takes one coherent decision. |
| **Data minimisation** | Professional information only. No private contact details beyond what an active invitation needs, and **none at all** for names still on a wishlist. |
| **Source attribution** | Every field carries a source URL. Anything unattributed is treated as unverified and **excluded from scoring**. |
| **Health information** | Never stored about a named individual, with one exception: where the person has publicly self-identified as a patient or survivor and that is the basis of their public role — then stored as a public role attribute with its source. |
| **Retention** | People records with no activity for **eighteen months** are purged. Closed cards are anonymised after **twelve months**. |
| **Right to object** | An objection sets `objection_received`, hides the record from every screen and from scoring, and holds permanently. A named person handles these. |
| **Member consent** | Affiliation declaration is opt-in, item by item, and revocable. Declining is invisible to everyone else. |
| **Platform terms of service** | No scraping. Open APIs, official feeds and manual entry only. |
| **Editorial independence** | Person records show any relationship with an industry partner, so a conflict is visible at booking time. |
| **Residency** | Unchanged. Supabase `eu-central-1`, Frankfurt. |

---

## 17. Delivery in three phases

The platform's established pattern: the manual version ships first and proves itself, then
automation is added where the manual version earned it. Nothing breaks if a later phase never
arrives.

**Phase A — the board** *(Sprint 20)*. Everything Amit can do without any automation: the tab
replaces Guests and guest data moves into the People list; questions, wishlists and the six-stage
board with the candidate drawer; manual scoring using the §10 rubric and manual route selection;
people records typed in plus imported from CRM and profiles; the opt-in affiliation form; the map
question and the introduction request, with answers captured back into the platform; the listener
action required on a question before any of its names can be researched; waiting-day counters on
Ask and Planning, and the limit of six open asks.

*Success criterion: two guests booked through an introduction recorded in the platform, and at
least fifteen members with a completed affiliation profile.*

**Phase B — Radar and the connection map.** Signal collection (Europe PMC, OpenAlex, EMA, ZonMw,
KWF, congress programmes, news); grouping and automatic scoring with timeliness decay;
co-authorship import and affiliation matching producing suggested routes; the Radar screen with
promote/dismiss where dismissals tune relevance; launch-plan task generation and the Results screen.
Designed in [`PODCAST_RADAR_CONCEPT.md`](PODCAST_RADAR_CONCEPT.md), which sequences it as
**find names → the fortnightly scan → routes from co-authorship** and argues that finding names for
a live question comes first, because Phase A shipped without any way to add a candidate at all.

> **Delivered in [Sprint 22](../sprints/sprint-22-podcast-radar/description.md):** find names, the
> fortnightly scan, the Radar screen with promote/dismiss, and dismissal learning — sourced from
> **OpenAlex and Europe PMC**. Still outstanding from this paragraph: the remaining feeds (EMA,
> ZonMw, KWF, congress programmes, news), co-authorship import and suggested routes, launch-plan
> tasks and the Results screen.

**Phase C — drafting and calibration.** Claude-drafted background, invitations and route
explanations; post-recording extraction into the content calendar; weights corrected from measured
outcomes, reviewed quarterly by a human; congress mode.

> **Reusability.** Nothing here is specific to Inspire2Live beyond its seed data. The Radar engine,
> the connection map, the chance-of-a-yes model and the two-step introduction loop are generic
> advocacy infrastructure, which makes them a strong candidate for the component toolbox
> (`docs/MODULAR_COMPONENT_ARCHITECTURE.md`) rather than a one-off. ADR-0013 records how that is
> reflected in the module split.

---

## 18. Open decisions

Each has a recommendation, but each is a decision for the organisation rather than for the build.
None of them blocks Phase A; the first one blocks going live with real people data.

| Decision | Recommendation |
|---|---|
| Does the Board accept legitimate interest as the lawful basis for storing information about potential guests? | Take it together with the outstanding WhatsApp lawful basis decision, as one Board item with one assessment covering both. |
| How much time does Amit actually have each fortnight? | The design assumes ~30 minutes plus follow-up. If the real figure is much lower, cut the number of live questions rather than the stages — skipping Research is what produces cold pitches that fail. |
| Is the podcast an Inspire2Live channel or a personal one? | Decides whose voice sends invitations and whose network it is fair to draw on. Settle it explicitly rather than by default. |
| How many members will agree to be asked? | Test before building Phase B: send the affiliation form to fifteen members by hand and count completions. |
| What cadence is the podcast committing to? | A series of four with a gap afterwards is a more honest commitment than a fixed weekly slot. |
| Where does actual reach data come from? | Follow-up measurement needs tracked links and a podcast host that reports downloads per episode. Confirm before Phase B. |
| Who is the default second voice? | Three of the six formats need an advocate alongside the guest. Without a standing pool, those formats are unbookable. |
| Does the Guests tab disappear entirely? | **Yes.** Guest information belongs on the episode record and in the People list. Keeping both creates two versions of the same fact. |

---

*Concept v0.2 describes intended behaviour. Scores, weights and thresholds are starting values to
be calibrated against real outcomes, not settled parameters — which is why they are manifest
config and a versioned weights table rather than constants scattered through the code.*

*Last reviewed: 2026-08-20.*
