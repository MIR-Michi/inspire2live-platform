# Platform Settings — Concept

**From an accidental "User Management" hub to a first-class Platform Settings space**
**Extension to `docs/MODULAR_COMPONENT_ARCHITECTURE.md` (ADR-0009)**
**July 2026**

*This document defines the concept for a dedicated **Platform Settings** space. Today, platform
configuration is scattered and mis-rooted: "User Management" has quietly become the overarching admin
layer, with everything else hung off it. This concept re-roots the information architecture, defines
what belongs in settings (and what does not), inventories what **should** be configurable but is not yet,
and — critically — aligns the whole thing with the modular toolbox future so that Platform Settings
becomes the **human-facing editor of the platform blueprint** the AI wizard will later write. It defines
structure, contracts, and a staged path. It does **not** implement anything; the delivery is drafted as
`sprints/sprint-17-platform-settings-space/`.*

---

## Table of Contents

1. [Why This Exists — the Current Confusion](#1-why-this-exists--the-current-confusion)
2. [The Core Principle: Settings Is the Blueprint, Made Human](#2-the-core-principle-settings-is-the-blueprint-made-human)
3. [What Belongs in Settings — and What Does Not](#3-what-belongs-in-settings--and-what-does-not)
4. [Target Information Architecture](#4-target-information-architecture)
5. [Manifest-Driven Settings — the Toolbox Bridge](#5-manifest-driven-settings--the-toolbox-bridge)
6. [The Settings Persistence Layer — the Blueprint at Rest](#6-the-settings-persistence-layer--the-blueprint-at-rest)
7. [Configuration Investigation — What Should Be Configurable but Is Not Yet](#7-configuration-investigation--what-should-be-configurable-but-is-not-yet)
8. [Governance — Settings Cannot Become the Next Mess](#8-governance--settings-cannot-become-the-next-mess)
9. [How This Feeds the Three AI Levels](#9-how-this-feeds-the-three-ai-levels)
10. [Transition Ladder](#10-transition-ladder)
11. [What We Are Deliberately Not Doing Yet](#11-what-we-are-deliberately-not-doing-yet)

---

## 1. Why This Exists — the Current Confusion

Configuration surfaces today are real and functional, but their **arrangement** is wrong. Three symptoms:

- **The overarching layer is a leaf.** `/app/admin/users` ("User Management") has become the de-facto
  admin home. Its page header carries buttons to *AI Settings*, *Org Feed*, and *Permissions*
  (`src/app/app/admin/users/page.tsx`). A leaf capability (managing user rows) is acting as the root of
  everything configurable. Even the permissions page's error state links "← Back to User Management" as
  if that were home.
- **The nav under-exposes settings.** The master nav's only settings-ish grouping is an **"Account"**
  section holding *User Management*, *User Activity*, *Feedback* (`src/kernel/rbac/role-access.ts`).
  *Permissions*, *AI Settings*, and *Org Feed* are **not in the nav at all** — they are reachable only by
  first landing on User Management and clicking a header button. Configuration is effectively hidden.
- **Unlike things are lumped together; like things are split apart.** Identity/access (users,
  permissions), platform configuration (AI credentials, org feed, feature flags), and operational queues
  (feedback triage, guest submissions) all live under one flat `/app/admin/*` with no organizing spine —
  while genuinely related settings (e.g. every external-integration credential) are scattered across env
  files, code constants, and one-off admin pages.

The root cause is that the platform grew capability-first: each admin need got a page next to the last
one. There has never been a *concept* for what "platform settings" **is**. This document supplies one —
and does it in a way that pays forward into the toolbox, rather than as cosmetic nav tidying.

> **Note — the direction is already emerging.** `guest-submissions` now redirects out of `/app/admin`
> into its component surface (`/app/comms/conferences/submissions`), and the modular architecture
> (ADR-0009) already splits *kernel* from *components*. This concept names and completes a move the
> codebase has started organically.

---

## 2. The Core Principle: Settings Is the Blueprint, Made Human

The single idea that makes this more than a nav refactor:

> **Platform Settings is the human-facing editor of the same platform blueprint the L1 AI wizard will
> write and the L2 generator will apply.**

ADR-0009 already establishes that a platform is defined by:

- the **kernel** (always included: identity, RBAC, shell, notifications, AI client), and
- a selected set of **components**, each declaring in its `manifest.ts` a `featureFlag`, a typed
  `config`, its `roles`, and its `personas`.

A "platform blueprint" is precisely *which components are on, how each is configured, the persona→role
map, and the brand* (ADR-0009 §11, L1 output). **That blueprint is exactly what an administrator edits in
a settings UI.** So Platform Settings and the future AI generator are two faces of one thing:

| | Reads | Writes |
|---|---|---|
| **Platform Settings (now)** | manifests (for structure) + persisted config | persisted config (the live blueprint) |
| **L1 wizard (later)** | manifest catalog | a proposed blueprint |
| **L2 generator (later)** | blueprint + component library | a running platform |

Building Platform Settings **manifest-driven** now means we are building the blueprint store and the
config-resolution machinery early — the exact substrate Stage 4 ("regenerate I2L from its own blueprint")
needs. Done right, this sprint is not a detour from the toolbox roadmap; it is Stage 1.5 of it.

The design rule that follows: **do not hand-build settings screens.** A settings section is *rendered from
a manifest's declared config*. Add a component → its settings panel appears. This is the same discipline
ADR-0009 applied to data ownership, applied now to configuration.

---

## 3. What Belongs in Settings — and What Does Not

A sharp boundary prevents Platform Settings from re-accreting into the same junk drawer:

**Settings = configuration that changes how the platform behaves for everyone.** It is durable, low-
frequency, admin-authored, and (mostly) blueprint-portable.

**NOT settings:**

- **Operational work queues** — feedback triage, guest-submission review. These are *daily work on
  content*, not configuration. They belong to the owning component's operational surface. (Guest
  submissions already moved; **feedback should follow** — out of `/app/admin`, into its component.)
- **The audit trail of what others did** — user activity is *observability*, not a knob. It stays
  admin-only and read-only, but it lives in an **Observability** section of settings, clearly separated
  from anything editable (it configures nothing; it reports).
- **Per-user preferences** — a user's own profile, notification opt-ins, theme. These are *account*
  settings (top-right menu), not *platform* settings. Platform Settings is org-wide and admin-gated.
- **Secrets, as values** — API keys are *referenced and rotated* in settings, but their plaintext lives
  encrypted and never enters the portable blueprint (see §6).

This yields a clean three-way split the rest of the document builds on: **Platform Settings** (config) ·
**Component operations** (work queues) · **Account** (self).

---

## 4. Target Information Architecture

Re-root `/app/admin` as a single **Platform Settings** space with a left sub-nav. The RBAC space id stays
`admin` (no permission migration; continuity with `ROLE_SPACE_DEFAULTS` and middleware); only the **label,
surface, and structure** change. Every section is gated at `minLevel: 'manage'`.

```
Platform Settings   (/app/settings — space id: admin, label: "Platform Settings")
│
├── Access & Identity            ← kernel: identity + rbac
│   ├── Users              (today /app/admin/users — the current "User Management")
│   ├── Roles & Permissions (today /app/admin/permissions — role defaults + per-user overrides)
│   └── Invitations        (extracted from Users; pending invites, resend)
│
├── Organization                 ← kernel: shell/brand
│   └── Profile & Brand    (NEW: name, logo, colours, timezone, locale, contact — today env-only)
│
├── Capabilities                 ← the composition layer (manifest featureFlag + config)
│   └── Modules            (NEW: enable/disable components + per-component config — today env-only)
│
├── Integrations                 ← per-component credentials & connectors
│   ├── AI / Claude        (today /app/admin/ai)
│   ├── Organization Feed  (today /app/admin/org-feed)
│   ├── WhatsApp           (NEW panel: today env-only)
│   ├── Email (Resend)     (NEW panel: today env-only)
│   └── Publishing         (NEW placeholder: WordPress/LinkedIn/Mailchimp/SharePoint — planned)
│
├── Automation                   ← jobs & cadences
│   └── Scheduled Jobs     (NEW: digest cadence, feed refresh, classifier mode — today hardcoded)
│
└── Observability                ← read-only, configures nothing
    ├── User Activity     (today /app/admin/activity)
    ├── AI Usage          (surfaced from ai_usage_log)
    └── Platform Health   (governance reconciliation status + version/changelog)

Moved OUT of settings:
  • Feedback  → component operational surface (out of /app/admin "Account")
  • Guest submissions → already moved to /app/comms/conferences/submissions
```

**Nav change:** the master-nav "Account" section is replaced by a single **Platform Settings** entry
(admin-gated) that opens the settings shell; the shell renders the section sub-nav. This removes the
header-button hub anti-pattern entirely — every section is a real, linkable, permission-gated route.

**Section grouping maps 1:1 to the ADR-0009 kernel/component split:** *Access & Identity*,
*Organization*, *Observability* are **kernel** settings; *Capabilities*, *Integrations*, *Automation* are
**component** settings composed from manifests. That correspondence is what makes the IA
regeneration-safe: a generated platform's settings tree *is* its enabled manifests plus the fixed kernel
sections.

---

## 5. Manifest-Driven Settings — the Toolbox Bridge

Settings structure is **derived**, not authored. Two mechanisms:

### 5.1 Extend the manifest config vocabulary

`ComponentManifest.config` already exists (`src/kernel/manifest/types.ts`) as
`Record<string, unknown>`. Give it a **typed field vocabulary** so a panel can render itself:

```ts
// illustrative — the manifest declares its settings shape
config: {
  classifier:  { type: 'enum',   options: ['rules','ai','hybrid'], default: 'hybrid', label: 'Classifier mode' },
  digestCadence:{ type: 'cron',  default: '0 7 * * 1',            label: 'Weekly digest' },
  senderName:  { type: 'string', default: 'Inspire2Live',        label: 'From name' },
  apiKey:      { type: 'secret', scope: 'component',             label: 'API key' },  // never in blueprint
  brandColor:  { type: 'color',  default: '#...',                label: 'Accent' },
}
```

Field types: `string · text · boolean · enum · number · cron · color · url · secret · email`. Each type
has one renderer in the settings shell. **Adding a config field to a manifest makes a new control appear
in that component's settings panel — with zero settings-UI code.**

### 5.2 A declared settings surface

Add an optional `settingsPanel` to `provides` (or a `surface: 'settings'` marker) so the reachability
governance check (ADR-0009 §10) can assert: *a component that declares editable `config` must expose a
settings panel, and vice-versa.* This closes the loop — no orphan config, no zombie panel.

The kernel contributes its own fixed panels (Users, Permissions, Organization, Observability) the same
way, so the whole settings tree is uniformly manifest/kernel-declared. **This is the identical mechanism
the L2 generator uses to apply a blueprint** — Platform Settings and the generator write to the *same*
config store through the *same* typed schema. We build the human editor now and harvest the generator
later, exactly as ADR-0009 does with the manifest itself.

---

## 6. The Settings Persistence Layer — the Blueprint at Rest

Introduce a kernel-owned, typed, **versioned and audited** settings store — the seed of
`blueprints/inspire2live.json` (ADR-0009 Stage 4).

**Shape (target):** one row per `(scope, component_id, key)`:

- `scope` — `kernel` | `component`
- `component_id` — null for kernel, else the manifest `id`
- `key`, `value` (JSON), `updated_by`, `updated_at`
- non-secret only; secrets go to the existing encrypted path (see below)

**Resolution order (mirrors `permissions.ts` precedence):**

```
manifest default   →   persisted platform setting (DB)   →   env override (bootstrap/secret only)
```

Env stops being the source of truth for anything an operator should tune. Env becomes **bootstrap +
secrets only**; everything blueprint-portable is DB-persisted. (This is the same move ADR-0008 made for
tasks: convention/config in code, physical/authoritative store centralised.)

**Secrets split (already half-built).** `ai_settings` already stores an encrypted credential with
`api_key_last4` shown and `AI_SETTINGS_ENCRYPTION_KEY` protecting it at rest. Generalise this into a
kernel **secret-reference** pattern: the blueprint holds a *reference* (`"apiKey": {"ref":"ai.anthropic"}`),
never the value. A blueprint is therefore **shareable and regenerable without leaking credentials** — a
hard requirement for the toolbox future where blueprints move between deployments.

**Why build the store now:** Stage 4 needs a place the blueprint lives at rest and a resolver that reads
it. Building Platform Settings *is* building that store and resolver, a sprint early and with immediate
standalone value (admins can finally toggle things without a redeploy).

---

## 7. Configuration Investigation — What Should Be Configurable but Is Not Yet

Requested explicitly. Below is the gap list: things currently **hardcoded, env-only, or code-constant**
that should become first-class settings. Prioritised; the sprint delivers the machinery + the top items,
the rest are the backlog it unlocks.

| # | Setting | Today | Target section | Priority | Toolbox relevance |
|---|---|---|---|---|---|
| 1 | **Capability toggles / feature flags** | `NEXT_PUBLIC_FEATURE_*` env, redeploy to change | Capabilities → Modules | **P0** | *This is the blueprint's component list.* The single most toolbox-relevant surface. |
| 2 | **Organization profile & brand** | `NEXT_PUBLIC_APP_NAME` env; no logo/colours/timezone/locale | Organization → Profile & Brand | **P0** | The `brand` field of an L1 blueprint; per-generated-platform identity. |
| 3 | **Role defaults / persona→role map** | `ROLE_SPACE_DEFAULTS` is a code constant; only *per-user overrides* are editable | Access & Identity → Roles & Permissions | **P1** | The persona→role map L1 must set per platform. Make role defaults **data**, not code. |
| 4 | **WhatsApp Cloud API** | env only (`WHATSAPP_*`), no UI | Integrations → WhatsApp | P1 | Per-deployment connector config + secret-reference. |
| 5 | **Email / Resend sender** | env only; no from-name/address/footer | Integrations → Email | P1 | Connector config; branded sender is part of platform identity. |
| 6 | **Job cadences & modes** | hardcoded (digest schedule, feed refresh interval, classifier `rules/ai/hybrid`) | Automation → Scheduled Jobs | P1 | Manifest `config` already *hints* these (e.g. intake `classifier`); surface them. |
| 7 | **Publishing connectors** | planned (WordPress/LinkedIn/Mailchimp/SharePoint), no config surface | Integrations → Publishing | P2 | Connector catalog the wizard wires per platform. |
| 8 | **Notification & email routing** | none platform-level | Automation / Organization | P2 | Which events notify whom; digest opt-ins at org level. |
| 9 | **Data retention & privacy** | none (activity log grows unbounded; no PII policy knob) | Observability | P2 | Compliance posture per deployment; GDPR-relevant for EU orgs. |
| 10 | **Localization** | none (no locale/timezone/currency) | Organization | P2 | A *related* platform in another region needs this; blueprint locale. |
| 11 | **Auth / session policy** | Supabase-managed, no surface (SSO, password policy, session TTL) | Access & Identity | P3 | Per-deployment identity provider config. |
| 12 | **Per-component AI operations** | AI *model/workload* policy exists; which L3 `operations` are enabled is not surfaced | Integrations → AI, per component | P3 | Manifest `operations` gating — the L3 operate layer's on/off switches. |
| 13 | **Audit export / retention config** | activity page is view-only; no export/retention settings | Observability | P3 | Compliance + portability. |
| 14 | **Blueprint export / import** | none | (cross-cutting) | P3 | The Stage-4 deliverable; explicitly deferred, but the store built here makes it a small step. |

**Reading of the gap:** the platform's configuration is currently split between *env* (operationally
rigid — every change is a redeploy) and *code constants* (not operable at all). The highest-value moves
are **#1 (feature flags → toggles)** and **#2 (brand)** because they are (a) the most-requested operator
capabilities and (b) the literal content of an L1 blueprint. Everything else is the backlog that the
settings machinery, once built, makes cheap.

---

## 8. Governance — Settings Cannot Become the Next Mess

The whole point is to *stop* configuration from scattering. Reuse the ADR-0009 §10 reconciliation model,
extended to settings, so the fix is enforced, not hoped for:

1. **Settings-ownership reconciliation.** Every persisted setting key must be claimed by exactly one
   manifest's declared `config` (or a kernel-declared panel). A persisted key no manifest claims → an
   **orphan setting** → CI fails (same shape as the table-ownership check). This is what prevents "one
   more admin page" from ever again becoming an unowned surface.
2. **Panel reachability.** A component declaring editable `config` must expose a settings panel; a panel
   with no declared config is a **zombie**. Extends the existing reachability gate.
3. **No env fallback for tunables.** A lint/check that flags new `process.env.*` reads for values that
   should be settings (allow-list env to secrets + bootstrap). Keeps env from silently reclaiming
   authority.

Governance = **exists = owned = reachable**, now applied to configuration as well as to tables and files.

---

## 9. How This Feeds the Three AI Levels

Same through-line as ADR-0009 §11 — one artifact, read by humans now and AI later:

- **L1 (collect requirements / wizard):** reads each manifest's typed `config`, `personas`, `featureFlag`
  — the exact schema the settings panels render — and *proposes* values. The wizard is Platform Settings
  with a natural-language front-end.
- **L2 (build platform / generator):** writes the blueprint into the **same settings store** this concept
  builds, through the **same resolver**. "Regenerate I2L from its blueprint" (Stage 4) becomes: export
  current settings → blueprint → re-apply → identical platform. The store built here is the thing that
  makes that testable.
- **L3 (operate platform / runtime AI):** the manifest `operations` gated by settings (#12) become the
  operate layer's on/off and policy surface — an admin (or the AI itself) tunes L3 behaviour through the
  same settings machinery.

**We are not building a settings feature and separately building the toolbox. The settings feature *is*
the toolbox's composition layer, given a human UI first.**

---

## 10. Transition Ladder

Aligned to the ADR-0009 stages; this concept lives between Stage 1 (declared boundaries) and Stage 4
(catalog + blueprint), so we label it **Stage 1.5**.

| Step | What ships | DB change? |
|---|---|---|
| **A — Re-root the IA** | Introduce Platform Settings space; move Users/Permissions/AI/Org-Feed/Activity in as sections; drop the header-button hub; move Feedback out. Behaviour of moved pages unchanged. | None |
| **B — Settings store + resolver** | Kernel `platform_settings` store; typed resolver (manifest default → DB → env); audited writes; secret-reference pattern generalised from `ai_settings`. | Yes (1 table) |
| **C — Manifest config vocabulary** | Typed `config` field types + `settingsPanel` surface in the manifest type; governance checks extended (§8). | None |
| **D — Two reference panels** | Organization/Brand (kernel) + one component config panel rendered *entirely from manifest*, proving the pattern (feedback-as-reference, repeated for settings). | None |
| **E — Backlog panels** | WhatsApp, Email, Automation, Publishing, retention, i18n, SSO — each a cheap manifest-declared panel. | per-panel |
| **F — Blueprint export/import** | Export settings → blueprint JSON; re-apply. Converges with ADR-0009 Stage 4. | None |

**Steps A–D are the drafted Sprint 17.** E is backlog; F is deferred to Stage 4.

---

## 11. What We Are Deliberately Not Doing Yet

- **No big-bang panel build.** Sprint 17 ships the *machinery* + two reference panels + the IA re-root and
  page migrations. WhatsApp/email/connector/cron/i18n/SSO panels are backlog (Step E), each cheap once the
  machinery exists.
- **No blueprint export/import yet.** That is Stage 4 (Step F); this concept only ensures the store is
  shaped so it becomes a small step, not a rebuild.
- **No RBAC space migration.** The space id stays `admin`; only label/surface/structure change. Zero
  permission-matrix risk.
- **No new runtime framework.** Settings panels render from descriptive manifest data via a small set of
  field renderers — the manifest stays descriptive, exactly as ADR-0009 insists.
- **No change to secret handling at rest.** We generalise the existing `ai_settings` encryption pattern;
  we do not invent new crypto.

---

## References

- ADR-0010 — Platform Settings Space (decision record for this concept — to be authored with the sprint)
- ADR-0009 — Modular Component Architecture (the composition model this settings layer edits)
- ADR-0008 — Unified Task Domain Layer (the "config in code, authoritative store centralised" seed)
- ADR-0004 — Role Model Design; `docs/ROLE_PERMISSION_MODEL.md` — the access matrix this re-homes
- `docs/MODULAR_COMPONENT_ARCHITECTURE.md` — kernel/component split, manifest, governance, AI levels
- `src/kernel/manifest/types.ts` — the manifest type this concept extends
- `src/kernel/rbac/permissions.ts`, `role-access.ts` — current nav + access model
- `sprints/sprint-17-platform-settings-space/` — the drafted delivery
</content>
</invoke>
