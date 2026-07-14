# ADR-0010: Platform Settings Space (manifest-driven settings as the human blueprint editor)

- **Status:** proposed
- **Date:** 2026-07-14
- **Owners:** Michael Wittinger

## Context

Platform configuration works today but is mis-rooted and scattered. "User Management" (`/app/admin/users`)
has become the de-facto admin home: its page header carries buttons to *AI Settings*, *Org Feed*, and
*Permissions*, which are otherwise **not present in the nav at all** — a leaf capability (managing user
rows) is acting as the root of everything configurable. The master nav's only settings-ish grouping is an
"Account" section (Users, Activity, Feedback). Meanwhile genuinely related configuration is spread across
three incompatible homes: **env vars** (feature flags `NEXT_PUBLIC_FEATURE_*`, WhatsApp/Resend
credentials, app name — every change is a redeploy), **code constants** (`ROLE_SPACE_DEFAULTS`, job
cadences, classifier mode — not operable at all), and **one-off admin pages** (AI settings, org feed).
There has never been a concept for what "platform settings" *is*.

This matters beyond tidiness because of the stated midterm goal (ADR-0009): a **component toolbox** from
which an AI wizard generates *related* platforms. ADR-0009 already defines a platform as **kernel +
selected components**, each declaring in its `manifest.ts` a `featureFlag`, a typed `config`, its `roles`,
and its `personas`. That set — which components are on, how each is configured, the persona→role map, and
the brand — **is a platform blueprint** (ADR-0009 §11, the L1 output). A blueprint is exactly what an
administrator edits in a settings UI. So a settings space and the future AI generator are two faces of one
thing: both read component manifests for structure and write the same persisted configuration. Building
the settings layer **manifest-driven** now builds the blueprint store and config resolver a stage early,
de-risking ADR-0009 Stage 4 ("regenerate I2L from its own blueprint") while delivering immediate operator
value (toggle features without a redeploy).

We already have the seed patterns. `permissions.ts` layers DB overrides over code defaults with a clear
precedence — the settings resolver copies that shape. `ai_settings` already encrypts a credential at rest
(`AI_SETTINGS_ENCRYPTION_KEY`) and exposes only `api_key_last4` — the secret-reference pattern generalizes
from it. `manifest.config` already exists as `Record<string, unknown>` — this ADR types it, it does not
invent it.

- Related requirements: `REQ-SETTINGS-001` (single Platform Settings space re-rooting `/app/admin`),
  `REQ-SETTINGS-002` (kernel settings store + resolver with `manifest default → DB → env` precedence),
  `REQ-SETTINGS-003` (manifest-driven, self-rendering settings panels + settings governance).
- Full concept: `docs/PLATFORM_SETTINGS_CONCEPT.md`. Delivery: `sprints/sprint-17-platform-settings-space/`.

## Decision

Adopt a **first-class Platform Settings space** whose sections are **derived from component manifests plus
a fixed set of kernel panels**, backed by a **typed, audited settings store** whose resolver mirrors
`permissions.ts` precedence. Platform Settings is the human-facing editor of the platform blueprint the
L1/L2 AI levels will later write and apply — the same schema, the same store.

1. **Re-root `/app/admin` as one Platform Settings space** with a left section sub-nav. Sections map 1:1
   to the ADR-0009 kernel/component split: **kernel** — *Access & Identity* (Users, Roles & Permissions,
   Invitations), *Organization* (Profile & Brand), *Observability & Review*; **component** — *Capabilities*
   (module toggles + config), *Integrations* (AI, Org Feed, WhatsApp, Email, Publishing), *Automation*
   (jobs & cadences). The header-button hub on the Users page is removed; the master-nav "Account" section
   is replaced by a single admin-gated **Platform Settings** entry (`minLevel: 'manage'`). **The RBAC space
   id stays `admin`** — only the label, surface, and structure change, so there is no permission-matrix
   migration.

2. **A sharp settings/operations/account boundary.** Settings = configuration that changes how the
   platform behaves for everyone. Per-user preferences stay in *Account* (top-right menu). Externally-
   authored operational content stays with its component (guest-submissions already moved to
   `/app/comms/conferences/submissions`). **Feedback is kept in** the settings space under *Observability &
   Review* as an admin monitoring/review surface, alongside the read-only audit trail — a deliberate
   co-location for operator convenience, not a re-classification of feedback as configuration.

