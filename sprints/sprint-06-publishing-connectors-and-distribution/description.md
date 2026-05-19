# Sprint 06 — Publishing Connectors & Distribution

**Phase:** 2 draft backlog
**Status:** Not Started

## Goal

Turn the Sprint 04 integration stubs into real outbound publishing connectors while preserving operator control and clean rollback paths.

## Rationale

Sprint 04 defines the connector contracts. Sprint 06 should swap stub handlers for real integrations only after pilot feedback confirms which channels matter most.

## Draft acceptance criteria

- WordPress direct publish works from the content calendar with clear success/failure states.
- LinkedIn scheduling works from the content calendar.
- Newsletter draft creation works against the selected newsletter provider.
- Integration actions are logged with enough detail for audit and retry.
- Operators can still fall back to manual status updates if an external API fails.
