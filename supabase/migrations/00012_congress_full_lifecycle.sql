-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 00012: Full Congress Lifecycle Schema
-- Adds multi-year congress events, themes, sessions, session notes,
-- assets, and cross-year bridging (carryover links).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── congress_themes ───────────────────────────────────────────────────────────
-- Persistent themes that span multiple years; track strategic continuity.
CREATE TABLE IF NOT EXISTS congress_themes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  description  text,
  color        text NOT NULL DEFAULT 'orange',   -- tailwind color key for UI
  first_year   integer NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── congress_events ───────────────────────────────────────────────────────────
-- One row per annual congress (or other major event).
ALTER TABLE congress_events
  ADD COLUMN IF NOT EXISTS title            text,
  ADD COLUMN IF NOT EXISTS description      text,
  ADD COLUMN IF NOT EXISTS theme_headline   text,
  ADD COLUMN IF NOT EXISTS parent_event_id  uuid REFERENCES congress_events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at       timestamptz NOT NULL DEFAULT now();

UPDATE congress_events
SET
  title = COALESCE(title, 'Inspire2Live Congress ' || year::text),
  description = COALESCE(description, theme),
  theme_headline = COALESCE(theme_headline, theme),
  updated_at = COALESCE(updated_at, now());

CREATE TABLE IF NOT EXISTS congress_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year             integer NOT NULL UNIQUE,
  title            text NOT NULL,
  description      text,
  location         text,
  start_date       date,
  end_date         date,
  theme_headline   text,                          -- top-level headline theme
  status           text NOT NULL DEFAULT 'planning',
  parent_event_id  uuid REFERENCES congress_events(id) ON DELETE SET NULL,  -- previous year
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT congress_events_status_check CHECK (
    status IN ('planning','open_for_topics','agenda_set','live','post_congress','archived')
  )
);

CREATE INDEX IF NOT EXISTS congress_events_year_idx ON congress_events(year);

