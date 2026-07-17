# Sprint 19 — Adaptive Dashboard Design & Personalization

> **Status:** Planned — all tasks are `Not Started`. This setup contains planning only: no runtime code, dependency, database, or UI behavior changes.
> **Theme:** Turn the platform dashboards into spacious, adaptive two-zone workspaces that users can arrange around their own priorities, while establishing the Platform Settings **Design & Component Library** panel and building every surface from the upcoming shared component-library model.
> **Depends on:** Sprint 16 modular foundation, Sprint 17 Platform Settings, the existing `ResizableSplit`, `TileGroup`, `CollapsibleCard`, unified task domain, and Sprint 18 remaining verification work.
> **Concepts:** `docs/ADAPTIVE_DASHBOARD_DESIGN_CONCEPT.md` and `docs/PLATFORM_SETTINGS_DESIGN_PANEL_CONCEPT.md`

## Non-negotiable component-library direction

Every Sprint 19 implementation must be compatible with the upcoming component library concept.

- Generic UI belongs in the kernel design-system layer, not in dashboard-specific folders.
- Dashboard widgets compose shared primitives; they do not invent local card, button, menu, drawer, badge, skeleton, drag-handle, or motion variants.
- Styling uses semantic design tokens and approved component variants rather than repeated hard-coded classes and page-specific values.
- Shared primitives are accessible by default and cover keyboard, touch, focus, loading, empty, error, disabled, responsive, and reduced-motion states.
- Module-owned widget content remains in its owning module and is exposed through that module's public API.
- Reusable primitives receive stable contracts, documentation, maturity status, and a live preview in Platform Settings → Design & Component Library.
- Provisional APIs must be identified and reconciled through the Sprint 19 architecture decision before broad rollout.

The dashboard redesign is therefore the first major consumer and proving ground of the future component library, not a parallel dashboard-only design system.

## Goal

Shipping this sprint produces:

1. **Better use of dashboard space.** Dashboard pages use a full-width orientation band followed by a clear resizable left/right workspace, inspired by the Campus meeting layout. Primary work sits on the left; monitoring and context sit on the right. Mobile keeps a logical single-column order.
2. **A real personal dashboard editor.** Users can enter an explicit edit mode, move tiles within or between zones, choose supported tile sizes, hide and restore optional tiles, apply presets, undo changes, and reset to the role default.
3. **Preferences that follow the user.** Layout, split ratio, visibility, size, order, and collapse choices are stored per user and dashboard with owner-only RLS. Browser storage becomes a cache/fallback rather than the source of truth.
4. **A shared dashboard composition system.** Personal, team, admin, coordinator, advocate, clinician, and researcher dashboards use one widget contract and shared component-library primitives while their actual content remains in the owning modules.
5. **A first-class Platform Settings design panel.** Administrators can manage validated organization-wide design tokens, motion defaults, and role/dashboard defaults and can review the real production component catalog at `/app/settings/design`.
6. **Friendly, purposeful motion.** Tile movement, collapse/expand, autosave, filter changes, loading, and empty states use a restrained motion vocabulary. Completing a task triggers a brief localized celebration without delaying persistence or navigation.
7. **Accessible personalization.** Tile movement and configuration work with keyboard, pointer, and touch; changes are announced to assistive technology; reduced-motion users receive static equivalents instead of confetti or large positional animation.

## Rationale

The platform already contains the building blocks but not a coherent dashboard or design-system experience:

- `ResizableSplit` provides the successful Campus-style two-column interaction, but dashboards do not consistently use it.
- `TileGroup` supports basic mouse reordering inside one group only; it cannot move tiles across zones, work by keyboard/touch, resize, hide, restore, undo, or sync across devices.
- `CollapsibleCard` and split ratios persist only in `localStorage`.
- Dashboard variants hard-code their tile order and spans independently, making design improvements repetitive and inconsistent.
- Team and admin dashboards underuse horizontal space, while the personal dashboard's grid does not clearly separate primary action from supporting context.
- Shared UI still lives largely in `src/components/ui` without a complete component-library contract, semantic token model, live catalog, or maturity lifecycle.
- Platform Settings has no Design panel where organization-wide design defaults and component-library previews can be managed coherently.
- Task completion currently changes status but provides little positive feedback.

The sprint therefore defines the component-library contract first, establishes its Platform Settings panel, builds a shared composition and preference layer, and then migrates the active dashboard variants without changing their underlying data sources or permissions.

## Experience direction

### Desktop

- Full-width title, greeting/toggle, primary actions, and concise KPI strip.
- Resizable default split around 64/36.
- Primary action queue on the left.
- Context, summaries, monitoring, and shortcuts on the right.
- Whole-page scrolling by default; avoid nested scroll regions unless a specific dense widget requires one.

### Mobile and tablet

- One logical stack, primary-zone tiles first.
- No horizontal drag requirement.
- Touch-accessible move actions and edit controls.
- Saved desktop preferences map predictably to mobile order.

