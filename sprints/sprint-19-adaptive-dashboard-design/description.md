# Sprint 19 — Adaptive Dashboard Design & Personalization

> **Status:** Planned — all tasks are `Not Started`. This setup commit contains planning only: no runtime code, dependency, database, or UI behavior changes.
> **Theme:** Turn the platform dashboards into spacious, adaptive two-zone workspaces that users can arrange around their own priorities, with accessible motion and meaningful completion feedback.
> **Depends on:** Sprint 16 modular foundation, the existing `ResizableSplit`, `TileGroup`, `CollapsibleCard`, unified task domain, and Sprint 18 remaining verification work.
> **Concept:** `docs/ADAPTIVE_DASHBOARD_DESIGN_CONCEPT.md`

## Goal

Shipping this sprint produces:

1. **Better use of dashboard space.** Dashboard pages use a full-width orientation band followed by a clear resizable left/right workspace, inspired by the Campus meeting layout. Primary work sits on the left; monitoring and context sit on the right. Mobile keeps a logical single-column order.
2. **A real personal dashboard editor.** Users can enter an explicit edit mode, move tiles within or between zones, choose supported tile sizes, hide and restore optional tiles, apply presets, undo changes, and reset to the role default.
3. **Preferences that follow the user.** Layout, split ratio, visibility, size, order, and collapse choices are stored per user and dashboard with owner-only RLS. Browser storage becomes a cache/fallback rather than the source of truth.
4. **A shared dashboard composition system.** Personal, team, admin, coordinator, advocate, clinician, and researcher dashboards use one widget contract and shared layout primitives while their actual content remains in the owning modules.
5. **Friendly, purposeful motion.** Tile movement, collapse/expand, autosave, filter changes, loading, and empty states use a restrained motion vocabulary. Completing a task triggers a brief localized celebration without delaying persistence or navigation.
6. **Accessible personalization.** Tile movement and configuration work with keyboard, pointer, and touch; changes are announced to assistive technology; reduced-motion users receive static equivalents instead of confetti or large positional animation.

## Rationale

The platform already contains the building blocks but not a coherent dashboard experience:

- `ResizableSplit` provides the successful Campus-style two-column interaction, but dashboards do not consistently use it.
- `TileGroup` supports basic mouse reordering inside one group only; it cannot move tiles across zones, work by keyboard/touch, resize, hide, restore, undo, or sync across devices.
- `CollapsibleCard` and split ratios persist only in `localStorage`.
- Dashboard variants hard-code their tile order and spans independently, making design improvements repetitive and inconsistent.
- Team and admin dashboards underuse horizontal space, while the personal dashboard's grid does not clearly separate primary action from supporting context.
- Task completion currently changes status but provides little positive feedback.

The sprint therefore builds a shared composition and preference layer first, then migrates the active dashboard variants without changing their underlying data sources or permissions.

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

## Technical direction

### Shared composition layer

Introduce a cross-cutting dashboard composition API, likely kernel-owned, with stable dashboard and widget IDs, role-aware defaults, allowed sizes, required/optional state, and permission metadata. Widget content stays in the owning module and is exposed through that module's public API.

Candidate primitives:

- `DashboardShell`
- `DashboardLayout`
- `DashboardWidgetRegistry`
- `DashboardTile`
- `DashboardCustomizer`
- a pure `dashboard-preferences` domain
- shared `dashboard-motion` tokens/primitives

### Preference store

A proposed kernel-owned `user_dashboard_preferences` table stores one versioned JSON layout per user and dashboard. RLS allows users to read/write only their own preferences. Server validation rejects unknown widgets, invalid sizes, duplicates, and out-of-range split ratios.

View-as renders the effective user's layout read-only; customization is disabled while previewing another user.

### Migration strategy

- Preserve existing dashboard content and actions.
- Convert current hard-coded composition to registry declarations incrementally.
- Reuse `ResizableSplit` rather than introducing another split implementation.
- Evolve or replace `TileGroup` so cross-zone, keyboard, and touch movement share one domain model.
- Migrate `localStorage` order/collapse/split choices where they can be mapped safely; otherwise start from the role default without breaking the page.