-- ── Add event_id + theme_id to existing congress_topics ──────────────────────
ALTER TABLE congress_topics
  ADD COLUMN IF NOT EXISTS event_id               uuid REFERENCES congress_events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS theme_id               uuid REFERENCES congress_themes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS carryover_from_topic_id uuid REFERENCES congress_topics(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scheduled_session_id   uuid;   -- FK added below after sessions table exists

CREATE INDEX IF NOT EXISTS congress_topics_event_id_idx ON congress_topics(event_id);

-- ── Add event_id + provenance fields to existing congress_decisions ───────────
ALTER TABLE congress_decisions
  ADD COLUMN IF NOT EXISTS event_id              uuid REFERENCES congress_events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS session_id            uuid,    -- FK added below
  ADD COLUMN IF NOT EXISTS theme_id              uuid REFERENCES congress_themes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS congress_year         integer,
  ADD COLUMN IF NOT EXISTS carryover_to_event_id uuid REFERENCES congress_events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_id              uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deadline              date,
  ADD COLUMN IF NOT EXISTS description           text;    -- alias for legacy `body`

CREATE INDEX IF NOT EXISTS congress_decisions_event_id_idx ON congress_decisions(event_id);
CREATE INDEX IF NOT EXISTS congress_decisions_year_idx     ON congress_decisions(congress_year);

-- ── congress_sessions ─────────────────────────────────────────────────────────
ALTER TABLE congress_sessions
  ADD COLUMN IF NOT EXISTS event_id         uuid REFERENCES congress_events(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS session_type     text NOT NULL DEFAULT 'plenary',
  ADD COLUMN IF NOT EXISTS agenda_order     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status           text NOT NULL DEFAULT 'planned',
  ADD COLUMN IF NOT EXISTS max_attendees    integer,
  ADD COLUMN IF NOT EXISTS updated_at       timestamptz NOT NULL DEFAULT now();

UPDATE congress_sessions
SET event_id = congress_id
WHERE event_id IS NULL;

CREATE TABLE IF NOT EXISTS congress_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         uuid NOT NULL REFERENCES congress_events(id) ON DELETE CASCADE,
  topic_id         uuid REFERENCES congress_topics(id) ON DELETE SET NULL,
  title            text NOT NULL,
  description      text,
  session_type     text NOT NULL DEFAULT 'plenary',     -- plenary | workshop | panel | working_group | break
  agenda_order     integer NOT NULL DEFAULT 0,
  start_time       timestamptz,
  end_time         timestamptz,
  room             text,
  status           text NOT NULL DEFAULT 'planned',     -- planned | live | completed | cancelled
  session_lead_id  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  note_taker_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  max_attendees    integer,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT congress_sessions_type_check CHECK (
    session_type IN ('plenary','workshop','panel','working_group','keynote','break')
  ),
  CONSTRAINT congress_sessions_status_check CHECK (
    status IN ('planned','live','completed','cancelled')
  )
);

CREATE INDEX IF NOT EXISTS congress_sessions_event_id_idx ON congress_sessions(event_id);
CREATE INDEX IF NOT EXISTS congress_sessions_status_idx   ON congress_sessions(status);

-- Back-fill FK now that sessions table exists
ALTER TABLE congress_topics
  ADD CONSTRAINT fk_congress_topics_session
  FOREIGN KEY (scheduled_session_id) REFERENCES congress_sessions(id) ON DELETE SET NULL;

ALTER TABLE congress_decisions
  ADD CONSTRAINT fk_congress_decisions_session
  FOREIGN KEY (session_id) REFERENCES congress_sessions(id) ON DELETE SET NULL;

-- ── congress_session_attendees ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS congress_session_attendees (
  session_id    uuid NOT NULL REFERENCES congress_sessions(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role          text NOT NULL DEFAULT 'attendee',   -- attendee | speaker | facilitator | note_taker | session_lead
  registered_at timestamptz NOT NULL DEFAULT now(),
  attended      boolean,
  PRIMARY KEY (session_id, user_id)
);

-- ── congress_session_notes ────────────────────────────────────────────────────
-- Versioned markdown notes per session (live capture during congress).
CREATE TABLE IF NOT EXISTS congress_session_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES congress_sessions(id) ON DELETE CASCADE,
  body        text NOT NULL DEFAULT '',
  version     integer NOT NULL DEFAULT 1,
  created_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS congress_session_notes_session_idx ON congress_session_notes(session_id);

-- ── congress_assets ───────────────────────────────────────────────────────────
-- Files associated with an event or specific session (slides, recordings, etc.)
CREATE TABLE IF NOT EXISTS congress_assets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid NOT NULL REFERENCES congress_events(id) ON DELETE CASCADE,
  session_id   uuid REFERENCES congress_sessions(id) ON DELETE SET NULL,
  name         text NOT NULL,
  description  text,
  storage_path text NOT NULL,
  mime_type    text,
  asset_type   text NOT NULL DEFAULT 'document',   -- document | slides | recording | photo | report
  uploaded_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  is_public    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT congress_assets_type_check CHECK (
    asset_type IN ('document','slides','recording','photo','report','minutes')
  )
);

CREATE INDEX IF NOT EXISTS congress_assets_event_id_idx ON congress_assets(event_id);

-- ── congress_event_themes ─────────────────────────────────────────────────────
-- Many-to-many: which themes belong to which events (cross-year linkage).
CREATE TABLE IF NOT EXISTS congress_event_themes (
  event_id   uuid NOT NULL REFERENCES congress_events(id) ON DELETE CASCADE,
  theme_id   uuid NOT NULL REFERENCES congress_themes(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, theme_id)
);

-- ── RLS policies ──────────────────────────────────────────────────────────────
ALTER TABLE congress_events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE congress_themes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE congress_sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE congress_session_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE congress_session_notes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE congress_assets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE congress_event_themes      ENABLE ROW LEVEL SECURITY;

-- Events & themes: all authenticated users can read
DROP POLICY IF EXISTS "auth_read_congress_events" ON congress_events;
CREATE POLICY "auth_read_congress_events" ON congress_events
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "coordinators_manage_congress_events" ON congress_events;
CREATE POLICY "coordinators_manage_congress_events" ON congress_events
  FOR ALL USING (is_coordinator_or_admin());

DROP POLICY IF EXISTS "auth_read_congress_themes" ON congress_themes;
CREATE POLICY "auth_read_congress_themes" ON congress_themes
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "coordinators_manage_congress_themes" ON congress_themes;
CREATE POLICY "coordinators_manage_congress_themes" ON congress_themes
  FOR ALL USING (is_coordinator_or_admin());

-- Sessions: all authenticated users can read; coordinators/admins manage
DROP POLICY IF EXISTS "auth_read_congress_sessions" ON congress_sessions;
CREATE POLICY "auth_read_congress_sessions" ON congress_sessions
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "coordinators_manage_congress_sessions" ON congress_sessions;
CREATE POLICY "coordinators_manage_congress_sessions" ON congress_sessions
  FOR ALL USING (is_coordinator_or_admin());

-- Session attendees: users see their own; coordinators see all
DROP POLICY IF EXISTS "auth_read_session_attendees" ON congress_session_attendees;
CREATE POLICY "auth_read_session_attendees" ON congress_session_attendees
  FOR SELECT USING (auth.uid() = user_id OR is_coordinator_or_admin());

DROP POLICY IF EXISTS "auth_manage_own_attendance" ON congress_session_attendees;
CREATE POLICY "auth_manage_own_attendance" ON congress_session_attendees
  FOR ALL USING (auth.uid() = user_id);

-- Session notes: all authenticated users can read; note-takers and admins can write
DROP POLICY IF EXISTS "auth_read_session_notes" ON congress_session_notes;
CREATE POLICY "auth_read_session_notes" ON congress_session_notes
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "notetaker_manage_session_notes" ON congress_session_notes;
CREATE POLICY "notetaker_manage_session_notes" ON congress_session_notes
  FOR ALL USING (
    auth.uid() = created_by
    OR is_coordinator_or_admin()
    OR EXISTS (
      SELECT 1 FROM congress_sessions cs
      WHERE cs.id = session_id
        AND (cs.note_taker_id = auth.uid() OR cs.session_lead_id = auth.uid())
    )
  );

-- Assets: public assets readable by all authenticated; restricted by is_public flag
DROP POLICY IF EXISTS "auth_read_public_congress_assets" ON congress_assets;
CREATE POLICY "auth_read_public_congress_assets" ON congress_assets
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_public = true);

