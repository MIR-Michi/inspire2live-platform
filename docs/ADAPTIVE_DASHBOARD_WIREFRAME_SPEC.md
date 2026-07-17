# Adaptive Dashboard Wireframe Specification

> **Status:** Implemented reference for Sprint 19.
> **Surfaces:** Communications My, Communications Team, Admin, Coordinator, Advocate/Clinician/Researcher, and Board dashboards.
> **Related:** `docs/ADAPTIVE_DASHBOARD_DESIGN_CONCEPT.md`, ADR-0012.

## 1. Shared desktop frame

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Context label                           view toggle / primary action         │
│ Dashboard title                                                            │
│ Short greeting or explanation                         [Edit dashboard]      │
├─────────────────────────────────────────────────────────────────────────────┤
│ KPI 1             KPI 2             KPI 3             KPI 4                │
├─────────────────────────────────────────────────────────────────────────────┤
│ Optional full-width / Wide widget                                           │
├───────────────────────────────────────┬─┬───────────────────────────────────┤
│ PRIMARY WORK                          │││ SUPPORTING CONTEXT                │
│                                      │││                                   │
│ Action queue / task board             │││ Monitoring / summaries            │
│                                      │││                                   │
│ Secondary work                        │││ News / people / shortcuts          │
│                                      │││                                   │
│                                      │││ [Focus on primary]                │
└───────────────────────────────────────┴─┴───────────────────────────────────┘
                                        ↑
                              keyboard/pointer resizer
```

Default proportions are role-aware and organization-configurable, normally around 64/36. The page owns scrolling. Tiles do not create page-level nested scroll traps; dense tables may scroll horizontally inside their own widget.

## 2. Shared edit mode

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Balanced] [Focus] [Overview] [Add tiles (2)] [Undo] [Reset]     Saved ✓   │
│ Hidden tiles: [+ Recent decisions] [+ WhatsApp channels]                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ PRIMARY (drop zone)                 │ SUPPORTING (drop zone)                 │
│ ┌─────────────────────────────────┐ │ ┌───────────────────────────────────┐ │
│ │ ⠿ Tile title             action │ │ │ ⠿ Tile title                    │ │
│ ├─────────────────────────────────┤ │ ├───────────────────────────────────┤ │
│ │ Size [Standard▼] ↑ ↓ Move → Hide│ │ │ Size [Compact▼] ↑ ↓ Move ← Hide │ │
│ ├─────────────────────────────────┤ │ ├───────────────────────────────────┤ │
│ │ Existing production content     │ │ │ Existing production content       │ │
│ └─────────────────────────────────┘ │ └───────────────────────────────────┘ │
└─────────────────────────────────────┴────────────────────────────────────────┘
```

Normal mode never exposes drag handles or movement controls. Edit mode supports:

- pointer drag with insertion/drop feedback;
- touch-friendly move buttons;
- keyboard arrows from the move handle;
- moving between primary and supporting zones;
- Compact, Standard, and Wide sizes where the widget permits them;
- hide and restore for optional widgets;
- required widgets shown as Required and not hideable;
- Undo and confirmed Reset;
- autosave status.

## 3. Tablet behavior

```text
┌───────────────────────────────────────────────────────┐
│ Header / actions                                      │
├───────────────────────────────────────────────────────┤
│ KPI grid: two columns                                 │
├───────────────────────────────────────────────────────┤
│ Wide widgets                                          │
├───────────────────────────┬───────────────────────────┤
│ Primary widgets           │ Supporting widgets        │
│ when usable width allows  │                           │
└───────────────────────────┴───────────────────────────┘
```

The divider appears only at the desktop breakpoint. Below it, the same saved zones map into a predictable stack rather than requiring a narrow draggable seam.

## 4. Mobile behavior

```text
┌──────────────────────────────┐
│ Header                       │
│ [Edit dashboard]             │
├──────────────────────────────┤
│ KPI grid                     │
├──────────────────────────────┤
│ Wide widget                  │
├──────────────────────────────┤
│ Primary tile 1               │
├──────────────────────────────┤
│ Primary tile 2               │
├──────────────────────────────┤
│ Supporting tile 1            │
├──────────────────────────────┤
│ Supporting tile 2            │
└──────────────────────────────┘
```

Primary-zone content precedes supporting context. All configuration controls meet the platform's minimum touch-target expectation. Movement never requires horizontal drag.

## 5. Dashboard-specific defaults

### Communications — My

Primary:
- My tasks as the required Wide anchor
- Incoming for review

Supporting:
- Project summaries
- Recent decisions
- Planner, Campus, and Library shortcuts

### Communications — Team

Primary:
- Team tasks as the required Wide anchor
- Bi-weekly meeting
- Events

Supporting:
- Field Newsfeed
- New members
- WhatsApp channels
- Update feed

### Admin

Primary:
- My tasks
- Needs attention, required

Supporting:
- People & access
- Activity & engagement
- System health, required

### Coordinator

Primary:
- Initiative health, required

Supporting:
- Inactivity alerts
- Portfolio alerts
- Field Newsfeed

### Advocate / Clinician / Researcher

Primary:
- My tasks, required
- My initiatives

Supporting:
- Field Newsfeed

### Board

Primary:
- Portfolio overview, required

Supporting:
- Portfolio risks
- Field Newsfeed

## 6. States

### Loading

Server-resolved preferences determine the initial composition, avoiding a post-hydration layout jump. Existing page and table skeletons should match final geometry when a route adds loading boundaries.

### Empty

Each widget owns a purposeful empty state. Task surfaces acknowledge an all-clear condition; monitoring surfaces explain that no items currently need review.

### Save failure

The customizer shows **Could not save — try another change**. The last visible arrangement remains in the current browser session so the user can retry or reset.

### Read-only view-as

The effective user's layout is visible, but **Edit dashboard** is absent. A clear read-only explanation is shown. Role-only preview uses the role default.

### Reduced motion

Large positional effects and confetti are removed under `prefers-reduced-motion`. Status text, check highlights, and screen-reader announcements remain.

## 7. Completion interaction

```text
Task status → Completed
      │
      ├─ persist successfully
      │
      ├─ success ring/check state
      │
      ├─ short localized confetti burst near the changed control
      │
      └─ normal dashboard revalidation may remove the completed row
```

No celebration occurs on failed writes, initial render, background synchronization, or bulk reconciliation. Rapid completions are rate-limited to prevent continuous particle coverage.

## 8. Platform Settings design panel

```text
┌─────────────────────────────┬──────────────────────────────────────────────┐
│ DESIGN CONTROLS             │ LIVE COMPONENT PREVIEW                       │
│ Density                     │ Dashboard tile + badge                       │
│ Radius                      │ Primary / secondary actions                  │
│ Elevation                   │ Form field                                   │
│ Motion                      │ Saved state                                  │
│ Task celebration            │ Actual CollapsibleCard primitive             │
│ Dashboard preset / split    │ Motion / preset / celebration summary        │
└─────────────────────────────┴──────────────────────────────────────────────┘
```

The panel edits validated semantic defaults, not arbitrary CSS. Personal dashboard arrangements remain user-owned.

---

*Implemented wireframe specification. Last reviewed: 2026-07-17.*