### Customization

- Normal mode is stable and cannot be rearranged accidentally.
- **Edit dashboard** exposes drag handles, drop targets, size/visibility controls, presets, undo, reset, and an Add tiles drawer.
- The system uses structured grid positions rather than absolute coordinates.
- Required tiles may be moved but not hidden; optional tiles can be restored at any time.

### Motion

- Motion communicates cause and result rather than decorating every interaction.
- A deliberate task completion receives a check animation, brief positive highlight, localized confetti, and then a smooth exit when finished tasks are hidden.
- Reduced-motion mode replaces particle and positional effects with a static success state and screen-reader announcement.

### Platform Settings — Design & Component Library

The new admin panel is organization-wide and separate from personal dashboard customization.

It contains:

- **Foundations:** validated spacing, density, radius, elevation, typography, surface, and focus tokens.
- **Components:** a live catalog rendering the real production primitives, their variants, states, responsive behavior, accessibility contract, ownership, and maturity.
- **Motion & feedback:** bounded organization defaults for calm/expressive motion, task-completion celebration, save feedback, and reduced-motion handling.
- **Dashboard defaults:** role/dashboard presets, default split ratio, density, default widget placement, and required/optional widget policy.
- **Accessibility preview:** keyboard, focus, screen-reader, zoom, contrast, touch-target, long-label, and reduced-motion stress states.

Brand identity remains in Profile & Brand. The Design panel consumes brand tokens but does not create a duplicate source of truth. It supports constrained tokens and approved variants only; arbitrary CSS, class names, scripts, and unrestricted animation values are excluded.

## Technical direction

### Component library and design tokens

The Sprint 19 architecture decision must define the transition from `src/components/ui` toward the target `src/kernel/ui` design-system layer described by ADR-0009. The transition must avoid duplicated primitives and must preserve stable imports during migration.

The shared library should cover:

- foundations and semantic design tokens;
- core controls and form primitives;
- surfaces, cards, dialogs, drawers, menus, status and feedback;
- responsive layout, split, grid, drag/drop, resize, and dashboard shell primitives;
- shared motion tokens and reduced-motion behavior;
- catalog metadata for live previews and maturity state.

Token names describe purpose rather than a specific color or pixel value. Dashboard pages consume tokens and variants rather than redefining them.

### Shared composition layer

Introduce a cross-cutting dashboard composition API, kernel-owned, with stable dashboard and widget IDs, role-aware defaults, allowed sizes, required/optional state, and permission metadata. Widget content stays in the owning module and is exposed through that module's public API.

Candidate primitives:

- `DashboardShell`
- `DashboardLayout`
- `DashboardWidgetRegistry`
- `DashboardTile`
- `DashboardCustomizer`
- a pure `dashboard-preferences` domain
- shared `dashboard-motion` tokens/primitives

### Platform Settings design panel

The panel must use the existing manifest-driven settings and blueprint machinery. Typed declarations produce bounded controls; the live catalog registers real production primitives through metadata rather than hand-building a second imitation.

Organization defaults resolve as:

```text
component-library default
→ persisted organization design setting
→ account/accessibility override where allowed
→ operating-system accessibility preference
```

Personal dashboard layouts resolve separately:

```text
role/dashboard default from Design panel
→ saved user dashboard preference
→ responsive adaptation for the current viewport
```

Changing an organization default must not silently overwrite existing personal layouts. It applies to new users, reset-to-default actions, and versioned handling of newly introduced widgets.

### Preference store

A proposed kernel-owned `user_dashboard_preferences` table stores one versioned JSON layout per user and dashboard. RLS allows users to read/write only their own preferences. Server validation rejects unknown widgets, invalid sizes, duplicates, and out-of-range split ratios.

View-as renders the effective user's layout read-only; customization is disabled while previewing another user.

### Migration strategy

- Preserve existing dashboard content and actions.
- Define and approve platform-specific wireframes and the component-library contract before broad production migration.
- Convert current hard-coded composition to registry declarations incrementally.
- Reuse `ResizableSplit` rather than introducing another split implementation.
- Evolve or replace `TileGroup` so cross-zone, keyboard, and touch movement share one domain model.
- Migrate `localStorage` order/collapse/split choices where they can be mapped safely; otherwise start from the role default without breaking the page.
- Register every new or modified shared primitive in the live Design panel catalog.
- Do not attempt to catalog every legacy component during this sprint; cover all primitives introduced or materially changed by Sprint 19.

## Acceptance criteria