DROP POLICY IF EXISTS "coordinators_manage_congress_assets" ON congress_assets;
CREATE POLICY "coordinators_manage_congress_assets" ON congress_assets
  FOR ALL USING (is_coordinator_or_admin());

-- Event themes join table: readable by all authenticated
DROP POLICY IF EXISTS "auth_read_event_themes" ON congress_event_themes;
CREATE POLICY "auth_read_event_themes" ON congress_event_themes
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "coordinators_manage_event_themes" ON congress_event_themes;
CREATE POLICY "coordinators_manage_event_themes" ON congress_event_themes
  FOR ALL USING (is_coordinator_or_admin());

-- ── Seed: congress_events ─────────────────────────────────────────────────────
INSERT INTO congress_events (id, year, theme, title, description, location, start_date, end_date, theme_headline, status)
VALUES
  (
    '00000000-c001-0000-0000-000000000001',
    2024,
    'Evidence-Driven Patient Advocacy',
    'Inspire2Live Congress 2024',
    'The 2024 congress focused on patient-centred evidence frameworks and expanding access to clinical trials for rare cancer patients across Europe and Africa.',
    'Rotterdam, Netherlands',
    '2024-11-08',
    '2024-11-09',
    'Evidence-Driven Patient Advocacy',
    'completed'
  ),
  (
    '00000000-c002-0000-0000-000000000002',
    2025,
    'From Decision to Action: The 48-Hour Standard',
    'Inspire2Live Congress 2025',
    'The 2025 congress accelerated the translation of congress decisions into active workstreams, piloting the 48-hour conversion framework for the first time.',
    'Amsterdam, Netherlands',
    '2025-11-14',
    '2025-11-15',
    'From Decision to Action: The 48-Hour Standard',
    'completed'
  ),
  (
    '00000000-c003-0000-0000-000000000003',
    2026,
    'Scale What Works: Platform-Driven Impact',
    'Inspire2Live Congress 2026',
    'Congress 2026 will convene patient advocates, researchers, clinicians, and partners to advance the next generation of cross-border cancer initiatives. Theme: scaling what works.',
    'Amsterdam, Netherlands',
    '2026-11-13',
    '2026-11-14',
    'Scale What Works: Platform-Driven Impact',
    'upcoming'
  )
