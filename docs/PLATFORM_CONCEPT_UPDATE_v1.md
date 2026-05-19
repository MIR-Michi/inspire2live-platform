# INSPIRE2LIVE PLATFORM — CONCEPT UPDATE v1.0

**Communications-First Restructuring + World Campus Intake Layer**
**Extension to Platform Design Document v2.0**
**May 2026**

*This document extends and partially restructures the existing Platform Design Document (PLATFORM_DESIGN_DOCUMENT.md). It does not replace any existing specification. All prior feature specs, data models, RBAC, and technical architecture remain valid. This update introduces a revised Phase 1 priority, a new stakeholder group (communications team), a new workspace module (Communications Workspace), and a new intake mechanism (World Campus Channel Intake). Sections reference their counterparts in the original document where applicable.*

---

## Table of Contents

1. [Why This Update Exists](#1-why-this-update-exists)
2. [What Changes and What Stays the Same](#2-what-changes-and-what-stays-the-same)
3. [New Primary Stakeholder: The Communications Team](#3-new-primary-stakeholder-the-communications-team)
4. [The World Campus WhatsApp Channel — Problem Statement](#4-the-world-campus-whatsapp-channel--problem-statement)
5. [Content Taxonomy: Signal vs Noise](#5-content-taxonomy-signal-vs-noise)
6. [New Module: Communications Workspace](#6-new-module-communications-workspace)
7. [New Sub-Module: World Campus Channel Intake](#7-new-sub-module-world-campus-channel-intake)
8. [The Peter Kapitein Signal Layer](#8-the-peter-kapitein-signal-layer)
9. [Revised Information Architecture](#9-revised-information-architecture)
10. [Revised Implementation Roadmap](#10-revised-implementation-roadmap)
11. [New Database Tables](#11-new-database-tables)
12. [Integration Architecture](#12-integration-architecture)
13. [Risks and Mitigations](#13-risks-and-mitigations)

---

## 1. Why This Update Exists

The original Platform Design Document leads with the **Initiative Workspace and Bureau Dashboard** as Phase 1 — tools designed for coordinators and patient advocates managing active initiatives. This remains the strategic core of the platform.

This update introduces a **prior phase**: the Communications Workspace, built first and tested with the **communications team** as the pilot stakeholder group. The rationale is threefold:

**1. The communications team has an immediate, concrete, and bounded problem.** They currently operate by monitoring a 120-person WhatsApp group — the World Campus channel — and manually extracting actionable content from an unstructured stream of welcomes, article shares, event reports, birthday messages, and advocacy activity. This is a well-defined workflow that the platform can structurally improve from day one.

**2. Their infrastructure is already known.** The communications team works within a fixed set of tools: WordPress, LinkedIn, YouTube, Newsletter, Podcast (external channels) and SharePoint, Teams, Office 365, WhatsApp (internal infrastructure). The "connect, don't migrate" principle applies immediately — no new tools need to be introduced for them to participate.

**3. They are the right pilot group.** The communications team is contained, technically capable, and has daily contact with every other part of the organisation — the World Campus, the congress cycle, Peter Kapitein's network, and the initiative coordinators. Platform adoption that works for them creates a visible, functioning reference before the broader stakeholder rollout.

The initiative workspace, bureau, congress cycle, and hub network features described in the original document are **unchanged in scope and sequence** — they shift to Phase 2 and Phase 3 rather than Phase 1.

---

## 2. What Changes and What Stays the Same

### What changes

| Area | Original | Updated |
|---|---|---|
| Phase 1 pilot users | Coordinators + advocates (10–15) | Communications team (3–6) |
| Phase 1 primary feature | Initiative workspace | Communications workspace |
| Phase 1 success criterion | "Initiative tasks tracked; contributors active between meetings" | "Communications team operates their full publication workflow from the platform" |
| Channel integration priority | Deferred (stubs) | Day-one (WhatsApp intake, SharePoint, Teams) |
| New module | — | Communications Workspace (5 sub-modules) |
| New intake mechanism | — | World Campus Channel Intake |

### What stays the same

- All six personas from §2.2 of the Platform Design Document
- All data models, TypeScript interfaces, and SQL schema from the Technical Architecture
- All RBAC roles and permissions from §8.3
- The full initiative workspace feature spec (§5.2)
- Congress cycle management (§5.3), hub network (Phase 3), partner engagement
- Visual design system, brand colours, accessibility requirements
- Infrastructure strategy and cost phasing from the Infrastructure Guide
- The "connect, don't migrate" principle — now applied first, not later

---

## 3. New Primary Stakeholder: The Communications Team

The original document defines six personas. This update adds a **seventh persona** scoped to the pilot phase, and refines the existing Coordinator persona as it applies to communications.

### Persona 7: The Communications Coordinator

**Representative name:** Atefeh (referencing a real World Campus community member visible in the channel)

**Role:** Manages the communications output of Inspire2Live across all external channels. Responsible for ensuring that activity happening across the World Campus, congress cycle, and initiatives is translated into coherent, timely, and on-brand content for LinkedIn, the newsletter, the podcast, WordPress, and YouTube.

**Current workflow pain:** The primary coordination stream — the World Campus WhatsApp group with 120 members — is unstructured. Atefeh must read every message to find publishable content: a congress event report buried between birthday wishes, a LinkedIn post shared by a member that deserves amplification, a photo from a GUIDE.MRD meeting that belongs in the media library. There is no triage layer. Signal and noise arrive in the same stream.

**What the platform gives her:**
- A curated intake queue filtered from the WhatsApp channel — she reviews, not monitors
- A content calendar that connects intake items directly to scheduled posts
- A media library linked to SharePoint, eliminating duplicate storage
- A World Campus log where meeting outputs are structured rather than buried in chat
- An event pipeline that tracks conferences and congresses from announcement to post-event report

**Technical access level:** Moderator role (existing RBAC) with read access to all initiatives and write access to the Communications Workspace. Cannot modify initiative workspaces directly, but can flag initiative updates as content candidates.

---

## 4. The World Campus WhatsApp Channel — Problem Statement

### Current reality

The World Campus WhatsApp group has approximately **120 members** from patient advocacy communities across Africa, Latin America, Asia, Europe, and the Americas. It is the primary real-time communication channel for the network and functions simultaneously as:

- A welcoming channel for new members
- A news feed for members sharing relevant research and articles
- An event reporting channel (photos, updates from conferences)
- A social channel (birthdays, reactions, encouragement)
- An informal coordination channel for logistics
- An advocacy signal channel where members share their own publications and activities

From a communications team perspective, this single stream contains both **high-value editorial content** and **social noise** — and the two are indistinguishable without reading every message.

### Observed content from the channel (May 2026)

The following content types were directly observed in the channel screenshots and inform the classification model:

| Observed message | Content type | Communications value |
|---|---|---|
| Peter Kapitein welcoming Michael from Austria | Member onboarding | World Campus log entry |
| Richard, Zoli, Barbara, Phil welcoming new members | Social/relational | None (noise for comms) |
| Stephen Rowley sharing GUIDE.MRD General Assembly photos + caption | Event report | Media library + content calendar |
| LinkedIn post about GUIDE.MRD liquid biopsy benchmarking (ctDNA, MRD, colorectal/lung/pancreatic) | Research share + advocacy activity | Newsletter candidate, LinkedIn amplification |
| Tempus AI-Powered Precision Medicine link share | External resource share | Newsletter candidate |
| Peter Kapitein birthday message to @deapostle22 | Social/relational | None (noise for comms) |
| Barbara birthday message to Paul | Social/relational | None (noise for comms) |
| Atefeh asking if anyone has the "Congress Photos" WhatsApp group | Media recovery request | Media library action item |
| Jeff Waldron responding with congress video | Media asset | Media library |
| KemiAdekanye thanking members for welcome | Social/relational | None (noise for comms) |

The signal-to-noise ratio for the communications team is approximately **3:10** — roughly 3 in every 10 messages contains actionable editorial content. The current approach requires monitoring all 10 to find the 3.

### The platform's role

The platform does not replace the WhatsApp channel. It adds a **structured triage layer** between the channel and the communications team's workflow. Members continue to communicate naturally in WhatsApp. The platform captures, classifies, and surfaces the content that matters — without requiring members to change their behaviour.

---

## 5. Content Taxonomy: Signal vs Noise

This taxonomy defines how the intake system classifies messages from the World Campus channel. It is the foundation for the intake queue's filter and routing logic.

### Signal types (routed to platform)

**Type 1 — Event Report**
Definition: A message containing photos, a text summary, or a link describing an event the member attended or participated in as a patient advocate.
Examples: GUIDE.MRD General Assembly photos, liquid biopsy conference summary, congress session recap.
Indicators: Photos attached + descriptive caption; location + date references; conference or meeting name; hashtags related to specific initiatives.
Destination: Event pipeline (new entry) + Media library (photos/documents) + Content calendar (draft post).

**Type 2 — Research / Article Share**
Definition: A message containing an external link to a published article, study, news item, or resource directly relevant to cancer advocacy or Inspire2Live initiatives.
Examples: The Guardian article on pembrolizumab, Tempus precision medicine link, LinkedIn post on MRD assays.
Indicators: URL present; source is a recognised publication or institution; content relates to cancer treatment, patient advocacy, or Inspire2Live initiative topics.
Destination: Content calendar (newsletter candidate) + optionally Media library.

**Type 3 — Member Introduction / Onboarding Signal**
Definition: Peter Kapitein's welcome message introducing a new member, or a new member's first self-introduction message.
Examples: "A warm welcome to Michael from Austria", Michael's response thanking the community.
Indicators: Peter Kapitein as sender + welcome phrasing; or new member explicitly introducing themselves with country/affiliation.
Destination: World Campus log (new member entry) + Member profile queue (for onboarding follow-up).

**Type 4 — Initiative Update**
Definition: A message reporting on an Inspire2Live initiative — progress, a meeting, a publication, or a milestone.
Examples: GUIDE.MRD participation report, Breast Without Spot activity update.
Indicators: Explicit initiative name; report language ("I participated as a patient advocate in..."); structured advocacy description.
Destination: Event pipeline + World Campus log + optionally linked to initiative workspace.

**Type 5 — Media Recovery / Asset Request**
Definition: A message seeking to locate or recover media assets (photos, videos, documents) from a past event.
Examples: Atefeh's request for the Congress Photos WhatsApp group.
Indicators: Question phrasing + reference to specific event + request for photos/videos/files.
Destination: Media library action item (flagged for manual follow-up by communications coordinator).

### Noise types (not routed — filtered out)

- Welcome replies and emoji reactions from existing members to new members
- Birthday wishes and celebratory messages
- Reply chains acknowledging other messages without adding new information
- Meta-logistics unrelated to content (scheduling questions, group management)
- Casual conversation and social exchanges

> **Important:** "Noise" for the communications team is not noise for the organisation. The social cohesion of the channel is valuable. The platform never deletes, suppresses, or modifies WhatsApp messages — it only selectively captures and routes content into the structured workspace. The channel continues to operate exactly as it does today.

---

## 6. New Module: Communications Workspace

The Communications Workspace is a new top-level module within the authenticated platform (`/app/comms`). It sits alongside the initiative workspaces and bureau, serving the communications team's specific workflow.

### Architecture: five sub-modules

The four modules shown in the original architecture diagram — Event Pipeline, World Campus Log, Content Calendar, Media Library — are implemented as sub-modules of the Communications Workspace, with the addition of a fifth: the **World Campus Channel Intake**.

```
/app/comms
├── /intake          ← NEW: World Campus channel triage queue
├── /calendar        ← Content calendar (newsletter, podcast, social)
├── /events          ← Event pipeline (conferences, congresses)
├── /campus-log      ← World Campus meeting reports + member log
└── /media           ← Media library (linked to SharePoint)
```

### 6.1 World Campus Channel Intake

*Specified in full detail in §7.*

### 6.2 Content Calendar (`/app/comms/calendar`)

**Purpose:** Single view of all scheduled and draft content across external channels. Content enters from the intake queue (WhatsApp captures) or is created manually. Exiting content publishes to WordPress, LinkedIn, the newsletter tool, and the podcast feed.

**Views:**
- Monthly calendar grid with channel-colour-coded entries (LinkedIn = blue, Newsletter = teal, WordPress = orange, Podcast = purple, YouTube = red)
- List view with status column: Draft | In Review | Scheduled | Published
- Filter by channel, by content type, by source (manual / intake / initiative update)

**Content card fields:**
- Title
- Channel (multi-select: LinkedIn, Newsletter, WordPress, Podcast, YouTube)
- Status
- Scheduled publish date
- Author / assigned editor
- Source link (intake item, initiative, or external)
- Draft body (rich text)
- Attached media (links to Media Library items)
- Tags (initiative-linked, topic-linked)

**Actions:**
- "Create draft" — manual entry
- "Promote from intake" — one-click promotion of an intake item to a draft
- "Publish" — marks as published (manual trigger; no direct API to external channels in Phase 1 — connector-ready for Phase 2)
- "Archive" — removes from active calendar without deleting

**Integration target (Phase 2):** WordPress REST API for direct publish; LinkedIn API for scheduled posts; Mailchimp / newsletter tool API for newsletter drafts.

### 6.3 Event Pipeline (`/app/comms/events`)

**Purpose:** Tracks all external events — conferences, congresses, symposia, workshops — from announcement through attendance to post-event reporting and content output.

**Event lifecycle stages:**
1. **Announced** — event identified, date and location recorded
2. **Attending** — Inspire2Live member(s) confirmed to attend; roles assigned (speaker, panellist, attendee, patient advocate representative)
3. **In Progress** — live event; intake captures real-time reports from the WhatsApp channel
4. **Post-Event** — summary drafted; media assets uploaded; content calendar items created
5. **Archived** — event closed; all outputs stored and linked

**Event record fields:**
- Event name
- Date(s) and location
- Organiser / host
- I2L representatives attending (linked to member profiles)
- Initiative linkage (which initiative(s) does this event relate to?)
- Stage (lifecycle above)
- Output checklist: post-event report drafted, LinkedIn post published, newsletter mention, media assets stored
- Related intake items (auto-linked when intake classifier identifies the event)

**Relationship to Congress Cycle:** The Annual Congress is the primary event in this pipeline and connects directly to the Congress Cycle Management features specified in §5.3 of the Platform Design Document. The event pipeline tracks external events *other* than the Annual Congress. Both share the same data model with a `is_annual_congress` flag.

### 6.4 World Campus Log (`/app/comms/campus-log`)

**Purpose:** Structured record of World Campus monthly sessions and member activity — replacing the unstructured WhatsApp thread as the system of record.

**Two components:**

**Session log:** Each World Campus monthly session gets a structured entry:
- Session date and theme
- Participating hubs (country flags + hub names)
- Summary (auto-prompted from session coordinator; drafted in platform)
- Action items flagged for publication
- Linked media (recording URL, slides — linked from Media Library)
- Initiative connections (which initiatives were discussed or advanced)
- Published outputs (links to newsletter item, LinkedIn post, etc.)

**Member log:** A lightweight CRM layer tracking World Campus community members:
- Name, country, organisation, role
- Date joined the WhatsApp channel (sourced from intake: Peter's welcome messages)
- Initiatives affiliated with
- Content contributions (intake items attributed to them)
- Last active date in the channel
- Notes (manual, by communications coordinator)

> The member log is not a full CRM. It is a communications-layer view of who is active in the community, used to identify advocates to profile, feature in the newsletter, or invite to contribute more formally. It is read-only for members — they never see their own entry unless they have an authenticated platform profile.

### 6.5 Media Library (`/app/comms/media`)

**Purpose:** Centralised, searchable store of all media assets — photos, videos, recordings, slide decks, reports — linked to SharePoint as the primary storage backend.

**Asset record fields:**
- Title
- Type: photo | video | recording | slides | document | report
- Event or session source (linked to Event Pipeline or World Campus Log)
- Initiative linkage
- Upload date and contributor
- SharePoint file path / URL (the platform stores the reference; SharePoint stores the file)
- Tags (topic, initiative, event, person)
- Rights status: internal-only | approved-for-publication | needs-clearance
- Usage log (which content calendar items have used this asset)

**SharePoint integration:** In Phase 1, this is a reference link — the communications coordinator uploads to SharePoint as usual and pastes the link into the media library record. In Phase 2, a SharePoint Graph API integration allows direct browse-and-link from within the platform without leaving the interface.

**Key workflow:** When Atefeh asks in WhatsApp "does anyone have the Congress Photos group?", the platform's intake captures this as a Type 5 (Media Recovery) item and flags it as an action item in the media library. Jeff Waldron's response (offering congress videos) becomes a follow-up item. The media coordinator receives a notification: "Unresolved media recovery request from Congress Photos — 1 offer received. Add assets to media library."

---

## 7. New Sub-Module: World Campus Channel Intake

The intake module is the most novel addition to the platform. It solves the core problem: transforming a high-volume, unstructured WhatsApp stream into a structured, actionable queue for the communications team.

### 7.1 Concept

The intake module is a **daily triage interface**. It presents captured messages from the World Campus WhatsApp channel, pre-classified by content type, and allows the communications coordinator to route them to the appropriate destination with a single action — or dismiss them.

The communications team stops *monitoring* WhatsApp. They start *reviewing* a curated queue.

### 7.2 Capture mechanism

**Phase 1 — Manual capture with structured form:**
The communications coordinator (or a designated community monitor) reviews the WhatsApp channel and manually submits items to the intake queue via a simple form in the platform. The form captures: sender name, message content or summary, content type (pre-selected from the taxonomy in §5), source URL if applicable, and any attached media.

This is deliberate. Phase 1 keeps humans in the loop for classification accuracy. The structured form trains the team to think in terms of the taxonomy, which prepares the ground for automation.

**Phase 2 — WhatsApp Business API webhook:**
A webhook integration with the WhatsApp Business API forwards all group messages to a Supabase Edge Function. The function applies a classification model (rule-based in Phase 2, AI-assisted in Phase 3) to pre-classify each message and add it to the intake queue automatically. The coordinator reviews classifications rather than raw messages.

**Phase 3 — AI-assisted classification and draft generation:**
An LLM layer (integrated via the Anthropic API) classifies messages with higher accuracy across edge cases, suggests routing decisions, and — for Type 1 and Type 2 items — generates a draft content calendar entry (headline, body paragraph, suggested channel) that the coordinator can edit and approve in one step.

### 7.3 Intake queue interface (`/app/comms/intake`)

**Layout:**
The intake queue is a single-column review interface, similar in structure to an email inbox but purpose-built for editorial triage.

**Queue header:**
- Today's date
- Unreviewed item count badge
- Filter bar: All | Events | Articles | Members | Initiative Updates | Media Requests | Dismissed
- "Daily digest" button — sends a summary email of the day's captured items to the coordinator

**Item card structure:**

Each item in the queue displays:
```
[TYPE BADGE]  Sender name  ·  Received timestamp
─────────────────────────────────────────────────
Message summary or full text (truncated to 3 lines, expandable)
[Source URL / attached media thumbnail if present]

Suggested destination: [Content Calendar — Newsletter] [Confidence: High]

[Route]  [Edit classification]  [Dismiss]
```

**Route action:** Opens a lightweight modal with the pre-selected destination pre-filled. The coordinator confirms or changes the destination and clicks "Route". The item is marked as reviewed and appears in the destination module.

**Edit classification:** Allows the coordinator to change the content type before routing. All manual corrections are logged and used to improve the Phase 3 classification model.

**Dismiss:** Removes the item from the active queue. All dismissed items are retained in a hidden archive for 90 days (recoverable).

### 7.4 Daily intake digest

Every morning at a configurable time (default: 08:00 coordinator timezone), the platform sends a digest email summarising:

- Number of items captured since last review
- Breakdown by type (3 event reports, 2 article shares, 1 member intro, 1 media request)
- Highest-confidence routing suggestions (items the coordinator can approve in bulk)
- Items flagged for manual review (low-confidence classification or ambiguous routing)

This mirrors the weekly digest pattern from the original notification system (§5.10 of the Platform Design Document) but is scoped to the communications team's daily rhythm.

### 7.5 Routing destinations summary

| Content type | Primary destination | Secondary destination |
|---|---|---|
| Event Report | Event Pipeline (new/update entry) | Media Library + Content Calendar (draft) |
| Article Share | Content Calendar (newsletter candidate) | Media Library (if document) |
| Member Introduction | World Campus Log (member entry) | Member profile queue |
| Initiative Update | Event Pipeline | World Campus Log + Initiative workspace link |
| Media Recovery Request | Media Library (action item) | Notification to media coordinator |
| Noise | Dismissed | Archive (90 days) |

---

## 8. The Peter Kapitein Signal Layer

Peter Kapitein's messages in the World Campus channel carry specific institutional weight that warrants dedicated handling in the intake system. He is not just another community member — he is the founder and primary relationship holder for most new members entering the network.

### What his messages indicate

**Welcome messages** ("A warm welcome to Michael from Austria 🇦🇹"):
- Indicate a new member has been formally introduced to the network
- The message typically includes the person's name and country
- This is the trigger for a World Campus Log entry: new member, country, date of introduction
- Secondary signal: Peter's relationship with this person is likely direct — they may be a congress speaker, a hub coordinator, or a partner organisation contact

**Content shares:**
- When Peter shares an article, a link, or a resource, it is almost certainly relevant to at least one active initiative
- Auto-classify as Type 2 (Article Share) with confidence: High, and additionally flag as "Founder amplification" — a signal that this content may warrant LinkedIn repost or newsletter feature beyond a standard newsletter item

**Birthday and social messages:**
- Classified as noise for the communications team
- However: the person being celebrated is a community member, and their name + the date become a data point in the member log (birthday noted, relationship with Peter confirmed)

### Platform behaviour

In the intake queue, messages from Peter Kapitein are displayed with a distinct visual treatment: a founder badge next to his name. The classification remains the same, but the confidence level is automatically elevated to High — Peter's editorial judgment is trusted by default.

A dedicated filter in the intake queue — "Peter's messages" — allows the coordinator to review his contributions in isolation. This is particularly useful during high-activity periods (post-congress, post-World Campus session) when the channel volume is highest.

---

## 9. Revised Information Architecture

The following extends the site map from §4.1 of the Platform Design Document. New routes are marked `[NEW]`. Phase assignments reflect the updated roadmap in §10.

```
/app (Authenticated Platform)
├── /app/dashboard                          [P1 — unchanged]
├── /app/comms                              [NEW — P1]
│   ├── /app/comms/intake                   [NEW — P1, primary Phase 1 feature]
│   ├── /app/comms/calendar                 [NEW — P1]
│   ├── /app/comms/events                   [NEW — P1]
│   ├── /app/comms/campus-log               [NEW — P1]
│   └── /app/comms/media                    [NEW — P1]
├── /app/initiatives                        [P2 — was P1]
│   └── /app/initiatives/[id]
├── /app/bureau                             [P2 — was P1]
├── /app/congress                           [P2 — unchanged]
├── /app/world-campus                       [P3 — unchanged]
├── /app/members                            [P2 — unchanged]
├── /app/partners                           [P2 — unchanged]
└── /app/settings                           [P1 — unchanged]
```

### New RBAC permissions for Communications Workspace

Extends the permission matrix from §8.3 of the Platform Design Document:

| Permission | Comms Coordinator | Moderator | Board Member | Platform Admin |
|---|---|---|---|---|
| View intake queue | ✅ | ✅ | ❌ | ✅ |
| Route intake items | ✅ | ✅ | ❌ | ✅ |
| Create content calendar entries | ✅ | ✅ | ❌ | ✅ |
| Publish / mark as published | ✅ | ✅ | ❌ | ✅ |
| Manage event pipeline | ✅ | ✅ | ❌ | ✅ |
| View event pipeline | ✅ | ✅ | ✅ | ✅ |
| Manage World Campus log | ✅ | ✅ | ❌ | ✅ |
| Upload to media library | ✅ | ✅ | ❌ | ✅ |
| View media library | ✅ | ✅ | ✅ | ✅ |
| Configure intake classifier | ❌ | ❌ | ❌ | ✅ |

> The "Comms Coordinator" is not a new RBAC role — it maps to the existing Moderator role with a communications-scoped default dashboard. A single role flag `comms_team: boolean` on the profile record determines whether the user sees `/app/comms` as their primary landing view.

---

## 10. Revised Implementation Roadmap

### Phase 1 (revised): Communications Workspace — Weeks 1–8

**Pilot users:** Communications team (3–6 people)
**Primary goal:** Communications team operates their full publication workflow from the platform. The WhatsApp monitoring burden is reduced. Content moves from the channel to the appropriate destination without manual transcription.

**Success criteria:**
- At least one newsletter issue planned and tracked entirely within the content calendar
- At least 5 event reports captured, routed, and linked to media library assets in one week
- At least 10 member introductions logged in the World Campus log
- Communications coordinator reports reduced monitoring time for the WhatsApp channel

**Week 1–2: Design system + core shell**
*(Unchanged from original roadmap — foundational components required for all modules)*
- Full design token system, base UI components, layout shells
- Role-based routing and permission hooks
- `comms_team` profile flag and routing logic

**Week 3–4: Intake queue + Content Calendar**
- Manual intake form (Phase 1 capture mechanism)
- Intake queue interface with classification display and routing actions
- Content calendar — monthly and list views, draft creation, status management
- Daily intake digest email (Resend integration — already in infrastructure)

**Week 5–6: Event Pipeline + World Campus Log**
- Event pipeline with lifecycle stages and output checklist
- World Campus Log — session entries and member log
- Peter Kapitein signal layer (founder badge, elevated confidence, dedicated filter)
- Routing connections: intake → event pipeline, intake → campus log

**Week 7–8: Media Library + Integration stubs + Pilot launch**
- Media library with SharePoint reference link model
- Media recovery action item flow
- All routing destinations connected and tested
- Pilot launch with communications team
- Feedback collection and iteration sprint

**Phase 1 infrastructure additions:**
- WhatsApp Business API account setup (for Phase 2 webhook — account created in Phase 1, webhook built in Phase 2)
- SharePoint app registration for Graph API (scoped read permissions — Phase 1 uses link references only)

---

### Phase 2 (revised): Initiative Workspace + Bureau + WhatsApp Automation — Weeks 9–20

*(Largely unchanged from original Phase 1 and Phase 2 content. The initiative workspace, bureau, congress cycle features, and partner engagement features move here.)*

**Phase 2 additions (new, communications-related):**
- WhatsApp Business API webhook: auto-forward group messages to Supabase Edge Function
- Rule-based classifier: auto-classify messages by content type before coordinator review
- Content calendar: WordPress REST API integration for direct publish
- Content calendar: LinkedIn API for scheduled post creation
- SharePoint Graph API: browse-and-link from within the media library

**Week 9–12:** Initiative workspace core (unchanged from original Week 3–4)
**Week 13–14:** Member portal + bureau (unchanged from original Week 5–6)
**Week 15–16:** WhatsApp webhook + rule-based classifier
**Week 17–18:** Congress cycle — pre-congress features (unchanged from original Week 7–9)
**Week 19–20:** Congress cycle — during and post-congress features

---

### Phase 3 (revised): Global Hub Rollout + AI-Assisted Intake — Weeks 21–34

*(Unchanged from original Phase 3 hub network content, with the following addition:)*

**AI-assisted intake classification (new):**
- Anthropic API integration for LLM-based message classification
- Draft content generation: for Type 1 (Event Report) and Type 2 (Article Share), the system generates a draft newsletter paragraph and LinkedIn post caption
- Coordinator reviews and approves generated drafts rather than writing from scratch
- Classification correction feedback loop: manual overrides in the intake queue feed back into prompt improvement

---

## 11. New Database Tables

The following tables extend the schema defined in the Technical Architecture document. All existing tables are unchanged.

```sql
-- ============================================================
-- COMMUNICATIONS WORKSPACE
-- ============================================================

-- Intake items captured from WhatsApp channel
create table public.intake_items (
  id uuid primary key default gen_random_uuid(),
  captured_at timestamptz not null default now(),
  capture_method text not null check (capture_method in ('manual', 'webhook', 'ai')),
  sender_name text not null,
  sender_whatsapp_id text,                         -- populated in Phase 2
  raw_content text not null,
  source_url text,
  content_type text not null check (content_type in (
    'event_report', 'article_share', 'member_intro',
    'initiative_update', 'media_request', 'noise'
  )),
  classification_confidence text check (classification_confidence in ('high', 'medium', 'low')),
  is_peter_kapitein boolean not null default false,
  status text not null default 'unreviewed' check (status in (
    'unreviewed', 'routed', 'dismissed', 'archived'
  )),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  routed_to_type text,                             -- 'event', 'calendar', 'campus_log', 'media', 'member'
  routed_to_id uuid,                               -- polymorphic reference to destination record
  dismissed_reason text,
  created_at timestamptz not null default now()
);

create index idx_intake_status on public.intake_items(status);
create index idx_intake_captured on public.intake_items(captured_at desc);
create index idx_intake_peter on public.intake_items(is_peter_kapitein) where is_peter_kapitein = true;

-- Content calendar entries
create table public.content_calendar (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  channels text[] not null,                        -- ['linkedin', 'newsletter', 'wordpress', 'podcast', 'youtube']
  status text not null default 'draft' check (status in (
    'draft', 'in_review', 'scheduled', 'published', 'archived'
  )),
  scheduled_at timestamptz,
  published_at timestamptz,
  body_draft text,
  author_id uuid references public.profiles(id),
  source_intake_id uuid references public.intake_items(id),
  source_initiative_id uuid references public.initiatives(id),
  source_event_id uuid references public.events(id),
  tags text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_calendar_status on public.content_calendar(status);
create index idx_calendar_scheduled on public.content_calendar(scheduled_at);

-- Events pipeline (external conferences, congresses, etc.)
create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_type text not null check (event_type in (
    'conference', 'congress', 'workshop', 'webinar', 'symposium', 'other'
  )),
  is_annual_congress boolean not null default false,
  start_date date not null,
  end_date date,
  location_city text,
  location_country text,
  organiser text,
  stage text not null default 'announced' check (stage in (
    'announced', 'attending', 'in_progress', 'post_event', 'archived'
  )),
  i2l_representatives uuid[],                      -- array of profile ids
  initiative_ids uuid[],                            -- related initiatives
  output_report_drafted boolean not null default false,
  output_linkedin_published boolean not null default false,
  output_newsletter_mentioned boolean not null default false,
  output_media_stored boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_events_stage on public.events(stage);
create index idx_events_date on public.events(start_date);

-- World Campus session log
create table public.campus_sessions (
  id uuid primary key default gen_random_uuid(),
  session_date date not null,
  theme text,
  participating_hub_ids uuid[],
  summary text,
  action_items_for_publication text[],
  recording_url text,
  slides_media_id uuid references public.media_assets(id),
  initiative_ids uuid[],
  published_outputs uuid[],                        -- content_calendar ids
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- World Campus member log
create table public.campus_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text,
  organisation text,
  role_description text,
  whatsapp_id text,
  platform_profile_id uuid references public.profiles(id),  -- null if not yet on platform
  date_welcomed date,                              -- date of Peter's welcome message
  welcomed_by_peter boolean not null default false,
  initiative_affiliations uuid[],
  notes text,
  last_channel_activity date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_campus_members_country on public.campus_members(country);
create index idx_campus_members_peter on public.campus_members(welcomed_by_peter);

-- Media library
create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  asset_type text not null check (asset_type in (
    'photo', 'video', 'recording', 'slides', 'document', 'report'
  )),
  sharepoint_url text,                             -- Phase 1: manual reference link
  storage_path text,                               -- Phase 2+: Supabase Storage path
  event_id uuid references public.events(id),
  session_id uuid references public.campus_sessions(id),
  initiative_id uuid references public.initiatives(id),
  contributed_by uuid references public.profiles(id),
  rights_status text not null default 'internal' check (rights_status in (
    'internal_only', 'approved_for_publication', 'needs_clearance'
  )),
  tags text[],
  usage_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_media_type on public.media_assets(asset_type);
create index idx_media_rights on public.media_assets(rights_status);
```

---

## 12. Integration Architecture

### Phase 1 integrations (manual / reference)

| Integration | Phase 1 approach | Phase 2 target |
|---|---|---|
| WhatsApp channel | Manual form submission by coordinator | WhatsApp Business API webhook |
| SharePoint | Coordinator pastes SharePoint URL into media library; optional "+ from SharePoint" stub logs integration intent only | Microsoft Graph API browse-and-link |
| Teams | Feature-flagged Teams stub on event and session detail logs intent only | Teams API for meeting links and recordings |
| WordPress | Admin-only publish stub on content calendar logs intent only | WordPress REST API direct publish |
| LinkedIn | Schedule stub on content calendar logs intent only | LinkedIn API scheduled post |
| Newsletter tool | Mailchimp/newsletter draft stub logs intent only | Mailchimp / Brevo API |

### Phase 2 WhatsApp webhook architecture

```
WhatsApp Group Message
        │
        ▼
WhatsApp Business API
        │  (webhook POST)
        ▼
Supabase Edge Function: intake-classifier
        │
        ├─ Rule-based classification (content_type + confidence)
        ├─ Peter Kapitein flag (sender ID match)
        ├─ Source URL extraction
        │
        ▼
public.intake_items (new row, status: 'unreviewed')
        │
        ▼
Notification → Communications Coordinator
(in-platform + email digest)
        │
        ▼
Coordinator reviews in /app/comms/intake
→ Routes with one click
→ Destination record created
→ Item status: 'routed'
```

---

## 13. Risks and Mitigations

The following risks are specific to this concept update. The original risk register (§12 of the Platform Design Document) remains valid and is not superseded.

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| WhatsApp Business API approval delays | Medium | High | Phase 1 uses manual capture — no API dependency. Apply for Business API account during Phase 1 so it's ready for Phase 2. |
| Communications team resistance to new workflow | Low | High | The intake queue reduces their workload rather than adding to it. Pilot with one coordinator before full team rollout. Show the time saved in the first week. |
| Over-classification (too many items reach the queue) | Medium | Medium | Start with a conservative classifier — prefer false negatives over false positives. The coordinator's trust in the queue depends on signal quality, not volume. |
| Privacy concerns: capturing WhatsApp messages | Medium | High | Phase 1 (manual): coordinator submits only content they would publish anyway — no personal messages captured. Phase 2 (webhook): implement strict filtering — only messages matching content type patterns are stored; all other messages discarded at the Edge Function level, never written to the database. |
| SharePoint permissions complexity | Medium | Low | Phase 1 uses URL references only — no SharePoint auth required. Graph API integration in Phase 2 is additive, not blocking. |
| Peter Kapitein signal layer creates over-dependence | Low | Medium | The founder badge is informational, not decisional. The coordinator still routes manually. Confidence: High means "review this first", not "publish automatically". |
| Content calendar becomes a backlog sink | Medium | Medium | Weekly review ritual: communications coordinator marks stale drafts (>14 days without activity) as archived. RAG-style staleness indicator on calendar items. |

---

*This document is version 1.0. It will be updated as the Phase 1 pilot produces feedback. The next revision will incorporate discovery session outputs from the communications team and any technical constraints identified during implementation.*

*References: PLATFORM_DESIGN_DOCUMENT.md v2.0 · TECHNICAL_ARCHITECTURE.md v1.0 · INFRASTRUCTURE_GUIDE.md v1.0*