3. **A kernel settings store — the blueprint at rest.** One kernel-owned table
   `platform_settings(scope, component_id, key, value jsonb, updated_by, updated_at)`, non-secret values
   only, RLS restricting writes to `manage`. This is the seed of `blueprints/inspire2live.json`
   (ADR-0009 Stage 4). A kernel resolver `resolveSetting(scope, key)` / `resolveAllSettings()` resolves in
   the precedence **`manifest default → persisted platform setting → env override`**, mirroring
   `permissions.ts`. Env is demoted to **bootstrap + secrets only**; anything an operator should tune is
   DB-persisted and blueprint-portable.

4. **Secrets are referenced, never embedded.** Generalize the existing `ai_settings` encrypted-credential
   pattern into a kernel **secret-reference**: the blueprint/store holds `{"ref":"ai.anthropic"}`, and the
   plaintext lives only in the encrypted path. A blueprint is therefore shareable and regenerable across
   deployments **without leaking credentials** — a hard requirement for the toolbox. No new crypto is
   introduced; the `AI_SETTINGS_ENCRYPTION_KEY` path is reused.

5. **Settings panels render from declarations, not bespoke forms.** Extend `ComponentManifest.config` with
   a **typed field vocabulary** (`string · text · boolean · enum · number · cron · color · url · secret ·
   email`) and add an optional `settingsPanel` to `provides`. A small set of field renderers in the
   settings shell (one per type) turns a manifest's declared config into controls, so **adding a config
   field surfaces a control with zero settings-UI code**. The kernel contributes its fixed panels the same
   way. This is the identical mechanism the L2 generator uses to apply a blueprint — Platform Settings and
   the generator write to the same store through the same schema.

6. **Governance extends the ADR-0009 §10 reconciliation to configuration.** Three additional standing CI
   checks keep *exists = owned = reachable* true for settings: (a) **settings-ownership reconciliation** —
   every persisted key is claimed by exactly one manifest's declared `config` or a kernel panel, else it is
   an **orphan setting** and CI fails; (b) **panel reachability** — a component declaring editable `config`
   must expose a settings panel and vice-versa, else a **zombie panel**; (c) an **env-tunable lint** that
   flags new `process.env.*` reads for values that should be settings (env allow-listed to secrets +
   bootstrap). This prevents configuration from ever re-scattering into the exact junk-drawer state this
   ADR corrects.

7. **Staged as ADR-0009 "Stage 1.5."** It sits between Stage 1 (declared boundaries) and Stage 4 (catalog
   + blueprint), reuses the kernel/module foundation Sprint 16 shipped, and adds one table in `public` (no
   Stage-2 schema isolation). Sprint 17 delivers the IA re-root, the store + resolver, the manifest config
   vocabulary, two reference panels, the existing-page migrations, and the settings governance. Later steps
   (backlog panels; blueprint export/import) are deferred, but the store is shaped so export/import becomes
   a small step that converges with Stage 4.

## Alternatives considered

1. **Cosmetic nav tidy only.** Group the existing admin pages under a "Settings" menu and stop. Rejected:
   fixes the symptom (discoverability) but not the cause — configuration stays split across env, code
   constants, and one-off pages, and nothing prevents the next admin page from becoming another unowned
   surface. It also throws away the toolbox alignment that makes this worth doing now.

2. **Hand-build each settings screen.** Author a bespoke form per configurable area. Rejected: it does not
   scale (every new component needs new settings code), it drifts from the manifest, and it produces
   nothing the L1/L2 AI levels can consume. Manifest-driven panels are the same discipline ADR-0009 applied
   to data ownership, applied to configuration.

3. **Keep configuration in env / feature-flag service.** Continue configuring via env vars (and add a
   third-party flag service). Rejected: env changes require a redeploy, are invisible to operators, and are
   not blueprint-portable; a flag service adds a dependency and still leaves brand, roles, and connector
   config homeless. The one-table store + resolver is lower-cost and is exactly the blueprint-at-rest Stage
   4 needs.

