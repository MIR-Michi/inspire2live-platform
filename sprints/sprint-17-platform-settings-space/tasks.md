# Sprint 17 — Tasks

> Status values: `Not Started` · `In Progress` · `Completed` · `Blocked`.
> See `sprints/README.md` for the workflow. All tasks start `Not Started` (this sprint is a draft).

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S17-T01 | **IA re-root.** Stand up the `/app/settings` Platform Settings space + shell layout with a left section sub-nav (Access & Identity · Organization · Capabilities · Integrations · Automation · Observability). RBAC space id stays `admin`. | TBD | Not Started | Concept §4. Space label/surface only — no permission-matrix change. |
| S17-T02 | **Nav cleanup.** Replace master-nav "Account" section with a single admin-gated **Platform Settings** entry (`minLevel: 'manage'`); remove the AI/Org-Feed/Permissions header-button hub from the Users page. | TBD | Not Started | `src/kernel/rbac/role-access.ts`, `src/app/app/admin/users/page.tsx`. |
| S17-T03 | **Settings store + resolver.** Migration for kernel `platform_settings(scope, component_id, key, value jsonb, updated_by, updated_at)` + RLS (`manage` to write). Kernel `resolveSetting` / `resolveAllSettings` with precedence `manifest default → DB → env`. | TBD | Not Started | Concept §6. Mirrors `permissions.ts` precedence. Sprint's only migration. |
| S17-T04 | **Secret-reference pattern.** Generalise the `ai_settings` encrypted-credential pattern into a kernel secret-reference; ensure no plaintext secret is ever written to `platform_settings`; blueprint holds `{"ref":...}` only. | TBD | Not Started | Concept §6. Reuse `AI_SETTINGS_ENCRYPTION_KEY` path; no new crypto. |
| S17-T05 | **Manifest config vocabulary.** Extend `ComponentManifest.config` with typed field descriptors (`string·text·boolean·enum·number·cron·color·url·secret·email`) + optional `provides.settingsPanel`; enforce in `validate.ts`. | TBD | Not Started | `src/kernel/manifest/types.ts`, `validate.ts`. Concept §5. |
| S17-T06 | **Field renderers + Organization/Brand panel (kernel reference).** Shared renderer per field type; kernel Organization panel (name, logo, colours, timezone, locale) rendered from a kernel panel declaration, read/write via resolver. | TBD | Not Started | Concept §5, §7 #2. First reference panel. |
| S17-T07 | **Component config panel (component reference).** Render one component's settings entirely from its manifest `config` (candidate: **intake** — `classifier`, `channels`). Proves add-a-field → add-a-control with zero UI code. | TBD | Not Started | Concept §5. Second reference panel; template others copy. |
| S17-T08 | **Migrate existing surfaces in.** Move AI Settings, Org Feed, Permissions, User Activity under the settings shell as sections; internals untouched; imports/routes updated. | TBD | Not Started | `src/app/app/admin/{ai,org-feed,permissions,activity}`. Behaviour unchanged. |
| S17-T09 | **Move Feedback out.** Relocate the feedback admin surface from `/app/admin` to its component operational route (mirror the guest-submissions move). | TBD | Not Started | `src/modules/feedback`. No behaviour change. |
| S17-T10 | **Governance extension.** Add settings-ownership reconciliation (orphan setting fails), panel reachability (zombie panel fails), and an env-tunable lint; wire into `pnpm governance`. | TBD | Not Started | Concept §8; extends ADR-0009 §10 gates in `src/kernel/governance`. |
| S17-T11 | **Docs + traceability.** Author ADR-0010; record `REQ-SETTINGS-*`; update `docs/TRACEABILITY.md`, `docs/README.md`, `sprints/README.md`. | TBD | Not Started | Concept is `docs/PLATFORM_SETTINGS_CONCEPT.md` (already drafted). |
| S17-T12 | **Verification.** Typecheck, lint, unit+coverage, e2e green; smoke every migrated section + both reference panels; confirm no runtime behaviour change from the moves. | TBD | Not Started | Definition of Done per `docs/IMPLEMENTATION_GUIDE.md`. |

## Backlog unlocked by this sprint (not in scope — concept §7, §10 Step E/F)

| Ref | Item | Concept § |
|---|---|---|
| BL-01 | WhatsApp Cloud API settings panel | §7 #4 |
| BL-02 | Email / Resend sender settings panel | §7 #5 |
| BL-03 | Automation → Scheduled Jobs (cadences, classifier mode) | §7 #6 |
| BL-04 | Publishing connectors (WordPress/LinkedIn/Mailchimp/SharePoint) | §7 #7 |
| BL-05 | Role defaults / persona→role map as editable data | §7 #3 |
| BL-06 | Notification & email routing | §7 #8 |
| BL-07 | Data retention & privacy | §7 #9 |
| BL-08 | Localization (locale/timezone/currency) | §7 #10 |
| BL-09 | Auth / session policy (SSO, password, session TTL) | §7 #11 |
| BL-10 | Per-component AI operation toggles | §7 #12 |
| BL-11 | Audit export / retention config | §7 #13 |
| BL-12 | Blueprint export / import (converges with ADR-0009 Stage 4) | §7 #14, §10 Step F |
</content>
