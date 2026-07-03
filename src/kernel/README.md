# `src/kernel` — the platform kernel

Cross-cutting concerns every component may depend on and **no component owns**
(ADR-0009 §7). A generated platform always includes the kernel; components are
selected. Import the specific sub-area (`@/kernel/rbac`, `@/kernel/data`, …), not
another component's internals.

## Sub-areas

| Area | What it holds |
|---|---|
| `manifest/` | The `ComponentManifest` contract type + runtime validator (S16-T01). |
| `identity/` | Auth/identity primitives. The canonical *contact* spine (ADR-0007) lives in the `contacts` **component**, not here. |
| `rbac/` | Roles, permissions, route access (`permissions`, `platform-roles`, `role-access`). |
| `notifications/` | Notifications + activity logging (`notify`, `user-activity`). |
| `ai-client/` | The Anthropic client, model routing, key crypto, feature flag. AI *features* live in components. |
| `data/` | Supabase client factories (browser / server / service-role admin). |
| `shell/` | Navigation + layout surface (composed from manifests in Stage 3). |
| `ui/` | Shared design-system primitives (barrel over `src/components/ui` for now). |
| `db/` | Table-ownership declarations (`ownership.ts`) + the migration→live-table reader used by the governance reconciliation check. |
| `governance/` | Pure checkers (import boundaries, import scan) behind the CI governance gates. |

## Stage-1 note (S16-T02)

Cross-cutting libs were **moved** into `kernel/` and a thin re-export **shim** was
left at each old `@/lib/*` path so existing importers keep working with no
behaviour change. New code should import from `@/kernel/*`; the shims are removed
as each consumer migrates during the per-component tasks (S16-T05+). The import
boundary check treats `@/lib/*` as a legacy path during Stage 1.
