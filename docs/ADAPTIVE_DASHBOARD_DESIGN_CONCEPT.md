# Adaptive Dashboard Design Concept

> **Status:** Proposed — planning input for Sprint 19. No runtime implementation is part of this document.
> **Reference pattern:** the Campus meeting page's clear left/right workspace, built on the existing `ResizableSplit` primitive.
> **Surfaces:** `/app/dashboard` and `/app/comms/dashboard` personal, team, and admin variants.

## 1. Intent

The dashboards should feel like working spaces rather than long stacks of unrelated cards. On desktop, each dashboard should use the available width through a clear primary/secondary split, while still stacking naturally on smaller screens. Users should be able to arrange the dashboard around their own work without breaking role-specific defaults, responsive behavior, or access controls.

The target experience combines:

- a full-width page header and concise KPI band;
- a resizable two-zone workspace below it;
- movable, resizable, collapsible, and optionally hidden tiles;
- role-aware defaults plus user-specific preferences;
- restrained, friendly motion and meaningful task-completion celebration;
- accessible keyboard and reduced-motion alternatives.

## 2. Current-state findings

The required primitives partly exist, but they are not yet assembled into a coherent dashboard system.

### Existing strengths

- `ResizableSplit` already provides a keyboard-accessible, responsive two-column layout with a persisted ratio.
- `TileGroup` already supports basic mouse drag reordering inside one group and stores the order in `localStorage`.
- `CollapsibleCard` already stores collapsed state in `localStorage`.
- The dashboard variants already expose useful role-specific content rather than one generic page.

### Current gaps

1. **Dashboard composition is hard-coded.** Each page independently declares its tile order, spans, default collapsed state, and visual hierarchy.
2. **The available width is underused.** The team and admin dashboards are primarily vertical stacks. The personal communications dashboard uses a grid, but not a stable primary/secondary workspace like Campus.
3. **Tile movement is limited.** `TileGroup` only reorders direct children within one group. It does not support moving between left and right zones, touch interaction, keyboard reordering, size changes, hidden tiles, or a clear edit mode.
4. **Preferences are browser-local.** Order, split ratio, and collapsed state do not follow the user across devices and can be lost with browser storage.
5. **There is no customization surface.** Users cannot see which tiles are available, restore a hidden tile, choose a density, apply a preset, undo a move, or reset to role defaults.
6. **Motion is incidental rather than designed.** Collapse transitions exist, but there is no shared motion vocabulary, completion celebration, drop feedback, save confirmation, or reduced-motion policy.
7. **Accessibility is incomplete.** Native HTML drag-and-drop is mouse-oriented. The grip is hidden from assistive technology and there is no keyboard move command or live announcement of the new position.

## 3. Design principles

### 3.1 Structured freedom, not a free-form canvas

“Move a tile anywhere” means any valid position in a responsive dashboard grid. It does not mean absolute pixel positioning. A structured grid keeps layouts readable, preserves mobile stacking, prevents overlapping content, and makes keyboard movement possible.

### 3.2 Primary work left, supporting context right

The default desktop split should be approximately **64/36**, adjustable with `ResizableSplit`. The left side contains the user's main action queue; the right side contains context, monitoring, summaries, and shortcuts. The whole page should normally scroll as one surface, avoiding nested scroll traps.

Suggested defaults:

| Dashboard | Primary zone | Supporting zone |
|---|---|---|
| Communications — My | My tasks, incoming review | project summaries, recent decisions, shortcuts |
| Communications — Team | team tasks, meeting agenda | field newsfeed, new members, channels, update feed |
| Admin | needs attention, my tasks | system health, people/access, recent activity |
| Coordinator | initiative health, blocked work | engagement alerts, notifications, recent changes |
| Advocate / clinician / researcher | my tasks, my initiatives | updates, deadlines, useful links |

KPI tiles remain full-width above the split because they provide orientation rather than ongoing work.

### 3.3 Customization is explicit

Normal dashboard use must not accidentally move tiles. An **Edit dashboard** action enters customization mode. Only then do drag handles, size controls, visibility controls, and drop targets appear.

### 3.4 Role defaults remain trustworthy

Each dashboard declares:

- a stable dashboard ID;
- a catalog of stable widget IDs;
- the default zone, order, size, and collapsed state per role/variant;
- whether a tile is required, optional, or unavailable for that role;
- the permissions needed to render its data.

A user preference may rearrange or hide optional tiles, but it never grants access to a widget or its underlying data. Required governance and safety tiles may be moved but not hidden.

## 4. Proposed dashboard anatomy

