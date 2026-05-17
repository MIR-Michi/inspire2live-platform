-- ─────────────────────────────────────────────────────────────────────────────
-- WP-5: Resource Library + Partner Portal
-- New tables: resource_translations, partner_applications, partner_audit_log
-- Extends: resources (adds version, translation_status, is_partner_contribution,
--          partner_org, superseded, cancer_type columns if not present)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Extend resources table with WP-5 columns ──────────────────────────────────
ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS version              text    NOT NULL DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS translation_status   text    NOT NULL DEFAULT 'needed',
  ADD COLUMN IF NOT EXISTS is_partner_contribution boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS partner_org          text,
  ADD COLUMN IF NOT EXISTS superseded           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancer_type          text,
  ADD COLUMN IF NOT EXISTS superseded_by        uuid REFERENCES resources(id) ON DELETE SET NULL;

-- ── resource_translations ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resource_translations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  language    text NOT NULL,
  status      text NOT NULL DEFAULT 'needed',  -- needed | in_progress | complete
  file_url    text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource_id, language),
  CONSTRAINT resource_translations_status_check CHECK (
    status IN ('needed', 'in_progress', 'complete')
  )
);

CREATE INDEX IF NOT EXISTS resource_translations_resource_idx ON resource_translations(resource_id);

-- ── partner_applications ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS partner_applications (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_name                text NOT NULL,
  contact_name            text NOT NULL,
  contact_email           text NOT NULL,
  scope                   text NOT NULL,
  neutrality_declaration  boolean NOT NULL DEFAULT false,
  compliance_note         text,
  compliance_doc_url      text,
  status                  text NOT NULL DEFAULT 'submitted',  -- submitted | under_review | approved | clarify | declined
  review_note             text,
  submitted_by_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewed_by_id          uuid REFERENCES profiles(id) ON DELETE SET NULL,
  initiative_id           uuid REFERENCES initiatives(id) ON DELETE SET NULL,
  submitted_at            timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partner_applications_status_check CHECK (
    status IN ('submitted', 'under_review', 'approved', 'clarify', 'declined')
  )
);

-- Aliases to match FK names used in page selects
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'partner_applications_submitted_by_id_fkey'
  ) THEN
    ALTER TABLE partner_applications
      RENAME CONSTRAINT partner_applications_submitted_by_id_fkey
      TO partner_applications_submitted_by_fkey;
  END IF;
END;
$$;

-- Actually simpler to just create the right view aliases via index
CREATE INDEX IF NOT EXISTS partner_applications_submitted_by_idx ON partner_applications(submitted_by_id);
CREATE INDEX IF NOT EXISTS partner_applications_status_idx       ON partner_applications(status);
CREATE INDEX IF NOT EXISTS partner_applications_initiative_idx   ON partner_applications(initiative_id);

