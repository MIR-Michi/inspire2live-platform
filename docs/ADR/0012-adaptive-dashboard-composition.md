# ADR-0012: Adaptive Dashboard Composition and User Preferences

- **Status:** accepted
- **Date:** 2026-07-17
- **Owners:** @michaelwittinger-prog

## Context

The platform has several role-specific dashboards, but each previously hard-coded its own order, spans, collapse defaults, and page structure. Existing primitives solved parts of the problem independently: `ResizableSplit` persisted a local split ratio, `TileGroup` persisted mouse-only ordering within one group, and `CollapsibleCard` persisted collapse state. Those browser-local choices did not follow a user across devices, could not move widgets between dashboard zones, and did not provide one permission-safe composition contract.

Sprint 19 also introduces organization-wide design defaults and a live component catalog. The implementation must fit ADR-0009: the kernel owns cross-cutting composition and design-system primitives, while modules continue to own their widget content and data access.

- Related requirements: `REQ-DASH-001` through `REQ-DASH-008`
- Related decisions: ADR-0009 (modular component architecture), ADR-0010 (Platform Settings)

## Decision

### 1. The kernel owns dashboard composition

A shared dashboard domain under `src/kernel/dashboard/` defines:

- stable dashboard IDs;
- stable widget IDs and role/variant defaults;
- primary and supporting zones;
- allowed Compact, Standard, and Wide sizes;
- required versus optional widgets;
- versioned layout validation, sanitization, preset application, and move operations.

The kernel never owns module data. Each module provides already-authorized widget content through its public UI contract; the dashboard composer only controls presentation.

### 2. Structured responsive placement, not absolute positioning

“Move a widget anywhere” means any valid position in a responsive grid. Desktop uses a resizable primary/supporting split, wide widgets may span above it, and mobile maps the same saved order into a logical stack. Absolute coordinates, overlapping widgets, and user-authored CSS are not supported.

### 3. Explicit edit mode

Normal dashboard use is stable. Movement, sizing, visibility, presets, undo, and reset appear only after the user selects **Edit dashboard**. Required widgets remain visible. Optional widgets can be hidden and restored.

### 4. Preferences are durable, owner-only presentation data

`public.user_dashboard_preferences` stores one row per `(user_id, dashboard_id)` with:

- a layout version;
- a validated JSON layout containing split ratio, preset, density, zone, order, size, visibility, and collapsed state;
- timestamps.

RLS permits authenticated users to read/write/delete only their own rows. The layout contains no widget data, copied personal information, or permissions. The server validates all writes against the current dashboard catalog, so a stored layout cannot expose an unauthorized or unknown widget.

`localStorage` remains a best-effort interaction cache for the existing split primitive, not the authoritative cross-device store.

### 5. Default resolution and versioning

The effective layout is:

```
dashboard catalog default
  → organization design defaults from Platform Settings
  → validated per-user layout override
```

When definitions change, saved layouts are sanitized: obsolete widget IDs are discarded, new widgets are appended at their default position, required widgets are restored, unsupported sizes fall back, and orders are normalized. The current definition version is then used for subsequent saves.

### 6. View-as is read-only

Superadmin view-as may load and display the effective user’s saved layout through the existing privileged server path, but dashboard customization is disabled. Role-only preview uses the role default. Previewing never mutates another person’s preferences.

### 7. Component-library-first UI

Cross-cutting dashboard chrome, layout, motion, completion feedback, and design-system context are kernel UI primitives. Domain widgets remain in their owning modules. The stable import surface is `@/kernel/ui`; physical migration of historical primitives from `src/components/ui` can remain gradual.

### 8. Purposeful completion feedback

A deliberate, successfully persisted task completion emits a global UI event. The app-shell host displays an accessible success announcement and a brief localized burst through the shared `ConfettiBurst` primitive. Initial render, background synchronization, failed writes, and bulk reconciliation never trigger celebration. Reduced-motion and organization settings suppress particles without suppressing the success announcement.

## Alternatives considered

1. **Keep per-dashboard hard-coded grids and expand `TileGroup`.** Rejected because separate localStorage keys would remain the source of truth and composition rules would continue to drift between dashboards.
2. **Store arbitrary JSX/configuration per user.** Rejected because it is not portable, versionable, permission-safe, or compatible with the component toolbox.
3. **Use a free-form pixel canvas.** Rejected because it breaks responsive behavior, keyboard movement, mobile order, and predictable accessibility.
4. **Store dashboard configuration in Platform Settings only.** Rejected because organization defaults and personal preferences have different authorship, scope, RLS, and reset semantics.
5. **Create a dashboard-specific design system.** Rejected because it would duplicate the upcoming kernel component library and undermine ADR-0009.

## Consequences

### Positive

- Every dashboard uses one validated composition model.
- Preferences follow the user across browsers and devices.
- Saved presentation data cannot grant access or load unknown widgets.
- Dashboard defaults can evolve without invalidating existing layouts.
- The same component-library primitives support dashboards and future composed platforms.
- View-as remains safe and non-destructive.

### Negative / trade-offs

- Native drag interaction still requires explicit keyboard/touch alternatives, increasing UI complexity.
- Widget IDs become durable contracts and must be migrated carefully when renamed.
- Some dashboard data loaders remain broader than the visible widget set until they are split into independently loadable module contracts; hidden widgets must not introduce new standalone queries.
- Cross-device persistence introduces a migration and an authenticated write endpoint.
- Organization design changes apply on the next server refresh rather than rewriting an active in-progress edit session.

## Rollout / Migration plan

1. Add the preference table and owner-only RLS.
2. Introduce the kernel dashboard catalog, layout domain, repository, and API.
3. Extend the shared split primitive with controlled mode while keeping legacy behavior compatible.
4. Migrate Communications My/Team and Admin dashboards.
5. Extract and migrate Coordinator, Advocate/Clinician/Researcher, and Board dashboards.
6. Add the Platform Settings Design & Component Library panel and runtime semantic defaults.
7. Add shared completion feedback and reduced-motion behavior.
8. Validate with unit, governance, build, migration replay, E2E/preview smoke, and responsive/accessibility review.

## References

- PR: #181
- Ticket: Sprint 19, `sprints/sprint-19-adaptive-dashboard-design/`
- Related docs: `docs/ADAPTIVE_DASHBOARD_DESIGN_CONCEPT.md`, `docs/PLATFORM_SETTINGS_DESIGN_PANEL_CONCEPT.md`, `docs/MODULAR_COMPONENT_ARCHITECTURE.md`, `docs/PLATFORM_SETTINGS_CONCEPT.md`
