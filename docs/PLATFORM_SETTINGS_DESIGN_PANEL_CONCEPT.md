# Platform Settings — Design & Component Library Panel

> **Status:** Proposed — Sprint 19 planning input. No runtime implementation is included in this document.
> **Location:** Platform Settings → Organization → Design & Component Library.
> **Architecture:** Extends the component-toolbox direction in `docs/MODULAR_COMPONENT_ARCHITECTURE.md` and the manifest-driven settings model in `docs/PLATFORM_SETTINGS_CONCEPT.md`.

## 1. Purpose

The platform needs one authoritative admin surface for organization-wide visual behavior and the emerging component library. It must not become a collection of page-specific styling switches or arbitrary CSS overrides.

The panel has two responsibilities:

1. **Design-system configuration:** edit the validated, blueprint-portable design tokens and defaults that apply across the platform.
2. **Living component catalog:** preview the approved reusable primitives, their variants, states, accessibility behavior, and responsive behavior using the same production components.

This panel is distinct from:

- **Profile & Brand**, which owns organization identity such as logo, name, and brand colors;
- **personal account preferences**, which own a user's theme or accessibility choices;
- **dashboard customization**, which owns a user's personal tile order, visibility, size, and split ratio;
- **component operations**, which remain in each owning module.

## 2. Component-library-first rule for Sprint 19

All Sprint 19 implementation must be compatible with the upcoming component library concept.

That means:

- new generic visual primitives are created once in the kernel UI layer, not inside dashboard folders;
- dashboard widgets compose shared primitives rather than inventing local card, button, menu, drawer, badge, skeleton, drag-handle, or motion variants;
- styling uses semantic design tokens and approved variants rather than repeated hard-coded utility combinations;
- component APIs are accessible by default and include keyboard, touch, focus, error, loading, empty, disabled, and reduced-motion states;
- module-owned widget content remains separate from kernel-owned presentation primitives;
- no component imports another module's internal UI;
- every reusable primitive has a stable public contract, usage guidance, and a live preview in the Design panel;
- provisional components are identified as such until the component-library ADR is accepted;
- dashboard-specific behavior is not promoted into the component library unless it is demonstrably reusable outside dashboards.

## 3. Information architecture

```text
Platform Settings
└── Organization
    ├── Profile & Brand
    └── Design & Component Library
        ├── Foundations
        ├── Components
        ├── Motion & Feedback
        ├── Dashboard Defaults
        └── Accessibility Preview
```

The panel is a first-class route, proposed as:

```text
/app/settings/design
```

It must be reachable through the Settings navigation and overview, not through a hidden dynamic component route.

## 4. Panel sections

### 4.1 Foundations

Organization-wide, validated tokens and defaults:

- spacing density: Comfortable / Compact;
- corner-radius scale: Soft / Moderate / Minimal;
- elevation scale: Flat / Subtle / Layered;
- surface treatment and border strength;
- typography scale selection from approved presets;
- content-width and dashboard-spacing defaults;
- focus-ring visibility and contrast preview.

Brand colors remain owned by Profile & Brand. The Design panel consumes those colors and shows how they behave in components, but does not duplicate their source of truth.

### 4.2 Components

A searchable living catalog of approved production primitives, initially including:

- buttons and icon buttons;
- links and navigation items;
- cards and collapsible cards;
- dashboard tiles;
- form controls and field groups;
- badges, pills, counters, and status indicators;
- menus, dialogs, drawers, and confirmation surfaces;
- tabs, segmented controls, and filters;
- tables, lists, empty states, skeletons, and error states;
- split layouts, drag handles, drop targets, and resize controls;
- toast/status feedback where appropriate.

Each preview shows:

- available variants and sizes;
- default, hover, active, focus, disabled, loading, success, warning, and error states where applicable;
- responsive behavior;
- keyboard behavior and accessible label expectations;
- reduced-motion behavior;
- owning package/path and stable public API name;
- maturity: Proposed / Experimental / Stable / Deprecated.

The catalog renders real components. It must not maintain a second visual imitation that can drift from production.

### 4.3 Motion & Feedback

Validated organization defaults for the shared motion vocabulary:

- motion profile: Reduced / Calm / Expressive;
- default transition duration scale;
- page and tile transition policy;
- task-completion celebration enabled/disabled;
- celebration intensity within an approved bounded range;
- success, save, loading, and error feedback patterns.

Rules:

- browser and account-level `prefers-reduced-motion` always overrides organization settings;
- no setting can enable sound or blocking animation;
- motion values are semantic tokens, not arbitrary millisecond inputs;
- confetti remains limited to deliberate user completion events.

### 4.4 Dashboard Defaults

Organization/role defaults only, not individual user layouts:

- default dashboard preset by role or dashboard variant;
- default primary/supporting split ratio within safe bounds;
- default density;
- which optional widgets are visible by default;
- required widgets that cannot be hidden;
- approved default widget sizes and zones;
- whether celebration is available for that dashboard.

A user's saved dashboard layout overrides these defaults where allowed. Changing a platform default must not silently overwrite existing personal layouts. It applies to new users, reset-to-default actions, and newly introduced widgets according to layout-version migration rules.