-- ── partner_audit_log ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS partner_audit_log (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_application_id   uuid NOT NULL REFERENCES partner_applications(id) ON DELETE CASCADE,
  actor_id                 uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action                   text NOT NULL,   -- submitted | under_review | approved | clarify | declined | updated
  note                     text,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_audit_log_application_idx ON partner_audit_log(partner_application_id);
CREATE INDEX IF NOT EXISTS partner_audit_log_actor_idx       ON partner_audit_log(actor_id);

-- ── RLS Policies ──────────────────────────────────────────────────────────────
ALTER TABLE resource_translations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_applications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_audit_log      ENABLE ROW LEVEL SECURITY;

-- Resource translations: all authenticated users can read
DROP POLICY IF EXISTS "auth_read_resource_translations" ON resource_translations;
CREATE POLICY "auth_read_resource_translations" ON resource_translations
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Resource translations: coordinators/admins can write
DROP POLICY IF EXISTS "coordinators_manage_resource_translations" ON resource_translations;
CREATE POLICY "coordinators_manage_resource_translations" ON resource_translations
  FOR ALL USING (is_coordinator_or_admin());

-- Partner applications: submitter sees their own; coordinators see all
DROP POLICY IF EXISTS "submitter_or_coordinator_read_apps" ON partner_applications;
CREATE POLICY "submitter_or_coordinator_read_apps" ON partner_applications
  FOR SELECT USING (
    auth.uid() = submitted_by_id OR is_coordinator_or_admin()
  );

DROP POLICY IF EXISTS "auth_insert_partner_application" ON partner_applications;
CREATE POLICY "auth_insert_partner_application" ON partner_applications
  FOR INSERT WITH CHECK (auth.uid() = submitted_by_id);

DROP POLICY IF EXISTS "coordinator_update_partner_application" ON partner_applications;
CREATE POLICY "coordinator_update_partner_application" ON partner_applications
  FOR UPDATE USING (is_coordinator_or_admin());

-- Audit log: coordinators and board members only
DROP POLICY IF EXISTS "governance_read_partner_audit" ON partner_audit_log;
CREATE POLICY "governance_read_partner_audit" ON partner_audit_log
  FOR SELECT USING (is_coordinator_or_admin());

DROP POLICY IF EXISTS "coordinator_insert_partner_audit" ON partner_audit_log;
CREATE POLICY "coordinator_insert_partner_audit" ON partner_audit_log
  FOR INSERT WITH CHECK (is_coordinator_or_admin());

-- ── Trigger: auto-log status changes on partner_applications ──────────────────
CREATE OR REPLACE FUNCTION log_partner_application_status_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO partner_audit_log (partner_application_id, actor_id, action, note)
    VALUES (NEW.id, auth.uid(), NEW.status, NEW.review_note);
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partner_app_status ON partner_applications;
CREATE TRIGGER trg_partner_app_status
  BEFORE UPDATE ON partner_applications
  FOR EACH ROW EXECUTE FUNCTION log_partner_application_status_change();

-- ── Seed Data: Resources ──────────────────────────────────────────────────────
-- Adds version/translation/partner columns to WP-3 seed resources
-- and inserts new library resources.
-- First update existing resources from WP-3 seed (seeded in 00005/00006)
UPDATE resources SET
  version = COALESCE(version, 1),
  translation_status = 'needs_translation',
  is_partner_contribution = false,
  superseded = false
WHERE version IS NULL OR translation_status NOT IN ('original', 'translated', 'needs_translation');

-- Insert new WP-5 library resources
WITH
  mced AS (SELECT id FROM initiatives WHERE slug = 'mced-patient-voice-2024' LIMIT 1),
  mdx  AS (SELECT id FROM initiatives WHERE slug = 'molecular-dx-eu-access' LIMIT 1),
  prom AS (SELECT id FROM initiatives WHERE slug = 'prom-standardisation' LIMIT 1),
  sophie AS (SELECT id FROM profiles WHERE email = 'sophie@inspire2live.org' LIMIT 1)
INSERT INTO resources (
  title,
  type,
  uploaded_by_id,
  language,
  version,
  cancer_types,
  translation_status,
  is_partner_contribution,
  partner_organization,
  superseded,
  initiative_id,
  created_at
)
VALUES
  -- MCED resources
  (
    'MCED Patient Information Leaflet v2 — English',
    'report', (SELECT id FROM sophie), 'en', 2, ARRAY['breast']::text[], 'translated',
    false, NULL, false,
    (SELECT id FROM mced), '2026-01-10 09:00:00+00'
  ),
  (
    'MCED Patient Information Leaflet v2 — German',
    'report', (SELECT id FROM sophie), 'de', 2, ARRAY['breast']::text[], 'translated',
    false, NULL, false,
    (SELECT id FROM mced), '2026-01-15 09:00:00+00'
  ),
  (
    'MCED Patient Information Leaflet v1 — English (superseded)',
    'report', (SELECT id FROM sophie), 'en', 1, ARRAY['breast']::text[], 'translated',
    false, NULL, true,
    (SELECT id FROM mced), '2025-10-01 09:00:00+00'
  ),
  (
    'MCED Inclusion Criteria Protocol v1.2',
    'document', (SELECT id FROM sophie), 'en', 1, NULL, 'needs_translation',
    false, NULL, false,
    (SELECT id FROM mced), '2026-01-20 09:00:00+00'
  ),
  -- MDx EU resources
  (
    'Molecular Diagnostics EU Access Report 2025',
    'report', (SELECT id FROM sophie), 'en', 1, ARRAY['lung']::text[], 'needs_translation',
    false, NULL, false,
    (SELECT id FROM mdx), '2026-01-05 09:00:00+00'
  ),
  (
    'Liquid Biopsy Reimbursement Advocacy Toolkit',
    'template', (SELECT id FROM sophie), 'en', 1, NULL, 'needs_translation',
    true, 'Roche Diagnostics GmbH', false,
    (SELECT id FROM mdx), '2026-01-22 09:00:00+00'
  ),
  (
    'MDx EU Clinical Evidence Summary — Partner Contribution',
    'document', (SELECT id FROM sophie), 'en', 1, ARRAY['colorectal']::text[], 'needs_translation',
    true, 'Illumina Europe Ltd', false,
    (SELECT id FROM mdx), '2026-01-25 09:00:00+00'
  ),
  -- PROM resources
  (
    'EQ-5D-5L Implementation Guide for Cancer Studies',
    'document', (SELECT id FROM sophie), 'en', 1, NULL, 'needs_translation',
    false, NULL, false,
    (SELECT id FROM prom), '2026-02-01 09:00:00+00'
  ),
  (
    'PROM Data Collection Template — Multi-language',
    'template', (SELECT id FROM sophie), 'en', 1, NULL, 'translated',
    false, NULL, false,
    (SELECT id FROM prom), '2026-02-05 09:00:00+00'
  ),
  (
    'PROM Validation Literature Review — Breast Cancer',
    'document', (SELECT id FROM sophie), 'en', 1, ARRAY['breast']::text[], 'needs_translation',
    false, NULL, false,
    (SELECT id FROM prom), '2026-02-10 09:00:00+00'
  ),
  -- Platform-wide
  (
    'Inspire2Live Governance Framework v3',
    'document', (SELECT id FROM sophie), 'en', 3, NULL, 'translated',
    false, NULL, false,
    NULL, '2025-09-01 09:00:00+00'
  ),
  (
    'Patient Engagement Best Practices — Presentation',
    'recording', (SELECT id FROM sophie), 'en', 1, NULL, 'needs_translation',
    false, NULL, false,
    NULL, '2026-01-08 09:00:00+00'
  );

-- ── Seed Data: Resource Translations ─────────────────────────────────────────
-- Add translation records for the MCED leaflet
INSERT INTO resource_translations (resource_id, language, status, created_at)
SELECT r.id, 'de', 'complete', '2026-01-15 09:00:00+00'
FROM resources r WHERE r.title = 'MCED Patient Information Leaflet v2 — English' LIMIT 1;

INSERT INTO resource_translations (resource_id, language, status, created_at)
SELECT r.id, 'fr', 'in_progress', '2026-01-20 09:00:00+00'
FROM resources r WHERE r.title = 'MCED Patient Information Leaflet v2 — English' LIMIT 1;

INSERT INTO resource_translations (resource_id, language, status, created_at)
SELECT r.id, 'es', 'needed', '2026-01-20 09:00:00+00'
FROM resources r WHERE r.title = 'MCED Patient Information Leaflet v2 — English' LIMIT 1;

INSERT INTO resource_translations (resource_id, language, status, created_at)
SELECT r.id, 'nl', 'needed', '2026-01-20 09:00:00+00'
FROM resources r WHERE r.title = 'MCED Patient Information Leaflet v2 — English' LIMIT 1;

INSERT INTO resource_translations (resource_id, language, status, created_at)
SELECT r.id, 'pl', 'needed', '2026-01-20 09:00:00+00'
FROM resources r WHERE r.title = 'MCED Patient Information Leaflet v2 — English' LIMIT 1;

-- ── Seed Data: Partner Applications ──────────────────────────────────────────
INSERT INTO partner_applications
  (org_name, contact_name, contact_email, scope, neutrality_declaration, status, review_note, submitted_by_id, initiative_id, submitted_at)
VALUES
  (
    'Roche Diagnostics GmbH',
    'Dr. Markus Schneider',
    'markus.schneider@roche.com',
    'Provision of liquid biopsy technical data and support materials for the Molecular Diagnostics EU Access initiative. No commercial claims to be made from outputs. All contributions will be labelled as Partner Contribution.',
    true, 'approved',
    'Application reviewed and approved by Bureau on 2026-01-20. Scope is clearly bounded and neutrality declaration accepted.',
    (SELECT id FROM profiles WHERE email = 'sophie@inspire2live.org' LIMIT 1),
    (SELECT id FROM initiatives WHERE slug = 'molecular-dx-eu-access' LIMIT 1),
    '2026-01-10 10:00:00+00'
  ),
  (
    'Illumina Europe Ltd',
    'Sarah O''Brien',
    'sarah.obrien@illumina.com',
    'Co-authorship contribution to the clinical evidence summary for molecular diagnostics access in the EU. Organisation will provide sequencing data analysis methodology. No editorial control over final outputs.',
    true, 'approved',
    'Approved with condition: all Illumina contributions labelled separately. Data sharing agreement to be signed before access granted.',
    (SELECT id FROM profiles WHERE email = 'sophie@inspire2live.org' LIMIT 1),
    (SELECT id FROM initiatives WHERE slug = 'molecular-dx-eu-access' LIMIT 1),
    '2026-01-14 14:00:00+00'
  ),
  (
    'AstraZeneca Oncology',
    'Dr. Priya Mehta',
    'priya.mehta@astrazeneca.com',
    'Request to co-sponsor the PROM standardisation initiative and contribute validated PROM datasets from the BEACON trial. Seeking observer status at working group sessions.',
    true, 'clarify',
    'Bureau requests clarification on the data provenance of the BEACON trial datasets and confirmation that patient consent covers secondary use in advocacy research.',
    (SELECT id FROM profiles WHERE email = 'sophie@inspire2live.org' LIMIT 1),
    (SELECT id FROM initiatives WHERE slug = 'prom-standardisation' LIMIT 1),
    '2026-02-08 09:00:00+00'
  ),
  (
    'Janssen Pharmaceutica NV',
    'Thomas van der Berg',
    'thomas.vanderberg@janssen.com',
    'Request to provide translation funding and project management support for the MCED Patient Information Leaflet localisation project (DE, FR, ES, NL, PL).',
    true, 'submitted', NULL,
    (SELECT id FROM profiles WHERE email = 'sophie@inspire2live.org' LIMIT 1),
    (SELECT id FROM initiatives WHERE slug = 'mced-patient-voice-2024' LIMIT 1),
    '2026-02-15 11:00:00+00'
  );

-- ── Seed Data: Partner Audit Log ──────────────────────────────────────────────
WITH sophie AS (SELECT id FROM profiles WHERE email = 'sophie@inspire2live.org' LIMIT 1)
INSERT INTO partner_audit_log (partner_application_id, actor_id, action, note, created_at)
SELECT
  pa.id,
  (SELECT id FROM sophie),
  'submitted',
  'Application received and forwarded to Bureau for review.',
  pa.submitted_at
FROM partner_applications pa;

-- Log approval events
WITH sophie AS (SELECT id FROM profiles WHERE email = 'sophie@inspire2live.org' LIMIT 1)
INSERT INTO partner_audit_log (partner_application_id, actor_id, action, note, created_at)
SELECT
  pa.id,
  (SELECT id FROM sophie),
  pa.status,
  pa.review_note,
  pa.submitted_at + interval '5 days'
FROM partner_applications pa
WHERE pa.status IN ('approved', 'clarify');