4. **Build the full blueprint export/import + generator now.** Jump straight to Stage 4. Rejected: the
   generator is only as good as the composition layer under it; building the human settings editor first
   proves the store, resolver, and manifest config vocabulary against real admin use before any AI writes
   to them. Export/import is deferred but made cheap.

5. **Manifest-driven Platform Settings space + kernel store + staged transition (chosen).** Corrects the
   IA, unifies scattered configuration behind one typed store, and reuses proven patterns (`permissions.ts`
   precedence, `ai_settings` encryption, `manifest.config`) while building the toolbox composition layer a
   stage early — each step independently valuable and low-risk.

## Consequences

### Positive

- Configuration has one discoverable, permission-gated home; the "leaf as root" and hidden-behind-a-button
  problems are gone.
- Operators can finally tune the platform (feature flags, brand, connector config) **without a redeploy**.
- Settings structure is derived from manifests, so adding a component adds its settings panel for free —
  the same legibility ADR-0009 buys, extended to configuration.
- The settings store + resolver are precisely the blueprint-at-rest and config-resolution machinery Stage 4
  needs; this sprint de-risks the toolbox transition instead of diverging from it.
- Settings governance makes re-scattering a build failure, not a future cleanup — the same anti-pollution
  invariant as ADR-0009 §10.
- Secret-reference separation lets blueprints move between deployments without carrying credentials.

### Negative / trade-offs

- Up-front discipline: every tunable must be declared in a manifest/kernel panel and moved off env/constants;
  the migration touches many `process.env.*` and constant reads.
- The manifest gains a second responsibility (settings schema) that must stay in sync with behaviour; the
  ownership/reachability checks mitigate drift by deriving from it.
- One new table and a new resolver path add a small amount of runtime surface (mitigated by mirroring the
  well-worn `permissions.ts` shape).
- Keeping Feedback in the settings space softens the pure settings/operations boundary; accepted as an
  explicit, documented exception for operator convenience.

### When to revisit

If a component ever needs configuration that cannot be expressed as typed manifest fields (e.g. a rich,
stateful editor), give it a bespoke surface reachable from its settings section rather than forcing it into
the field vocabulary — the panel declaration already allows a custom surface. If blueprint export/import
(Stage 4) reveals the store shape is wrong, change it then, while the only writer is the human UI.

## Rollout / Migration plan

**Sprint 17 (`sprint-17-platform-settings-space`, one table in `public`):**
1. Stand up `/app/settings` with the section sub-nav; replace the nav "Account" section with a single
   Platform Settings entry; remove the Users-page header-button hub. (RBAC space id stays `admin`.)
2. Add the `platform_settings` table + kernel resolver (`manifest default → DB → env`), audited writes,
   `manage` RLS; generalize the `ai_settings` secret-reference pattern.
3. Extend the manifest type with the typed `config` field vocabulary + `settingsPanel`; enforce in
   `validate.ts`.
4. Build the shared field renderers and **two reference panels** — Organization/Brand (kernel) and one
   component config panel (candidate: **intake**, whose manifest already declares `classifier`/`channels`).
5. Migrate AI Settings, Org Feed, Permissions, and User Activity into the shell as sections (behaviour
   unchanged); re-home Feedback under *Observability & Review* (kept in).
6. Extend governance: settings-ownership reconciliation, panel reachability, env-tunable lint; wire into
   `pnpm governance`.
7. Record `REQ-SETTINGS-*` in `docs/TRACEABILITY.md`; update `docs/README.md` and `sprints/README.md`.

**Backlog (unlocked, later):** WhatsApp/Email/Automation/Publishing/retention/i18n/SSO panels; role
defaults migrated from code to editable data; per-component AI operation toggles; **blueprint export/import**
(converges with ADR-0009 Stage 4).

## References

- Concept: `docs/PLATFORM_SETTINGS_CONCEPT.md`
- Composition model this edits: ADR-0009 (modular component architecture), `docs/MODULAR_COMPONENT_ARCHITECTURE.md`
- Seed patterns: `src/kernel/rbac/permissions.ts` (resolver precedence), `ai_settings` (secret-at-rest), `src/kernel/manifest/types.ts` (`manifest.config`)
- Access model: ADR-0004, `docs/ROLE_PERMISSION_MODEL.md`
- Delivery: `sprints/sprint-17-platform-settings-space/`
</content>
