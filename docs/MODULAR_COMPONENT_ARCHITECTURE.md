# Modular Component Architecture — Concept

**From a hardwired platform to a composable component toolbox**
**Extension to `docs/PLATFORM_CONCEPT_UPDATE_v1.md`**
**July 2026**

*This document defines the target architecture for the next phase: turning the Inspire2Live
platform from a single hardwired application into a **toolbox of independent components** that can be
recomposed into related platforms — first by hand, later by an AI wizard. It does not change any
current feature. It defines the boundaries, contracts, and a staged transition path, and it explains
how that structure feeds the three future AI levels (collect requirements → build platform → operate
platform).*

---

## Table of Contents

1. [Why This Exists](#1-why-this-exists)
2. [The Core Idea: One Component, Three Representations](#2-the-core-idea-one-component-three-representations)
3. [What a Component Is](#3-what-a-component-is)
4. [The Component Manifest — the Single Bridging Artifact](#4-the-component-manifest--the-single-bridging-artifact)
5. [Repo Structure](#5-repo-structure)
6. [Database Structure](#6-database-structure)
7. [The Platform Kernel](#7-the-platform-kernel)
8. [Initial Component Decomposition of Inspire2Live](#8-initial-component-decomposition-of-inspire2live)
9. [Contract Rules That Keep Components Independent](#9-contract-rules-that-keep-components-independent)
10. [The Three AI Levels — and How the Structure Feeds Them](#10-the-three-ai-levels--and-how-the-structure-feeds-them)
11. [Transition Ladder (Stage 0 → Stage 5)](#11-transition-ladder-stage-0--stage-5)
12. [What We Are Deliberately Not Doing Yet](#12-what-we-are-deliberately-not-doing-yet)

---

## 1. Why This Exists

Today the platform is one application. It works, but its parts are entangled at every layer:

- **Application layer:** `src/lib/` is ~80 flat files; ~40 are `comms-*`. There is no boundary that
  says "the CRM cannot reach into intake internals" — only naming convention.
- **Database layer:** every table lives in the single `public` schema. Ownership is expressed only by
  informal prefixes (`comms_crm_*`, `intake_*`, `conference_*`, `congress_*`, `campus_*`,
  `initiative_*`, `hub_*`, `meeting_*`, `member_onboarding_*`, `ai_*`), and those prefixes are
  inconsistent (`conference` vs `congress` vs `campus`; `comms_crm` vs `crm`).
- **Delivery:** features are sequenced by sprint, but nothing in the repo or DB records which sprint's
  tables/files belong to which capability, so nothing can be lifted out and reused.

The midterm goal is a **component toolbox**: a library of self-contained capabilities from which an AI
wizard can generate a *related* platform (a different patient-advocacy org, a research network, a
congress-only deployment) by collecting requirements and composing components. That future rests on one
prerequisite this document delivers: **clear, independent components with stable contracts, represented
identically in the repo and in the database.**

We are not starting from zero. The team has already built the exact seed pattern this generalizes —
**ADR-0008** (unified task domain layer): a `security_invoker` view as a read contract, a TypeScript
domain layer as the single behavior source, thin adapters over focused per-context tables, and
"contract by convention first, physical migration only if ever needed." This concept promotes that one
success into the general shape of *every* component.

---

## 2. The Core Idea: One Component, Three Representations

A **component** is a self-contained capability with a stable contract. The whole architecture rests on
representing each component **the same way in three places**, so that a human — and later an AI — can
reason about one thing, not three:

| Representation | Where | What it is |
|---|---|---|
| **Code module** | `src/modules/<component>/` | domain logic, UI, API, all behind one public API |
| **Data domain** | one Postgres schema `<component>` (today: one table prefix) | tables, RLS, and published read views |
| **Manifest** | `src/modules/<component>/manifest.ts` | a declarative description of the two above + dependencies, config, roles, requirements |

The **manifest is the bridge**. Today humans read it to know what a component owns and needs. Tomorrow
the AI levels read the *same* manifests to select, compose, and operate components. We build the
discipline now for humans and harvest it later for AI — nothing about the manifest is speculative
future work; it documents what already exists.

---

## 3. What a Component Is

A component **owns** a slice of the platform end-to-end:

- Its **data** — a group of tables and their RLS, migrations, and read views.
- Its **domain logic** — types, repository (reads), actions (writes), and any jobs.
- Its **surfaces** — the API routes and UI it mounts.
- Its **contract** — the small set of things other components are allowed to use.

A component **depends only on**:

- the **kernel** (identity, RBAC, shell, notifications, activity, AI client — see §7), and
- other components' **published contracts** — never their internals.

A component is **independently reasoned about, tested, feature-flagged on/off, and — in the target
state — extractable**. "Extractable" is the acid test: if you cannot describe what it would take to
lift a component into a second platform, its boundary is not yet real.

---

## 4. The Component Manifest — the Single Bridging Artifact

Every component declares itself in `manifest.ts`. This is the artifact that makes the AI transition
possible, because it turns "what this capability is" from tribal knowledge into structured data.

```ts
// src/modules/intake/manifest.ts
export const manifest = {
  id: 'intake',
  version: '1.0.0',
  title: 'Channel Intake',
  summary: 'Ingests unstructured channel messages (WhatsApp) and triages them into signal vs noise.',

  // DATA: what this component owns in the database.
  data: {
    schema: 'intake',                          // target-state Postgres schema
    tablePrefix: 'intake_',                     // today's namespacing in `public`
    tables: ['intake_items', 'intake_classifier_rules',
             'intake_ai_suggestions', 'intake_classification_corrections'],
    readViews: ['intake_items_public'],         // security_invoker read contract
    migrations: ['00028', '00038', '00044', '00077'],
  },

  // CONTRACT: the only things other components may import.
  provides: {
    api: ['loadIntakeQueue', 'promoteIntakeItem'],   // from index.ts
    events: ['intake.item.promoted'],                // domain events others can react to
    ui: ['IntakeQueue'],                             // mountable surfaces
  },

  // DEPENDENCIES: kernel + other components' contracts (never internals).
  dependsOn: {
    kernel: ['identity', 'rbac', 'notifications', 'ai-client'],
    components: ['contacts@^1'],                     // resolves message senders to contacts
  },

  // COMPOSITION: how a generated platform switches this on and configures it.
  featureFlag: 'intake_enabled',
  config: {
    channels: { type: 'enum[]', options: ['whatsapp', 'email'], default: ['whatsapp'] },
    classifier: { type: 'enum', options: ['rules', 'ai', 'hybrid'], default: 'hybrid' },
  },

  // WHO IT SERVES + WHY IT EXISTS (traceability we already keep).
  personas: ['communications-coordinator'],
  roles: { read: ['comms_team', 'admin'], write: ['comms_team', 'admin'] },
  requirements: ['REQ-COMMS-INTAKE-001', 'REQ-COMMS-INTAKE-002'],

  // OPERATE-LEVEL: agents/operations the L3 AI may invoke (§10).
  operations: ['classify-inbound', 'suggest-structure'],
} as const
```

The manifest is **descriptive, not a new runtime framework**: it names things that already exist in the
codebase. Its value compounds — it is simultaneously (a) documentation, (b) the input to an
import-boundary linter, (c) the catalog entry the AI wizard reads, and (d) the composition unit the
generator assembles.

---

## 5. Repo Structure

Introduce `src/modules/`, one folder per component, each with the ADR-0008 shape generalized. The flat
`src/lib/comms-*.ts` files move into the module that owns them; genuinely shared primitives stay in the
kernel.

```
src/
  kernel/                     # cross-cutting; every component may depend on this
    identity/                 # profiles, auth, contact identity (ADR-0007 spine)
    rbac/                     # roles, permissions, view-as
    shell/                    # nav, layout, route composition from manifests
    notifications/            # notify, activity log
    ai-client/                # Anthropic client, model routing, usage log
    ui/                       # design-system primitives (today src/components/ui)

  modules/
    <component>/
      manifest.ts             # the declarative contract (§4)
      index.ts                # PUBLIC API — the ONLY import surface for other modules
      domain/                 # types.ts · repository.ts (reads) · actions.ts (writes) · status.ts
      db/                     # migrations owned by this component (or a manifest reference)
      ui/                     # React components mounted by the shell
      api/                    # route handlers
      jobs/                   # scheduled/background work (e.g. classifier, newsfeed run)
      README.md               # human doc; mirrors the manifest
      *.test.ts

  app/                        # Next.js routing only — thin; delegates into modules/*/ui + api
```

**The one hard rule this structure enforces:** everything outside a component's `index.ts` is private.
Other modules import `@/modules/intake` (which re-exports only `provides.api`), never
`@/modules/intake/domain/repository`. This is enforceable today with an ESLint import-boundary rule
generated from the manifests — the boundary stops being a naming convention and becomes a check.

`src/components/` is already domain-foldered (comms, admin, initiatives, tasks, feedback…), so the UI
move is largely mechanical. `src/lib/tasks/` already **is** a module domain layer — it becomes the
template every other `domain/` folder copies.

---

## 6. Database Structure

The database expresses component boundaries through **schema ownership + published read views**, mirroring
the repo. This is a direct generalization of ADR-0008's `unified_tasks` view.

**Target state — one schema per component** (live capabilities only — see the boundary note below):

```
identity.*     profiles, auth links, contact spine (kernel-owned)
rbac.*         roles, permissions, overrides (kernel-owned)
contacts.*     crm_contacts, crm_pipelines, campus_members, interactions
intake.*       intake_items, classifier_rules, ai_suggestions
content.*      content_calendar, media_assets, integration_intents
events.*       events, conferences, conference_guest_* (podcast + conference pipeline)
initiatives.*  initiatives, milestones
tasks.*        tasks, comms_tasks, member_onboarding_tasks + unified_tasks view (ADR-0008)
stories.*      patient_stories (public patient-stories site only)
feedback.*     feedback_items
ai.*           ai_settings, ai_usage_log, org_feed, meeting_summaries (feature data)
```

> **Boundary note — derive components from the live nav, not from table prefixes.** The decomposition
> is drawn from what is actually reachable in `src/lib/role-access.ts` (the nav source of truth) and the
> public routes, **not** from the historical table-prefix archaeology in the `public` schema. That
> distinction matters because Sprint 15 (legacy cleanup) retired several spaces whose tables still
> physically exist, referenced now only by admin cascade-cleanup: **`hubs`** (Network space, retired),
> **`resources`** (Resources space, retired), and most **`congress_*`** tables (the internal Annual
> Congress *workspace*, retired — `00151` dropped part of it; the congress **guest attend** flow is a
> separate, kept surface). Likewise **`stories`** here means the **public** patient-stories site that
> Sprint 15 explicitly kept — the internal editorial Stories workspace (`/app/app/stories/*`) was
> deleted. **Retired-but-not-yet-dropped tables get no owning component.** They are Stage-2 drop
> candidates (new forward migrations), never something to build a boundary around. Authoring each
> manifest (Sprint 16) is the moment to re-verify its table list against reachability and prune anything
> that only survives because a `DROP` has not been written yet.

**Rules:**

1. **A component owns its schema.** Only that component's migrations create/alter tables in it.
2. **Cross-component reads go through published views, not raw tables.** Each component exposes a small
   set of `security_invoker = true` views (its read contract) — exactly like `unified_tasks`. A view
   grants no visibility the caller didn't already have, so the contract can't become a security bypass.
3. **Cross-component writes go through the owning component's domain actions** (TypeScript), never a
   direct `INSERT` from another module. This is already how ADR-0008's task adapters work.
4. **Identity is the one shared spine.** Components may hold `contact_id` / `profile_id` foreign keys
   into the kernel identity schema (ADR-0007 already makes `comms_crm_contacts` the canonical contact
   spine). They may **not** hold FKs into each other's schemas — cross-component links are resolved
   through the identity spine or through published views.

**Transition is gradual, prefix → schema.** We do **not** move 90 tables in one migration. Stage 1
declares ownership in each manifest (`tablePrefix`, `tables`, `migrations`) with **zero DB change** —
the boundary becomes documented and lint-checkable while tables stay in `public`. Stage 2 physically
relocates a component's tables into its schema, one component at a time, lowest-risk first (feedback,
stories) before the entangled ones (contacts, events). This is the same "contract by convention first,
physical only when it pays" philosophy ADR-0008 chose deliberately.

---

## 7. The Platform Kernel

Some concerns are used by every component but owned by none. Forcing them into a component would create
a dependency knot; leaving them flat is what we have today. They become an explicit, thin **kernel** that
every component may depend on and no component may bypass:

- **Identity** — profiles, auth, the ADR-0007 contact spine and `crm_resolve_contact` entry point.
- **RBAC** — roles, permissions, `view-as`, the `is_comms_team_or_admin()` family of policies.
- **Shell** — navigation and layout, composed **from the manifests of enabled components** (this is what
  makes "a platform with a subset of components" render correctly).
- **Notifications & activity** — `notify`, `activity_log`, `user_activity_events`.
- **AI client** — the Anthropic client, model routing (`lib/ai/models.ts`, `client.ts`), usage logging.
  Note: the AI *client* is kernel; AI *features* (meeting summary, org feed, intake structuring) belong
  to the component whose data they enrich.

The kernel is what a generated platform **always** includes. Components are what a generated platform
**selects**.

---

## 8. Initial Component Decomposition of Inspire2Live

Derived from the **live** surfaces reachable in `src/lib/role-access.ts` and the public routes (not from
table prefixes — see the §6 boundary note). The live nav exposes four in-app spaces — `/app/admin`,
`/app/comms`, `/app/dashboard`, `/app/initiatives` — plus the public `/stories` site and the congress
guest-attend flow. This is the starting cut; each table list is **re-verified against reachability when
its manifest is written**, and any table that survives only because Sprint 15 has not yet dropped it is
excluded.

| Component | Owns (tables, abbreviated) | Owns (lib, abbreviated) | Serves |
|---|---|---|---|
| **contacts** | `comms_crm_*`, `campus_members`, contact identity | `comms-crm*`, `comms-conference-contacts` | comms, all |
| **intake** | `intake_*`, WhatsApp webhook ingest | `comms-webhook*`, `comms-classifier`, `whatsapp-*` | comms |
| **content** | `content_calendar`, `media_assets`, `comms_integration_intents` | `comms-media`, `comms-integrations`, `comms-digest` | comms |
| **events** | `events`, `conferences`, `conference_*` (podcast + conference pipeline), `campus_sessions`, congress guest-attend | `comms-conferences`, `comms-events`, `campus-*`, `congress-guest-*` | comms |
| **initiatives** | `initiatives`, `milestones` | `initiative-*` | coordinators |
| **tasks** | `tasks`, `comms_tasks`, `member_onboarding_tasks`, `unified_tasks` view | `lib/tasks/*` (already modular) | all |
| **onboarding** | `member_onboarding*` | `member-onboarding` | comms |
| **stories** | `patient_stories`, `patient_story_events` (public patient-stories site) | `patient-stories` | public/advocates |
| **feedback** | `feedback_items` | `feedback` | all |
| **ai-features** | `ai_settings`, `ai_usage_log`, `org_feed*`, `meeting_*`, `news_feed_items` | `lib/ai/*` | all |

**Not components** (retired by Sprint 15, tables pending a forward-migration drop, referenced only by
admin cascade-cleanup): the **Network** space (`hubs`, `hub_*`), the **Resources** space (`resources`),
the internal **Annual Congress workspace** (`congress_topics/sessions/decisions/…` — distinct from the
kept guest-attend flow), **Bureau/Board**, and the internal editorial **Stories** workspace. These do not
get an owning component; they are Stage-2 drop candidates.

The **events** component is still intentionally heterogeneous (external conferences, podcast pipeline,
campus sessions, and the congress guest-attend surface have accreted separately). Writing its manifest is
expected to split it further — the useful, live boundary question, now that the retired internal congress
*workspace* is out of the picture.

---

## 9. Contract Rules That Keep Components Independent

Independence is a property you enforce, not one you hope for. Five rules:

1. **Import only through `index.ts`.** Enforced by an ESLint boundary rule generated from manifests. A
   PR that imports `@/modules/x/domain/...` from module `y` fails CI.
2. **Read across boundaries only through published `security_invoker` views.** No cross-schema raw table
   selects.
3. **Write across boundaries only through the owner's domain actions.** Side effects (RLS, revalidation,
   notifications, CRM logging) stay with the owner — the ADR-0008 adapter rule, generalized.
4. **No cross-component FKs except into the kernel identity spine.** Links between components resolve
   through identity or through views.
5. **Every component is feature-flaggable.** Each manifest declares a `featureFlag`; the shell mounts nav
   and routes only for enabled components. We already do this with `comms_team` and `lib/ai/feature-flag.ts`
   — generalize it so *absence* of a component is a first-class, working state, not a broken build. This
   rule is the one that literally makes "generate a platform with a subset of components" possible.

---

## 10. The Three AI Levels — and How the Structure Feeds Them

The payoff. Each future AI level consumes the **same manifests** this architecture produces.

### L1 — Collect user requirements (the wizard)

Reads the **component catalog** — every manifest's `summary`, `personas`, `provides`, `config`,
`requirements`. This catalog *is* the space of things the platform can be. The wizard maps a user's
natural-language needs onto a **platform blueprint**: which components to include, their config, the
persona→role map, branding, and which external connectors to wire. It can do this because each manifest
already states, in structured form, what a capability is and who it serves.

*Output:* a declarative blueprint, e.g.
`{ components: ['contacts', 'intake', 'content'], flags: {...}, roles: {...}, brand: {...} }`.

### L2 — Build platform (the generator)

Consumes the blueprint + the component library. Because each component is self-contained across all
three representations, building a platform is **composition, not authoring**:

- take each selected component's `db` (schema + migrations + RLS + views),
- mount its `ui` and `api` through the shell using the manifest,
- apply `config` and set `featureFlag`s,
- compose navigation from the enabled manifests,
- always include the kernel.

The current hardwired Inspire2Live platform becomes **one instance** of this generator — the reference
blueprint (`blueprints/inspire2live.json`). "Proving the generator" = regenerating today's platform from
its own blueprint and getting the same app.

### L3 — Operate platform (runtime AI)

Already seeded: the org news feed, intake classifier, meeting summarizer, and campus briefing are L3
operations living inside their components. The manifest's `operations` field lists the agents/operations
each component exposes. The operate-layer AI works **per component, through the same contracts** — it
invokes `intake.classify-inbound` or `content.suggest-schedule` without knowing their internals, exactly
as another component would.

**The through-line:** one artifact — the manifest — is read by humans today and by all three AI levels
tomorrow. We are not building three AI systems on top of a monolith; we are making the monolith
*legible*, and legibility is what every AI level needs.

---

## 11. Transition Ladder (Stage 0 → Stage 5)

A transition, not a rewrite. Each stage is independently valuable and shippable in the team's normal
sprint cadence.

| Stage | Name | What ships | DB change? |
|---|---|---|---|
| **0** | Hardwired (today) | One platform, flat lib, single `public` schema, informal prefixes | — |
| **1** | **Declare boundaries** | `manifest.ts` per component; move files into `src/modules/*`; kernel extracted; ESLint import-boundary rule from manifests; per-component requirement traceability | **None** |
| **2** | **Isolate the DB** | Prefix → per-component Postgres schema, one component at a time (lowest-risk first); published `security_invoker` views as read contracts; RLS per schema | Yes, incremental |
| **3** | **Composable shell** | Nav/routes composed from enabled manifests; every component genuinely optional (flag off = clean absence) | — |
| **4** | **Catalog + blueprint** | Machine-readable catalog of all manifests; a `blueprint` format; **regenerate I2L from its own blueprint**; hand-compose a second small platform to prove reuse | — |
| **5** | **AI levels** | L1 wizard over the catalog; L2 generator over blueprints; L3 operations formalized per manifest | — |

Stage 1 is mostly mechanical and reversible and unlocks the import-boundary check immediately — it is the
right content for the next sprint (see `sprints/sprint-16-modular-component-foundation/`). Nothing past
Stage 4 should start until Stage 4 has actually regenerated the current platform from a blueprint; the AI
levels are only as good as the composition they sit on.

---

## 12. What We Are Deliberately Not Doing Yet

- **No microservices, no per-component deploys.** Components are modular *within one Next.js app and one
  Postgres database*. Physical distribution is a non-goal; it would add operational cost with no benefit
  at current scale (ADR-0008's "god-table vs view" reasoning applies — pick the reversible, lower-risk
  option).
- **No big-bang schema migration.** Prefix → schema is per-component and only when it pays.
- **No new runtime framework.** The manifest is descriptive data, not an engine. The shell composing from
  manifests is the only new runtime behavior, and it generalizes the feature-flag mounting we already do.
- **No premature generalization of boundaries.** We write manifests for the components we have and let the
  act of writing them reveal the seams (e.g. events vs congress). We do not design for a second platform
  we cannot yet name.

---

## References

- ADR-0009 — Modular Component Architecture (the decision record for this concept)
- ADR-0008 — Unified Task Domain Layer (the seed pattern this generalizes)
- ADR-0007 — Unified Contact Identity (the kernel identity spine)
- ADR-0006 — Communications Workspace
- `docs/PLATFORM_CONCEPT_UPDATE_v1.md` — the concept this extends
- `docs/TRACEABILITY.md` — requirement traceability, now scoped per component
- `sprints/sprint-16-modular-component-foundation/` — Stage 1 delivery
