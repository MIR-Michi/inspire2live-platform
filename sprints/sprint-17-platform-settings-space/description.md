# Sprint 17 — Platform Settings Space (Stage 1.5)

> **Status:** Not Started
> **Theme:** Re-root platform configuration under a first-class **Platform Settings** space, and build the
> manifest-driven settings machinery that doubles as the composition/blueprint layer for the modular
> toolbox future.
> **Depends on:** ADR-0009 (modular component architecture) and its Sprint 16 kernel/module foundation;
> ADR-0008 (centralised authoritative store pattern); ADR-0004 (role model).
> **Concept:** `docs/PLATFORM_SETTINGS_CONCEPT.md`

## Goal

Turn the accidental "User Management" admin hub into an intentional **Platform Settings** space, and do it
so the settings layer *is* the human-facing editor of the platform blueprint (ADR-0009 §11). Shipping this
sprint produces:

1. **A Platform Settings space** — `/app/settings` (RBAC space id stays `admin`), with a left sub-nav and
   sections mapped 1:1 to the kernel/component split: *Access & Identity*, *Organization*, *Capabilities*,
   *Integrations*, *Automation*, *Observability*. The nav "Account" section and the User-Management
   header-button hub are both removed.
2. **A settings persistence layer** — a kernel-owned, typed, audited `platform_settings` store, with a
   resolver whose precedence is `manifest default → DB → env` (env demoted to bootstrap + secrets). The
   seed of `blueprints/inspire2live.json` (ADR-0009 Stage 4).
3. **A manifest config vocabulary** — typed `config` field types (`string · boolean · enum · number ·
   cron · color · url · secret · email`) plus a declared `settingsPanel` surface, so a settings control is
   *rendered from the manifest*, not hand-coded.
4. **Two reference settings panels** rendered end-to-end from that machinery — **Organization/Brand**
   (kernel) and **one component config panel** — the way `feedback` was the reference component in Sprint 16.
5. **Migrated existing surfaces** — AI Settings, Org Feed, Permissions, User Activity, and **Feedback**
   move into / stay within the settings shell as sections with **no behaviour change**. Feedback is
   **kept in** under *Observability & Review*; only guest-submissions (external-authored content) remains
   in its component, and it already moved there.
6. **Extended governance** — settings-ownership reconciliation + panel reachability added to the ADR-0009
   §10 CI gates, so orphan settings and zombie panels fail the build.
7. **Docs + traceability** — ADR-0010, `REQ-SETTINGS-*`, updated `docs/TRACEABILITY.md`, `docs/README.md`,
   and `sprints/README.md`.

Every existing page's *behaviour* is preserved; this sprint changes where configuration lives and how new
configuration is declared, not what the current pages do.

## Rationale

- **The overarching layer is a leaf.** `/app/admin/users` acts as the admin home, with AI Settings, Org
  Feed, and Permissions reachable only via its header buttons; Permissions/AI/Org-Feed are absent from the
  nav entirely (`src/kernel/rbac/role-access.ts`, `src/app/app/admin/users/page.tsx`). Configuration is
  effectively hidden behind a user-list page.
- **Settings has never had a concept.** The platform grew capability-first; each admin need got a page next
  to the last. `docs/PLATFORM_SETTINGS_CONCEPT.md` supplies the missing organizing principle.