- [ ] Dedicated platform-specific wireframes cover Communications My, Communications Team, Admin, one default role dashboard, and the Platform Settings Design panel at desktop, tablet, and mobile widths, including normal/edit/configuration states. _(S19-T01, T02, T15)_
- [ ] An accepted architecture decision defines component-library ownership and transition, semantic tokens, stable dashboard/widget IDs, registry ownership, preference merge/versioning, module boundaries, catalog metadata, and view-as behavior. _(S19-T03)_
- [ ] Every generic UI element introduced or modified in Sprint 19 is implemented as or composed from an approved shared primitive, uses semantic tokens, and is registered in the live catalog. _(S19-T03, T04, T11, T15)_
- [ ] Dashboard pages render a full-width orientation/KPI band plus a responsive primary/supporting workspace using the shared split primitive. _(S19-T04, T09, T10)_
- [ ] Users can enter/exit an explicit edit mode; normal dashboard use does not accidentally move tiles. _(S19-T06)_
- [ ] Tiles can be reordered within a zone and moved between left/right zones by pointer, touch, and keyboard, with clear drop placeholders and ARIA announcements. _(S19-T07)_
- [ ] Supported tiles can change between Compact, Standard, and Wide sizes; optional tiles can be hidden and restored; required tiles cannot be hidden. _(S19-T06, T08)_
- [ ] Balanced, Focus, and Overview presets are available, plus Undo and Reset to role default. _(S19-T06, T08)_
- [ ] One preference record per user/dashboard persists split ratio, zone, order, size, visibility, and collapse state across devices; owner-only RLS and server validation are in place. _(S19-T05)_
- [ ] Platform Settings → Organization → Design & Component Library is a first-class manifest-driven panel with Foundations, Components, Motion & Feedback, Dashboard Defaults, and Accessibility Preview sections. _(S19-T15)_
- [ ] The Design panel renders real production components and exposes validated organization defaults without duplicating Brand settings or accepting arbitrary CSS/classes/scripts. _(S19-T15)_
- [ ] Existing personal dashboard layouts are not overwritten by organization design-default changes; reduced-motion/account/OS accessibility preferences remain authoritative. _(S19-T05, T11, T15)_
- [ ] Hidden tiles do not trigger unnecessary independent data loads; preference hydration does not cause visible layout shift. _(S19-T04, T05, T13)_
- [ ] Communications My/Team and Admin dashboards use the shared system without losing existing content, actions, filters, task visibility rules, or permissions. _(S19-T09, T10)_
- [ ] Remaining `/app/dashboard` role variants use the same shell/registry contract and preserve their role-specific defaults. _(S19-T10)_
- [ ] Completing a task through a direct user action produces a brief localized celebration and smooth removal where finished tasks are hidden; background/bulk updates do not fire confetti. _(S19-T11, T12)_
- [ ] `prefers-reduced-motion` disables confetti and large movement while preserving static success feedback and announcements. _(S19-T11, T12, T15)_
- [ ] Tile move, resize, hide, restore, save, reset, focus order, responsive stacking, and the Design panel pass accessibility checks. _(S19-T07, T13, T15)_
- [ ] Typecheck, lint, unit+coverage, governance, production build, dashboard/settings E2E smoke tests, and visual regression/breakpoint checks are green. _(S19-T14)_
- [ ] Sprint status, traceability, design changelog, architecture docs, component-library documentation, data dictionary, and changelog are updated as implementation progresses. _(S19-T03, T05, T14, T15)_

## Out of scope

- Free-form pixel positioning, overlapping widgets, or arbitrary user-authored HTML.
- Custom database queries or external third-party widgets created by end users.
- Any change to role permissions or underlying widget data access.
- AI automatically rearranging a dashboard.
- Multiple named layouts per dashboard in the first release.
- Sound effects, points, streaks, competitive leaderboards, or intrusive gamification.
- Arbitrary CSS, Tailwind classes, scripts, unrestricted token values, or a page-level theme editor.
- A complete catalog/migration of every legacy UI component in the repository; Sprint 19 covers its own new and materially changed primitives.
- Applying the composer to Campus, conference operating pages, WhatsApp, or other non-dashboard workspaces in this sprint.

## References

- Dashboard concept: `docs/ADAPTIVE_DASHBOARD_DESIGN_CONCEPT.md`
- Design panel concept: `docs/PLATFORM_SETTINGS_DESIGN_PANEL_CONCEPT.md`
- Component toolbox: `docs/MODULAR_COMPONENT_ARCHITECTURE.md`, ADR-0009
- Platform Settings blueprint editor: `docs/PLATFORM_SETTINGS_CONCEPT.md`, ADR-0010
- Campus split primitive: `src/components/ui/resizable-split.tsx`
- Existing reorder primitive: `src/components/ui/tile-group.tsx`
- Existing tile primitive: `src/components/ui/collapsible-card.tsx`
- Communications personal dashboard: `src/components/comms/comms-personal-dashboard.tsx`
- Communications team dashboard: `src/components/comms/team-dashboard.tsx`
- Admin dashboard: `src/components/admin/admin-dashboard.tsx`
- Role dashboard route: `src/app/app/dashboard/page.tsx`
- Delivery: `sprints/README.md`, ADR-0011

---

*Planned sprint. Last reviewed: 2026-07-17.*