### 4.1 Full-width orientation band

1. Page title, short contextual greeting, and dashboard-view toggle.
2. Primary actions, including **Edit dashboard**.
3. A concise KPI strip, normally three to five items.

### 4.2 Adaptive workspace

- Desktop: resizable left/right zones using the shared split primitive.
- Tablet: balanced two-column grid where space permits.
- Mobile: one ordered stack, with primary-zone tiles before supporting-zone tiles by default.
- Optional **Focus mode** temporarily collapses the supporting rail without changing the saved layout.

### 4.3 Tile sizes

Use a small controlled vocabulary:

- **Compact:** short status or shortcut tile.
- **Standard:** normal card within one zone.
- **Wide:** spans the available dashboard width or both grid columns where the surface allows it.

Content may restrict available sizes. Tables and dense task boards should not be forced into Compact.

## 5. Customization experience

### 5.1 Edit mode

The header action changes from **Edit dashboard** to **Done**. Edit mode shows:

- visible drag handles;
- highlighted left/right drop zones;
- a tile menu for size, collapse, pin, and hide;
- an **Add tiles** drawer containing optional hidden widgets;
- **Undo**, **Reset to default**, and layout presets;
- autosave status: Saving… / Saved / Could not save.

### 5.2 Drag and placement behavior

- Move tiles within a zone or between zones.
- Show a clear insertion placeholder before committing the drop.
- Support pointer, touch, and keyboard controls.
- Keyboard commands should allow “Move up”, “Move down”, “Move to primary”, and “Move to supporting”.
- Announce changes through an ARIA live region, for example: “Field Newsfeed moved to supporting column, position 2.”
- Provide Undo after every move, hide, resize, or preset application.

### 5.3 Presets

Recommended initial presets:

- **Balanced:** default 64/36 layout.
- **Focus:** action tiles dominate; supporting rail is narrow.
- **Overview:** more compact tiles and a wider supporting rail.

Presets are starting points. Applying one does not prevent further customization.

### 5.4 Reset and recovery

- Reset only the current dashboard, not every dashboard.
- Confirm before replacing a customized layout.
- Hidden tiles remain recoverable from the Add tiles drawer.
- Invalid or obsolete widget IDs are ignored when a newer application version loads the layout.

## 6. Preference architecture

The current `localStorage` behavior should become an optimistic cache and fallback rather than the source of truth.

### 6.1 Proposed persisted record

A kernel-owned `user_dashboard_preferences` table should store one record per user and dashboard:

- `user_id`
- `dashboard_id`
- `layout_version`
- `layout jsonb`
- `updated_at`

The layout contains only presentation preferences, for example:

- split ratio;
- ordered tile IDs;
- zone per tile;
- supported size;
- visible/hidden state;
- collapsed state;
- density or preset metadata.

It must not contain widget data, permissions, task contents, or copied personal information.

### 6.2 Security and view-as behavior

- Users can read and write only their own layout preferences through RLS.
- A layout cannot make an unauthorized tile available; the widget registry and normal data permissions remain authoritative.
- Superadmin view-as should render the effective user's layout read-only. Customization is disabled while previewing another user so the previewer cannot modify the person's preferences.
- Server-side validation rejects unknown dashboards, unknown tile IDs, unsupported sizes, duplicate positions, and invalid ratios.

### 6.3 Versioning

Every dashboard default has a layout version. On load:

1. validate the saved layout;
2. remove obsolete widget IDs;
3. append newly introduced required tiles at a sensible default position;
4. preserve valid user choices;
5. persist the migrated representation after successful render.

## 7. Shared implementation shape

The implementation should consolidate existing primitives rather than add another parallel dashboard system.

Suggested shared building blocks:

- `DashboardShell` — header, KPI band, edit mode, save/reset controls.
- `DashboardLayout` — responsive split/grid and drop zones.
- `DashboardWidgetRegistry` — stable widget metadata and role-aware defaults.
- `DashboardTile` — common chrome, size rules, actions, collapse state, drag state.
- `DashboardCustomizer` — hidden-tile catalog, presets, undo, autosave feedback.
- `dashboard-preferences` domain — validation, migration, merging defaults with overrides.
- `dashboard-motion` primitives — animation tokens and reduced-motion handling.

The kernel may own the composition and preference machinery. Actual widget content remains in its owning module and is exposed through the module's public API.

## 8. Motion and friendly interaction design

Motion should communicate state, not decorate every interaction.

### 8.1 Motion vocabulary