ON CONFLICT (year) DO NOTHING;

-- Link 2025 and 2026 to their predecessors
UPDATE congress_events
SET parent_event_id = (SELECT id FROM congress_events WHERE year = 2024 LIMIT 1)
WHERE year = 2025;

UPDATE congress_events
SET parent_event_id = (SELECT id FROM congress_events WHERE year = 2025 LIMIT 1)
WHERE year = 2026;

-- ── Seed: congress_themes ─────────────────────────────────────────────────────
INSERT INTO congress_themes (id, title, description, color, first_year)
VALUES
  ('00000000-a001-0000-0000-000000000001', 'Patient-Led Evidence', 'Ensuring patients co-create and co-own the evidence that shapes cancer care policy and research.', 'orange', 2024),
  ('00000000-a002-0000-0000-000000000002', 'Equitable Access', 'Removing barriers to diagnostics, trials, and treatments across income levels, geographies, and health system capabilities.', 'blue', 2024),
  ('00000000-a003-0000-0000-000000000003', 'Decision-to-Action Pipeline', 'Converting congress decisions into measurable actions within 48 hours — the operational backbone of governance.', 'emerald', 2025),
  ('00000000-a004-0000-0000-000000000004', 'Cross-Border Collaboration', 'Building durable multi-country alliances around shared cancer priorities.', 'violet', 2024),
  ('00000000-a005-0000-0000-000000000005', 'Platform & Digital Infrastructure', 'Using technology to make collaboration, traceability, and transparency the default.', 'rose', 2025)
ON CONFLICT DO NOTHING;

-- Link themes to events
INSERT INTO congress_event_themes (event_id, theme_id) VALUES
  ((SELECT id FROM congress_events WHERE year = 2024 LIMIT 1), '00000000-a001-0000-0000-000000000001'),
  ((SELECT id FROM congress_events WHERE year = 2024 LIMIT 1), '00000000-a002-0000-0000-000000000002'),
  ((SELECT id FROM congress_events WHERE year = 2024 LIMIT 1), '00000000-a004-0000-0000-000000000004'),
  ((SELECT id FROM congress_events WHERE year = 2025 LIMIT 1), '00000000-a001-0000-0000-000000000001'),
  ((SELECT id FROM congress_events WHERE year = 2025 LIMIT 1), '00000000-a003-0000-0000-000000000003'),
  ((SELECT id FROM congress_events WHERE year = 2025 LIMIT 1), '00000000-a004-0000-0000-000000000004'),
  ((SELECT id FROM congress_events WHERE year = 2026 LIMIT 1), '00000000-a002-0000-0000-000000000002'),
  ((SELECT id FROM congress_events WHERE year = 2026 LIMIT 1), '00000000-a003-0000-0000-000000000003'),
  ((SELECT id FROM congress_events WHERE year = 2026 LIMIT 1), '00000000-a004-0000-0000-000000000004'),
  ((SELECT id FROM congress_events WHERE year = 2026 LIMIT 1), '00000000-a005-0000-0000-000000000005')
ON CONFLICT DO NOTHING;