## Acceptance criteria

- [ ] Dedicated platform-specific wireframes cover Communications My, Communications Team, Admin, and one default role dashboard at desktop, tablet, mobile, normal mode, and edit mode. _(S19-T01, T02)_
- [ ] An accepted architecture decision defines dashboard/widget IDs, registry ownership, preference merge/versioning, module boundaries, and view-as behavior. _(S19-T03)_
- [ ] Dashboard pages render a full-width orientation/KPI band plus a responsive primary/supporting workspace using the shared split primitive. _(S19-T04, T09, T10)_
- [ ] Users can enter/exit an explicit edit mode; normal dashboard use does not accidentally move tiles. _(S19-T06)_
- [ ] Tiles can be reordered within a zone and moved between left/right zones by pointer, touch, and keyboard, with clear drop placeholders and ARIA announcements. _(S19-T07)_
- [ ] Supported tiles can change between Compact, Standard, and Wide sizes; optional tiles can be hidden and restored; required tiles cannot be hidden. _(S19-T06, T08)_
- [ ] Balanced, Focus, and Overview presets are available, plus Undo and Reset to role default. _(S19-T06, T08)_
- [ ] One preference record per user/dashboard persists split ratio, zone, order, size, visibility, and collapse state across devices; owner-only RLS and server validation are in place. _(S19-T05)_
- [ ] Hidden tiles do not trigger unnecessary independent data loads; preference hydration does not cause visible layout shift. _(S19-T04, T05, T13)_
- [ ] Communications My/Team and Admin dashboards use the shared system without losing existing content, actions, filters, task visibility rules, or permissions. _(S19-T09, T10)_
- [ ] Remaining `/app/dashboard` role variants use the same shell/registry contract and preserve their role-specific defaults. _(S19-T10)_
- [ ] Completing a task through a direct user action produces a brief localized celebration and smooth removal where finished tasks are hidden; background/bulk updates do not fire confetti. _(S19-T11, T12)_
- [ ] `prefers-reduced-motion` disables confetti and large movement while preserving static success feedback and announcements. _(S19-T11, T12)_
- [ ] Tile move, resize, hide, restore, save, reset, focus order, and responsive stacking pass accessibility checks. _(S19-T07, T13)_
- [ ] Typecheck, lint, unit+coverage, governance, production build, and dashboard E2E smoke tests are green; key layouts are visually checked at representative breakpoints. _(S19-T14)_
- [ ] Sprint status, traceability, design changelog, architecture docs, data dictionary, and changelog are updated as implementation progresses. _(S19-T03, T05, T14)_

## Out of scope

- Free-form pixel positioning, overlapping widgets, or arbitrary user-authored HTML.
- Custom database queries or external third-party widgets created by end users.
- Any change to role permissions or underlying widget data access.
- AI automatically rearranging a dashboard.
- Multiple named layouts per dashboard in the first release.
- Sound effects, points, streaks, competitive leaderboards, or intrusive gamification.
- Applying the composer to Campus, conference operating pages, WhatsApp, or other non-dashboard workspaces in this sprint.

## References

- Concept: `docs/ADAPTIVE_DASHBOARD_DESIGN_CONCEPT.md`
- Campus split primitive: `src/components/ui/resizable-split.tsx`
- Existing reorder primitive: `src/components/ui/tile-group.tsx`
- Existing tile primitive: `src/components/ui/collapsible-card.tsx`
- Communications personal dashboard: `src/components/comms/comms-personal-dashboard.tsx`
- Communications team dashboard: `src/components/comms/team-dashboard.tsx`
- Admin dashboard: `src/components/admin/admin-dashboard.tsx`
- Role dashboard route: `src/app/app/dashboard/page.tsx`
- Architecture: `docs/MODULAR_COMPONENT_ARCHITECTURE.md`, ADR-0009
- Delivery: `sprints/README.md`, ADR-0011

---

*Planned sprint. Last reviewed: 2026-07-17.*