- **Hover / press:** subtle elevation and scale, 120–180 ms.
- **Expand / collapse:** smooth height and opacity transition, 180–240 ms.
- **Drag:** tile lifts slightly, drop target opens organically, surrounding tiles animate into place.
- **Save:** a quiet checkmark or “Saved” transition, not a toast for every autosave.
- **New or updated tile:** short highlight fade, without repeated pulsing.
- **Loading:** skeletons that match final tile geometry to prevent layout shift.

Use CSS or the Web Animations API unless a motion library demonstrably reduces complexity across the full system.

### 8.2 Task completion celebration

When a user explicitly completes a task:

1. the status control resolves into a success check;
2. the task row gives a brief positive highlight;
3. a short, localized confetti burst originates near the completed task;
4. the row then transitions out if finished tasks are hidden.

Guardrails:

- confetti only follows a deliberate human completion, not background sync, imports, or bulk status reconciliation;
- keep the burst brief and non-blocking, with no sound;
- repeated rapid completions use a smaller acknowledgement rather than covering the page continuously;
- `prefers-reduced-motion` receives a static success state and announcement instead of particles;
- animation never delays saving or navigation.

### 8.3 Other friendly improvements

- Purposeful empty states with a useful next action.
- Soft transition when filters change rather than an abrupt full-card redraw.
- A subtle success state when all visible tasks are complete.
- Clear drop placeholders and an elastic return when an invalid drop is attempted.
- Organic but restrained card shadows and spacing, avoiding excessive gradients or novelty motion.

## 9. Accessibility requirements

- Full keyboard customization, not mouse drag alone.
- Touch targets at least 44 × 44 CSS pixels for tile actions and drag handles.
- Screen-reader labels and live announcements for move, resize, hide, restore, save, and reset.
- Visible focus states throughout edit mode.
- Color is never the sole indication of state.
- `prefers-reduced-motion` disables confetti and large positional transitions.
- Mobile order remains logical and matches the visual order.
- Focus is preserved when a tile moves; hiding a tile moves focus to the nearest safe control.

## 10. Performance requirements

- Do not load data for hidden optional widgets unless another visible widget uses the same query.
- Preserve Server Component data loading where practical; personalization should not force the entire dashboard into one client component.
- Avoid layout shift during preference hydration by resolving server preferences before rendering and using `localStorage` only as cache/fallback.
- Keep drag updates local and persist after drop rather than on every pointer movement.
- Animation must remain smooth on mid-range mobile devices and stop when the page is not visible.

## 11. Recommended rollout

1. Establish the widget contract, preference domain, and dedicated wireframes.
2. Build the shared shell and customization mode with representative mock widgets.
3. Migrate Communications — My and Team, where tile-based composition already exists.
4. Migrate the Admin dashboard.
5. Migrate the remaining `/app/dashboard` role variants.
6. Add the shared motion layer and task completion celebration.
7. Complete accessibility, mobile, performance, view-as, and recovery testing.

The migration should preserve current content and actions. This is a composition and interaction redesign, not a rewrite of dashboard data sources.

## 12. Out of scope for Sprint 19

- A free-form pixel canvas or overlapping widgets.
- User-authored custom queries or arbitrary external widgets.
- Changing role permissions or exposing data a user cannot already access.
- AI automatically rearranging a user's dashboard.
- Sound effects, gamification points, streaks, or competitive leaderboards.
- Applying the dashboard composer to every non-dashboard operating page.
- Multiple named personal dashboards; one saved layout per dashboard is sufficient initially.

## 13. Future opportunities

- Named layouts such as “Monday planning” and “Meeting mode”.
- Team-shared templates that a coordinator can suggest without overwriting personal layouts.
- Optional smart recommendations based on frequently opened tiles, always requiring user confirmation.
- A compact command palette for adding, hiding, or focusing widgets.
- More celebration styles selectable in accessibility/preferences settings.

## References

- Campus split reference: `src/components/ui/resizable-split.tsx`
- Existing tile order: `src/components/ui/tile-group.tsx`
- Existing collapse persistence: `src/components/ui/collapsible-card.tsx`
- Personal communications dashboard: `src/components/comms/comms-personal-dashboard.tsx`
- Team dashboard: `src/components/comms/team-dashboard.tsx`
- Admin dashboard: `src/components/admin/admin-dashboard.tsx`
- Role dashboard variants: `src/app/app/dashboard/page.tsx`
- Architecture: `docs/MODULAR_COMPONENT_ARCHITECTURE.md`, ADR-0009
- Delivery conventions: `sprints/README.md`, ADR-0011

---

*Planning concept. Last reviewed: 2026-07-17.*
