-- ─────────────────────────────────────────────────────────────────────────────
-- WP-4: Bureau + Congress + Notifications
-- Tables: congress_decisions, congress_topics, congress_topic_votes
-- Also ensures notifications table has correct structure (if not in earlier migration)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── notifications (created here if not already in 00001) ─────────────────────
-- Ensure columns if table existed with different schema
ALTER TABLE IF EXISTS notifications ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS notifications ADD COLUMN IF NOT EXISTS initiative_id uuid REFERENCES initiatives(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS notifications ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE IF EXISTS notifications ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE IF EXISTS notifications ADD COLUMN IF NOT EXISTS body text;
ALTER TABLE IF EXISTS notifications ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS notifications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  initiative_id    uuid REFERENCES initiatives(id) ON DELETE SET NULL,
  type             text NOT NULL,            -- task_assigned | task_overdue | milestone_due | discussion_reply | member_joined | decision_pending | inactivity_alert
  title            text NOT NULL,
  body             text,
  is_read          boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx  ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_is_read_idx  ON notifications(user_id, is_read) WHERE is_read = false;

-- ── congress_decisions ────────────────────────────────────────────────────────
-- Ensure columns if table existed with different schema
ALTER TABLE IF EXISTS congress_decisions ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE IF EXISTS congress_decisions ADD COLUMN IF NOT EXISTS body text;
ALTER TABLE IF EXISTS congress_decisions ADD COLUMN IF NOT EXISTS initiative_id uuid REFERENCES initiatives(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS congress_decisions ADD COLUMN IF NOT EXISTS session_date date;
ALTER TABLE IF EXISTS congress_decisions ADD COLUMN IF NOT EXISTS captured_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS congress_decisions ADD COLUMN IF NOT EXISTS conversion_status text NOT NULL DEFAULT 'pending';
ALTER TABLE IF EXISTS congress_decisions ADD COLUMN IF NOT EXISTS converted_task_id uuid REFERENCES tasks(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS congress_decisions ADD COLUMN IF NOT EXISTS converted_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS congress_decisions ADD COLUMN IF NOT EXISTS converted_at timestamptz;

CREATE TABLE IF NOT EXISTS congress_decisions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title               text NOT NULL,
  body                text,
  initiative_id       uuid REFERENCES initiatives(id) ON DELETE SET NULL,
  session_date        date,
  captured_at         timestamptz NOT NULL DEFAULT now(),
  conversion_status   text NOT NULL DEFAULT 'pending',   -- pending | converted | needs_clarification | declined
  converted_task_id   uuid REFERENCES tasks(id) ON DELETE SET NULL,
  converted_by        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  converted_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT congress_decisions_conversion_status_check CHECK (
    conversion_status IN ('pending', 'converted', 'needs_clarification', 'declined')
  )
);

CREATE INDEX IF NOT EXISTS congress_decisions_initiative_idx ON congress_decisions(initiative_id);
CREATE INDEX IF NOT EXISTS congress_decisions_status_idx ON congress_decisions(conversion_status);

-- ── congress_topics ───────────────────────────────────────────────────────────
-- Ensure missing columns if table already existed without them
ALTER TABLE IF EXISTS congress_topics ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS congress_topics ADD COLUMN IF NOT EXISTS initiative_id uuid REFERENCES initiatives(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS congress_topics ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'submitted';
ALTER TABLE IF EXISTS congress_topics ADD COLUMN IF NOT EXISTS vote_count integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS congress_topics ADD COLUMN IF NOT EXISTS session_date date;
ALTER TABLE IF EXISTS congress_topics ADD COLUMN IF NOT EXISTS resolution text;
ALTER TABLE IF EXISTS congress_topics ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS congress_topics (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text NOT NULL,
  description      text,
  submitted_by     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  initiative_id    uuid REFERENCES initiatives(id) ON DELETE SET NULL,
  status           text NOT NULL DEFAULT 'submitted',    -- submitted | approved | rejected | discussing | resolved
  vote_count       integer NOT NULL DEFAULT 0,
  session_date     date,
  resolution       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT congress_topics_status_check CHECK (
    status IN ('submitted', 'approved', 'rejected', 'discussing', 'resolved')
  )
);

CREATE INDEX IF NOT EXISTS congress_topics_status_idx ON congress_topics(status);
CREATE INDEX IF NOT EXISTS congress_topics_submitted_by_idx ON congress_topics(submitted_by);

-- ── congress_topic_votes ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS congress_topic_votes (
  topic_id   uuid NOT NULL REFERENCES congress_topics(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (topic_id, user_id)
);

-- Trigger: keep congress_topics.vote_count in sync
CREATE OR REPLACE FUNCTION update_topic_vote_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE congress_topics SET vote_count = vote_count + 1 WHERE id = NEW.topic_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE congress_topics SET vote_count = GREATEST(vote_count - 1, 0) WHERE id = OLD.topic_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_topic_vote_count ON congress_topic_votes;
CREATE TRIGGER trg_topic_vote_count
  AFTER INSERT OR DELETE ON congress_topic_votes
  FOR EACH ROW EXECUTE FUNCTION update_topic_vote_count();

-- ── RLS Policies ──────────────────────────────────────────────────────────────
ALTER TABLE notifications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE congress_decisions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE congress_topics        ENABLE ROW LEVEL SECURITY;
ALTER TABLE congress_topic_votes   ENABLE ROW LEVEL SECURITY;

-- Notifications: users see only their own
DROP POLICY IF EXISTS "users_read_own_notifications" ON notifications;
CREATE POLICY "users_read_own_notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_notifications" ON notifications;
CREATE POLICY "users_update_own_notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Congress decisions: all authenticated users can read
DROP POLICY IF EXISTS "auth_read_congress_decisions" ON congress_decisions;
CREATE POLICY "auth_read_congress_decisions" ON congress_decisions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Congress decisions: only coordinators/admins can insert/update
DROP POLICY IF EXISTS "coordinators_manage_congress_decisions" ON congress_decisions;
CREATE POLICY "coordinators_manage_congress_decisions" ON congress_decisions
  FOR ALL USING (is_coordinator_or_admin());

-- Congress topics: all authenticated users can read
DROP POLICY IF EXISTS "auth_read_congress_topics" ON congress_topics;
CREATE POLICY "auth_read_congress_topics" ON congress_topics
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Congress topics: any authenticated user can submit
DROP POLICY IF EXISTS "auth_insert_congress_topics" ON congress_topics;
CREATE POLICY "auth_insert_congress_topics" ON congress_topics
  FOR INSERT WITH CHECK (auth.uid() = submitted_by);

-- Congress topics: owner or coordinator can update
DROP POLICY IF EXISTS "owner_or_coordinator_update_topic" ON congress_topics;
CREATE POLICY "owner_or_coordinator_update_topic" ON congress_topics
  FOR UPDATE USING (auth.uid() = submitted_by OR is_coordinator_or_admin());

-- Topic votes: users manage their own votes
DROP POLICY IF EXISTS "users_manage_own_votes" ON congress_topic_votes;
CREATE POLICY "users_manage_own_votes" ON congress_topic_votes
  FOR ALL USING (auth.uid() = user_id);

-- ── Seed Data: Congress Decisions ─────────────────────────────────────────────
-- Uses the initiative IDs from WP-3 seed (00006_wp3_initiative_seed.sql)
-- Initiatives seeded in WP-3:
--   MCED   → 'init-mced-2024'  (temporary label; actual uuid assigned by Supabase)
--   MDx EU → 'init-mdx-2024'
--   PROM   → 'init-prom-2024'
-- We reference by subquery to remain portable.

INSERT INTO congress_sessions (
  id,
  congress_id,
  title,
  description,
  start_time,
  end_time,
  room,
  session_lead_id,
  note_taker_id,
  decision_capture_id
)
VALUES (
  '40000000-0000-0000-0000-000000000101',
  (SELECT id FROM congress_events WHERE year = 2026 LIMIT 1),
  'Congress Decisions Review',
  'Structured decision review session used to seed congress decision follow-up data.',
  '2026-02-07 09:00:00+00',
  '2026-02-07 17:00:00+00',
  'Main Hall',
  (SELECT id FROM profiles WHERE email = 'sophie@inspire2live.org' LIMIT 1),
  (SELECT id FROM profiles WHERE email = 'sophie@inspire2live.org' LIMIT 1),
  (SELECT id FROM profiles WHERE email = 'sophie@inspire2live.org' LIMIT 1)
)
ON CONFLICT (id) DO NOTHING;

WITH
  mced AS (SELECT id FROM initiatives WHERE slug = 'mced-patient-voice-2024' LIMIT 1),
  mdx  AS (SELECT id FROM initiatives WHERE slug = 'molecular-dx-eu-access' LIMIT 1),
  prom AS (SELECT id FROM initiatives WHERE slug = 'prom-standardisation' LIMIT 1)
INSERT INTO congress_decisions (
  session_id,
  description,
  proposed_by,
  initiative_id,
  captured_at,
  conversion_status,
  title,
  body,
  session_date
)
VALUES
  (
    '40000000-0000-0000-0000-000000000101',
    'Mandate translation of all patient-facing MCED materials into 6 EU languages',
    'Congress bureau',
    (SELECT id FROM mced),
    '2026-01-17 10:30:00+00',
    'converted',
    'Mandate translation of all patient-facing MCED materials into 6 EU languages',
    'Congress agreed that all materials produced under the MCED initiative must be translated into DE, FR, ES, IT, NL, PL before distribution. Responsibility assigned to Hub Coordinator.',
    '2026-01-17'
  ),
  (
    '40000000-0000-0000-0000-000000000101',
    'Establish quarterly patient-reported outcomes review cadence for MCED',
    'Congress bureau',
    (SELECT id FROM mced),
    '2026-01-17 11:15:00+00',
    'pending',
    'Establish quarterly patient-reported outcomes review cadence for MCED',
    'A standing quarterly review of patient-reported outcomes data will be integrated into the MCED governance calendar, starting Q2 2026.',
    '2026-01-17'
  ),
  (
    '40000000-0000-0000-0000-000000000101',
    'Pilot Molecular Diagnostics reimbursement model in 3 member states',
    'Congress bureau',
    (SELECT id FROM mdx),
    '2026-01-17 14:00:00+00',
    'converted',
    'Pilot Molecular Diagnostics reimbursement model in 3 member states',
    'Congress approved a 6-month pilot of a harmonised reimbursement advocacy model for liquid biopsy across BE, NL, AT. Results to be reviewed at next congress.',
    '2026-01-17'
  ),
  (
    '40000000-0000-0000-0000-000000000101',
    'Approve formal partnership with ESMO for molecular diagnostics guideline development',
    'Congress bureau',
    (SELECT id FROM mdx),
    '2026-01-17 15:30:00+00',
    'needs_clarification',
    'Approve formal partnership with ESMO for molecular diagnostics guideline development',
    'Pending legal review of the ESMO partnership framework. Congress to reconvene on this decision once neutrality review completes.',
    '2026-01-17'
  ),
  (
    '40000000-0000-0000-0000-000000000101',
    'Adopt EQ-5D-5L and EORTC QLQ-C30 as mandatory PROM instruments',
    'Congress bureau',
    (SELECT id FROM prom),
    '2026-02-07 09:45:00+00',
    'converted',
    'Adopt EQ-5D-5L and EORTC QLQ-C30 as mandatory PROM instruments',
    'After reviewing patient input from the PROM working group, Congress mandated use of EQ-5D-5L and EORTC QLQ-C30 as the baseline PROM battery across all initiatives.',
    '2026-02-07'
  ),
  (
    '40000000-0000-0000-0000-000000000101',
    'Commission systematic review of cancer-specific PROM validation literature',
    'Congress bureau',
    (SELECT id FROM prom),
    '2026-02-07 11:00:00+00',
    'pending',
    'Commission systematic review of cancer-specific PROM validation literature',
    'A systematic literature review of validated PROMs for breast, lung, and colorectal cancer will be commissioned, to be completed by Q3 2026.',
    '2026-02-07'
  ),
  (
    '40000000-0000-0000-0000-000000000101',
    'Allocate dedicated Congress session to platform progress review',
    'Congress bureau',
    NULL,
    '2026-02-07 16:00:00+00',
    'pending',
    'Allocate dedicated Congress session to platform progress review',
    'A 30-minute standing agenda item for platform KPI review will be added to each Congress session from March 2026 onward.',
    '2026-02-07'
  );

-- ── Seed Data: Congress Topics ────────────────────────────────────────────────
-- submitted_by references seeded demo users from WP-3 seed
-- Using subquery on profiles.email
INSERT INTO congress_topics (
  congress_id,
  submitter_id,
  title,
  description,
  related_initiative_id,
  status,
  vote_count,
  created_at
)
VALUES
  (
    (SELECT id FROM congress_events WHERE year = 2026 LIMIT 1),
    (SELECT id FROM profiles WHERE email = 'sophie@inspire2live.org' LIMIT 1),
    'Unified digital consent framework for multi-country studies',
    'We currently have inconsistent consent processes across member states. Propose that Congress endorses a unified digital consent framework aligned with GDPR Art.9 for all initiative data collection activities.',
    NULL,
    'accepted',
    12,
    '2026-02-01 08:00:00+00'
  ),
  (
    (SELECT id FROM congress_events WHERE year = 2026 LIMIT 1),
    (SELECT id FROM profiles WHERE email = 'maria@inspire2live.org' LIMIT 1),
    'Mandate bi-annual patient experience surveys for all active initiatives',
    'To ensure we maintain authentic patient-centred governance, propose mandatory bi-annual patient experience surveys with results shared at Congress.',
    (SELECT id FROM initiatives WHERE slug = 'mced-patient-voice-2024' LIMIT 1),
    'under_review',
    9,
    '2026-02-03 10:00:00+00'
  ),
  (
    (SELECT id FROM congress_events WHERE year = 2026 LIMIT 1),
    (SELECT id FROM profiles WHERE email = 'sophie@inspire2live.org' LIMIT 1),
    'Create an industry partner advisory council with non-voting observer status',
    'Industry partners bring expertise but must remain non-voting to preserve integrity. Propose formalising an advisory council with quarterly input sessions and observer status at Congress.',
    NULL,
    'submitted',
    7,
    '2026-02-05 14:00:00+00'
  ),
  (
    (SELECT id FROM congress_events WHERE year = 2026 LIMIT 1),
    (SELECT id FROM profiles WHERE email = 'kai@inspire2live.org' LIMIT 1),
    'Establish PROM data sharing agreement with academic cancer registries',
    'Sharing anonymised PROM data with academic registries would accelerate research. Request Congress approval for a standard data-sharing agreement template.',
    (SELECT id FROM initiatives WHERE slug = 'prom-standardisation' LIMIT 1),
    'submitted',
    5,
    '2026-02-10 09:00:00+00'
  ),
  (
    (SELECT id FROM congress_events WHERE year = 2026 LIMIT 1),
    (SELECT id FROM profiles WHERE email = 'peter@inspire2live.org' LIMIT 1),
    'Publish annual platform transparency report',
    'To maintain stakeholder trust, Inspire2Live should publish an annual transparency report covering governance decisions, partner interactions, and initiative outcomes.',
    NULL,
    'submitted',
    4,
    '2026-02-12 11:00:00+00'
  );

-- ── Seed Data: Notifications (for demo personas) ──────────────────────────────
-- Sophie (coordinator) gets Bureau and decision alerts
-- Maria (advocate) gets task and milestone alerts
INSERT INTO notifications (user_id, initiative_id, type, title, body, is_read, created_at)
VALUES
  -- Sophie notifications
  (
    (SELECT id FROM profiles WHERE email = 'sophie@inspire2live.org' LIMIT 1),
    (SELECT id FROM initiatives WHERE slug = 'mced-patient-voice-2024' LIMIT 1),
    'task_assigned',
    'Task overdue: Conduct baseline PRA literature review',
    'This task has been overdue for 3 days. The owner has not logged any activity.',
    false,
    now() - interval '2 hours'
  ),
  (
    (SELECT id FROM profiles WHERE email = 'sophie@inspire2live.org' LIMIT 1),
    (SELECT id FROM initiatives WHERE slug = 'molecular-dx-eu-access' LIMIT 1),
    'inactivity_nudge',
    'Inactivity alert: James Thornton (18 days inactive)',
    'James Thornton has not accessed the platform in 18 days. Consider sending a nudge.',
    false,
    now() - interval '4 hours'
  ),
  (
    (SELECT id FROM profiles WHERE email = 'sophie@inspire2live.org' LIMIT 1),
    NULL,
    'decision_flagged',
    'Congress decision pending conversion (48h)',
    '"Establish quarterly patient-reported outcomes review cadence" was captured 49 hours ago and has not been converted to a task.',
    false,
    now() - interval '1 hour'
  ),
  (
    (SELECT id FROM profiles WHERE email = 'sophie@inspire2live.org' LIMIT 1),
    (SELECT id FROM initiatives WHERE slug = 'prom-standardisation' LIMIT 1),
    'milestone_approaching',
    'Milestone due in 5 days: PROM instrument validation report',
    'The "PROM instrument validation report" milestone is due on 2026-02-24. 2 tasks remain open.',
    true,
    now() - interval '1 day'
  ),
  -- Maria notifications
  (
    (SELECT id FROM profiles WHERE email = 'maria@inspire2live.org' LIMIT 1),
    (SELECT id FROM initiatives WHERE slug = 'mced-patient-voice-2024' LIMIT 1),
    'task_assigned',
    'New task assigned: Review MCED patient survey draft',
    'Sophie has assigned you to review the MCED patient survey draft. Due in 7 days.',
    false,
    now() - interval '3 hours'
  ),
  (
    (SELECT id FROM profiles WHERE email = 'maria@inspire2live.org' LIMIT 1),
    (SELECT id FROM initiatives WHERE slug = 'mced-patient-voice-2024' LIMIT 1),
    'new_discussion',
    'New reply in: Inclusion criteria for rare cancer subtypes',
    'Dr. Elena Vasquez replied to your comment: "I agree with your concern about the current wording — let me propose revised language."',
    false,
    now() - interval '6 hours'
  ),
  (
    (SELECT id FROM profiles WHERE email = 'maria@inspire2live.org' LIMIT 1),
    NULL,
    'initiative_joined',
    'New member joined Inspire2Live: Amara Osei',
    'Amara Osei (Patient Advocate, Ghana) has joined the platform and is requesting to join the MCED initiative.',
    true,
    now() - interval '2 days'
  );