-- Update existing congress decisions to link to 2026 event
UPDATE congress_decisions
SET event_id = (SELECT id FROM congress_events WHERE year = 2026 LIMIT 1),
    congress_year = 2026
WHERE event_id IS NULL;

-- Update existing congress topics to link to 2026 event
UPDATE congress_topics
SET event_id = (SELECT id FROM congress_events WHERE year = 2026 LIMIT 1)
WHERE event_id IS NULL;

-- ── Seed: congress_sessions for 2026 ─────────────────────────────────────────
INSERT INTO congress_sessions (id, congress_id, event_id, title, session_type, agenda_order, start_time, end_time, room, status, description)
VALUES
  (
    '00000000-b001-0000-0000-000000000001',
    (SELECT id FROM congress_events WHERE year = 2026 LIMIT 1),
    (SELECT id FROM congress_events WHERE year = 2026 LIMIT 1),
    'Opening Plenary: The State of Patient Advocacy 2026',
    'plenary', 1,
    '2026-11-13 09:00:00+00', '2026-11-13 10:00:00+00',
    'Main Hall',
    'planned',
    'Annual keynote reviewing the state of patient advocacy across Inspire2Live initiatives, with spotlight on 2025 congress decision outcomes.'
  ),
  (
    '00000000-b002-0000-0000-000000000002',
    (SELECT id FROM congress_events WHERE year = 2026 LIMIT 1),
    (SELECT id FROM congress_events WHERE year = 2026 LIMIT 1),
    'Workshop: Multi-Stakeholder Initiative Design',
    'workshop', 2,
    '2026-11-13 10:30:00+00', '2026-11-13 12:00:00+00',
    'Room A',
    'planned',
    'Interactive workshop developing templates and principles for building effective cross-border, multi-stakeholder cancer initiatives.'
  ),
  (
    '00000000-b003-0000-0000-000000000003',
    (SELECT id FROM congress_events WHERE year = 2026 LIMIT 1),
    (SELECT id FROM congress_events WHERE year = 2026 LIMIT 1),
    'Panel: Scaling Equitable Access to Diagnostics',
    'panel', 3,
    '2026-11-13 13:30:00+00', '2026-11-13 15:00:00+00',
    'Room B',
    'planned',
    'Expert panel examining what it takes to scale molecular diagnostics access across income levels and health systems.'
  ),
  (
    '00000000-b004-0000-0000-000000000004',
    (SELECT id FROM congress_events WHERE year = 2026 LIMIT 1),
    (SELECT id FROM congress_events WHERE year = 2026 LIMIT 1),
    'Working Group: Decision-to-Task Conversion Review',
    'working_group', 4,
    '2026-11-13 15:30:00+00', '2026-11-13 17:00:00+00',
    'Room C',
    'planned',
    'Structured review of all pending congress decisions from 2025, converting outstanding items to tasks and documenting blockers.'
  ),
  (
    '00000000-b005-0000-0000-000000000005',
    (SELECT id FROM congress_events WHERE year = 2026 LIMIT 1),
    (SELECT id FROM congress_events WHERE year = 2026 LIMIT 1),
    'Keynote: Platform as Infrastructure for Impact',
    'keynote', 5,
    '2026-11-14 09:00:00+00', '2026-11-14 10:00:00+00',
    'Main Hall',
    'planned',
    'Keynote on the Inspire2Live digital platform as the operational backbone of the community — past achievements and future roadmap.'
  ),
  (
    '00000000-b006-0000-0000-000000000006',
    (SELECT id FROM congress_events WHERE year = 2026 LIMIT 1),
    (SELECT id FROM congress_events WHERE year = 2026 LIMIT 1),
    'Closing: Congress Decisions & Commitments',
    'plenary', 6,
    '2026-11-14 15:00:00+00', '2026-11-14 16:30:00+00',
    'Main Hall',
    'planned',
    'Formal capture and ratification of all congress decisions. Every decision is assigned an owner and 48-hour conversion deadline.'
  )
ON CONFLICT DO NOTHING;