- **The toolbox needs exactly this substrate.** ADR-0009 defines a platform as kernel + selected
  components, each with a manifest `featureFlag`/`config`/`roles`/`personas`. That *is* a blueprint, and a
  blueprint is what an admin edits in settings. Building settings **manifest-driven** now builds the
  blueprint store and config resolver a stage early — de-risking Stage 4 ("regenerate I2L from its own
  blueprint") while delivering standalone operator value (toggle features without a redeploy).
- **We are generalising patterns already in the codebase.** `ai_settings` already encrypts a credential and
  shows `api_key_last4` — the secret-reference pattern generalises from it. `permissions.ts` already layers
  DB overrides over code defaults — the settings resolver copies that precedence shape. `manifest.config`
  already exists — we type it, we do not invent it.
- **Sequenced after Sprint 16** so the kernel/module split and manifests exist to hang settings off, and
  before any Stage-2 DB isolation, so the one new table lands in `public` like everything else.

## Technical approach

**One new table, kernel-owned.** `platform_settings(scope, component_id, key, value jsonb, updated_by,
updated_at)`, non-secret values only, RLS admin-manage. Secrets continue through the encrypted
`ai_settings`-style path, generalised into a kernel secret-reference (`{"ref":"ai.anthropic"}`) so the
portable blueprint never contains plaintext. This is the sprint's only migration.

**Resolver (kernel).** `resolveSetting(scope, key)` with precedence `manifest default → platform_settings →
env`, mirroring `permissions.ts`. A batch `resolveAllSettings()` for the settings shell. Env reads for
tunables are migrated to go through the resolver; env stays authoritative only for bootstrap + secrets.

**Manifest extension (kernel/manifest).** Add typed field descriptors to `config` and an optional
`settingsPanel` to `provides` in `src/kernel/manifest/types.ts` + `validate.ts`. A small set of field
renderers in the settings shell (one per type). Adding a config field to a manifest surfaces a control with
zero settings-UI code.

**Settings shell (kernel/shell).** `/app/settings` layout with left section sub-nav; each section renders
either a kernel panel (Users, Roles & Permissions, Organization, Observability) or component panels
composed from enabled manifests. Existing pages are moved under the shell as routes, imports updated; their
internals are untouched. App routes stay thin (ADR-0009).

**Nav (kernel/rbac).** Replace the master-nav "Account" section with a single admin-gated **Platform
Settings** entry; delete the header-button hub from the users page. `minLevel: 'manage'` on the entry.

**Reference panels.** Organization/Brand (kernel: name, logo, colours, timezone, locale) and one component
config panel (candidate: **intake** — its manifest already declares `classifier` + `channels`) rendered
fully from manifest data, proving the pattern the other panels copy.

**Governance (kernel/governance).** Extend the §10 reconciliation: (1) every persisted settings key is
claimed by a manifest/kernel panel or fails CI (orphan); (2) a component declaring editable `config` exposes
a panel and vice-versa (zombie); (3) a lint flag for new `process.env.*` reads of tunables. Wired into
`pnpm governance`.

**Feedback kept in.** The `feedback` admin surface stays within the settings space, re-homed under
*Observability & Review* alongside User Activity; no feedback behaviour change. (Guest-submissions —
external-authored content — remains in its component, already moved.)

## Acceptance criteria

- [ ] `/app/settings` exists as the Platform Settings space (space id `admin`, label "Platform Settings")
      with the six sections and a left sub-nav; nav "Account" section removed; the User-Management
      header-button hub removed. _(S17-T01, T02)_
- [ ] `platform_settings` table + kernel resolver exist; precedence is `manifest default → DB → env`; writes
      are audited (`updated_by`/`updated_at`); RLS restricts writes to `manage`. _(S17-T03)_
- [ ] Secrets use the generalised secret-reference pattern; no plaintext secret is persisted in
      `platform_settings`; `ai_settings` encryption path unchanged and reused. _(S17-T04)_
- [ ] `ComponentManifest.config` supports the typed field vocabulary and an optional `settingsPanel`
      surface; `validate.ts` enforces it. _(S17-T05)_
- [ ] Two reference panels — **Organization/Brand** and one **component config** panel — render entirely
      from manifest/kernel declarations, read and write through the resolver, and require zero bespoke
      form code beyond the shared field renderers. _(S17-T06, T07)_
- [ ] AI Settings, Org Feed, Permissions, and User Activity are reachable as sections inside the settings
      shell with **no behaviour change** (existing tests green). _(S17-T08)_
- [ ] **Feedback** remains reachable within the settings space under *Observability & Review*; feedback
      behaviour unchanged. _(S17-T09)_
- [ ] Governance extended and green in CI: settings-ownership reconciliation (orphan setting fails), panel
      reachability (zombie panel fails), env-tunable lint. `pnpm governance` covers them. _(S17-T10)_
- [ ] `docs/PLATFORM_SETTINGS_CONCEPT.md` referenced; ADR-0010 authored; `REQ-SETTINGS-00{1..n}` recorded in
      `docs/TRACEABILITY.md`; `docs/README.md` + `sprints/README.md` updated. _(S17-T11)_
- [ ] Typecheck, lint, unit+coverage, and e2e suites pass; no runtime behaviour change from the moves.
      _(S17-T12)_

## Out of scope (later steps / backlog)

- **Backlog settings panels** — WhatsApp, Email/Resend, Automation cadences, Publishing connectors, data
  retention, localization, auth/session policy, per-component AI operation toggles (concept §7 items #4–13).
  Each is a cheap manifest-declared panel once the machinery ships.
- **Blueprint export/import** (concept §10 Step F) — converges with ADR-0009 Stage 4; deferred, but the
  store is shaped so it becomes a small step.
- **Making role defaults editable data** (concept §7 #3) — the resolver + store enable it; the migration of
  `ROLE_SPACE_DEFAULTS` from code to data is a follow-up.
- **Any DB isolation** (prefix→schema) — remains ADR-0009 Stage 2.

## References

- Concept: `docs/PLATFORM_SETTINGS_CONCEPT.md`
- Architecture: `docs/MODULAR_COMPONENT_ARCHITECTURE.md`, ADR-0009
- Decision: ADR-0010 — Platform Settings Space (to be authored in this sprint)
- Seed patterns: ADR-0008 (centralised authoritative store), `ai_settings` (secret-at-rest)
- Access model: `docs/ROLE_PERMISSION_MODEL.md`, ADR-0004
- Conventions: `docs/IMPLEMENTATION_GUIDE.md`, `sprints/README.md`
</content>