### 4.5 Accessibility Preview

A test surface for:

- keyboard-only navigation;
- visible focus order;
- screen-reader names and live announcements;
- contrast and non-color status communication;
- reduced-motion behavior;
- 200% zoom and narrow viewport behavior;
- touch-target size;
- high-content and long-label stress states.

This section is a verification aid, not a substitute for automated and manual accessibility testing in each consuming surface.

## 5. Settings architecture

The Design panel must use the existing manifest-driven Platform Settings machinery rather than a hand-built settings form.

### 5.1 Typed declarations

Design tokens and choices are declared through a typed kernel settings schema. Controls should be constrained enums, bounded numbers, booleans, or approved token references. Arbitrary CSS, arbitrary Tailwind classes, and free-form animation values are not supported.

### 5.2 Blueprint compatibility

Persisted design settings are non-secret, versioned, audited, and blueprint-portable. They can later be read by the platform generator when composing a related deployment from the component toolbox.

### 5.3 Resolution order

```text
component-library default
→ persisted organization design setting
→ account/accessibility override where allowed
→ operating-system accessibility preference
```

Personal dashboard layout preferences are resolved separately:

```text
role/dashboard default from Design panel
→ saved user dashboard preference
→ responsive adaptation for the current viewport
```

### 5.4 Permissions

- PlatformAdmin and Superadmin may edit organization design settings.
- Other users may view the resulting production UI but not the admin panel.
- Component previews must not expose protected application data.
- Superadmin view-as does not modify organization design settings or another user's preferences.

## 6. Component ownership and contracts

Target ownership follows ADR-0009:

```text
src/kernel/ui/
  foundations/       tokens, typography, spacing, elevation, motion
  primitives/        button, field, card, dialog, menu, badge, skeleton
  layout/            split, grid, stack, dashboard shell
  feedback/          success, save state, celebration
  catalog/           metadata and preview registrations
```

During the gradual transition from `src/components/ui`, Sprint 19 must:

- avoid duplicating primitives in both locations;
- document the chosen transition path in the dashboard/component-library ADR;
- expose only stable imports to modules;
- preserve the governance rule that the kernel imports no module internals;
- register production primitives in the catalog through metadata rather than hard-coding each preview route.

Module widgets remain in their module, for example:

```text
src/modules/events/ui/widgets/...
src/modules/tasks/ui/widgets/...
src/modules/communications/ui/widgets/...
```

They consume the kernel component library and publish mountable widget contracts through their module public API.

## 7. Design-token policy

Sprint 19 should begin a semantic token model rather than adding more page-specific values.

Examples:

- `--surface-canvas`
- `--surface-panel`
- `--surface-raised`
- `--border-subtle`
- `--border-strong`
- `--text-primary`
- `--text-muted`
- `--accent-primary`
- `--status-success`
- `--status-warning`
- `--status-danger`
- `--radius-card`
- `--shadow-card`
- `--space-dashboard-gap`
- `--motion-fast`
- `--motion-standard`
- `--motion-emphasis`

Token names should describe purpose, not a specific color or pixel value. Component variants reference semantic tokens; pages should not redefine them.

## 8. Acceptance criteria for the panel

- The panel has a first-class route and navigation entry under Platform Settings.
- It is generated from typed settings declarations and the component catalog, not a one-off page-specific form.
- Brand ownership remains in Profile & Brand with no duplicate color source of truth.
- The live catalog renders the production components and documents variants, states, accessibility, maturity, and ownership.
- Organization defaults for dashboard preset, split, density, and motion are bounded and versioned.
- Existing personal dashboard layouts are not overwritten when organization defaults change.
- Reduced-motion and accessibility preferences override organization motion settings.
- No arbitrary CSS, class names, custom scripts, or unrestricted numeric motion values can be stored.
- Settings are audited, blueprint-portable, and compatible with the future component toolbox/generator.
- The panel and all new Sprint 19 UI pass keyboard, screen-reader, contrast, zoom, responsive, and reduced-motion checks.

## 9. Sprint 19 boundary

Sprint 19 should establish the panel architecture, core token controls, dashboard defaults, motion defaults, and the catalog entries required by the dashboard work. It does not need to catalog every legacy component in the repository.

The minimum useful catalog covers every new or modified shared primitive introduced by Sprint 19 plus the existing primitives it directly adopts.

## 10. Future opportunities

- Theme packs generated from an organization blueprint.
- Component usage analytics and deprecation warnings.
- Visual regression snapshots directly connected to catalog examples.
- AI-assisted component selection when generating a new platform, always from approved catalog metadata.
- A public read-only design-system site if the component library becomes externally reusable.

## References

- Component toolbox: `docs/MODULAR_COMPONENT_ARCHITECTURE.md`
- Platform Settings blueprint editor: `docs/PLATFORM_SETTINGS_CONCEPT.md`
- Dashboard concept: `docs/ADAPTIVE_DASHBOARD_DESIGN_CONCEPT.md`
- Sprint 19: `sprints/sprint-19-adaptive-dashboard-design/`
- Existing UI primitives: `src/components/ui/`
- Target kernel UI layer: `src/kernel/ui/`

---

*Planning concept. Last reviewed: 2026-07-17.*
