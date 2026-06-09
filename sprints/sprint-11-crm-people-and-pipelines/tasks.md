# Sprint 11 — CRM people types, internal profiles, pipelines, and a lean hub

Builds directly on the CRM foundation from Sprint 09 (`comms_crm_contacts` and
related tables, migration `00048`). This sprint extends the data model and
restructures the CRM area from a single dense page into a lean hub with
focused sub-pages, per the brief below.

## Brief (verbatim intent)

- CRM people type: Comms, Patient Advocate, Clinician, Researcher,
  Governmental, Patient
- Beyond these types there should be a label: intern / extern (intern by
  default) — mapped onto the existing `segment` field (`internal` / `external`)
- Internal people should have a bio, a picture, field of expertise, skills
- Pipelines (funnels): pipeline name, stages (with names), add people
- The CRM space should start with a lean, intuitive landing page with tiles
  to go further, plus a search option
- Search functionality and filters throughout
- Focused, intuitive UX and clean UI

## Tasks

| ID | Task | Purpose / Scope | Acceptance Criteria | Owner | Status | Notes |
|---|---|---|---|---|---|---|
| S11-T01 | Add `person_type`, `field_of_expertise`, and `skills` to CRM contacts | Let comms classify each person and capture expertise/skills for internal people. | Migration adds `person_type` (nullable enum: comms, patient_advocate, clinician, researcher, governmental, patient), `field_of_expertise` (text[]), `skills` (text[]) to `comms_crm_contacts`; `segment` defaults to `internal`. | Claude | Completed | Migration `00052_crm_people_and_pipelines.sql`. |
| S11-T02 | Surface person type, expertise, and skills in the People view | Make the new fields usable in both display and edit flows. | Contact cards show person type badge and (for internal contacts) expertise/skills; create/edit forms expose all three fields; search matches against them. | Claude | Completed | Extended `comms-crm.ts` constants/types and the People workspace component. |
| S11-T03 | Add CRM pipeline schema (pipelines, stages, members) | Persist named pipelines with ordered stages and member assignments. | New tables `comms_crm_pipelines`, `comms_crm_pipeline_stages`, `comms_crm_pipeline_members` with comms-only RLS, FKs to `comms_crm_contacts`, ordering, and indexes. | Claude | Completed | Same migration `00052`. Ad-hoc names create a lightweight CRM contact so members always resolve to one source of truth. |
| S11-T04 | Build pipeline management UI | Let comms create pipelines, manage stages, and assign people. | `/app/comms/crm/pipelines` lists pipelines with create form; `/app/comms/crm/pipelines/[id]` shows a board of stages, supports adding/renaming/reordering/removing stages, and adding/moving/removing members. | Claude | Completed | New server actions in `pipeline-actions.ts`. |
| S11-T05 | Support three ways to add a person to a pipeline stage | Match real-world flexibility: pick from CRM, jot a name, or bring someone new onto the platform. | Add-person control offers (a) search existing CRM contacts, (b) quick ad-hoc name entry, (c) "invite to the platform" (internal only) which creates an internal CRM contact flagged as invited and logs an interaction. | Claude | Completed | Account provisioning (auth invite email) is intentionally out of scope — flagged as a follow-up in the connector/ops backlog, mirroring the existing CRM connector-backlog pattern. |
| S11-T06 | Restructure `/app/comms/crm` into a lean hub | Replace the single dense page with an entry point that orients comms before they dive in. | Landing page shows a global CRM search box and tiles (People, Pipelines, Follow-ups, Privacy review) with live counts that link to focused sub-pages. | Claude | Completed | New `page.tsx`; existing workspace logic relocated to `/app/comms/crm/people`. |
| S11-T07 | Simplify the People workspace | Keep the focused workflow (search, filters, records, edit, interactions, follow-ups) prominent; demote secondary reference material. | Consent/privacy fields remain in the edit form (not deleted) but the CRM-standard reference and connector backlog move to a collapsed "More" section so the primary list reads cleanly. | Claude | Completed | `/app/comms/crm/people/page.tsx` + slimmed `comms-crm-workspace.tsx`. |
| S11-T08 | Add person-type and intern/extern filters alongside search | Extend filtering beyond the existing segment toggle. | People view supports filtering by person type and segment together with free-text search; filters are reflected in the URL so they're shareable/bookmarkable. | Claude | Completed | Filter state lives in `searchParams`, mirroring the existing segment-filter pattern. |

## Out of scope (flagged for later)

- Automated platform-account provisioning when inviting a new internal person
  from a pipeline (would require `supabase.auth.admin` invite flows and a
  dedicated review of the security implications — tracked as a backlog item
  next to the existing CRM connector backlog).
- Drag-and-drop pipeline boards (v1 uses explicit move/reorder controls to
  keep the UI accessible and simple).
