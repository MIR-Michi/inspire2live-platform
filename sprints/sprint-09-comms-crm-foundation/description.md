# Sprint 09 — Comms CRM Foundation

**Phase:** 2 planning backlog  
**Status:** Local implementation complete; pending database migration application and human workflow QC

## Goal

Introduce a Communications CRM workspace that supports both internal users and external stakeholders, gives comms one relationship view in the left navigation, and standardises the minimum record structure before full CRM persistence and automation are added.

## Rationale

The Communications Workspace now handles planning, events, campus, library, and podcast production, but it still lacks a dedicated relationship layer. Comms needs a structured way to see who matters, why they matter, what project they connect to, and when to follow up.

This sprint establishes the operating model first: picture, bio, and associated project are mandatory core fields, then CRM-standard relationship metadata is layered on top. The initial route can assemble this from existing platform data while the full CRM schema, CRUD flows, reminders, and privacy controls are delivered in follow-on tasks.

## Safety guardrails

- Keep the CRM route restricted to Communications Workspace access only.
- Do not weaken existing profile or campus RLS policies.
- Treat picture, bio, and associated project as required CRM-standard fields for the data model, even if some existing source records still need enrichment.
- Do not introduce live outbound email, sync connectors, or external system writes in this sprint.
- Keep consent, privacy, and relationship-owner accountability explicit in the backlog before any release goes live.

## Acceptance criteria

- Comms navigation includes a direct `CRM` entry in the left menu and mobile drawer.
- The CRM workspace supports internal users and external stakeholders in one structured view.
- CRM records surface picture, bio, associated project, role/title, organisation, location, relationship owner, preferred channel, source, last interaction, next follow-up, notes, and tags.
- The first route resolves real platform records where possible instead of being a pure placeholder.
- Sprint tasks include the dedicated CRM schema, CRUD flows, follow-up queue, privacy controls, and future connector backlog.

## Out of scope

- Releasing CRM to non-comms workspaces.
- Bi-directional sync with Outlook, HubSpot, Salesforce, Mailchimp, or WhatsApp.
- Automated reminder sending, campaign orchestration, or audience segmentation logic.
- Public or partner-facing CRM portals.
