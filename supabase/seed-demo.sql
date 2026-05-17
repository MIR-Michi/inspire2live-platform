-- ============================================================
-- SEED-DEMO: Create demo accounts with passwords for login
-- Run this in Supabase SQL Editor to populate demo data
-- Password for all accounts: demo1234
-- ============================================================
-- NOTE: This uses Supabase's internal auth schema.
-- The encrypted_password is bcrypt hash of 'demo1234'
-- Generated with: SELECT crypt('demo1234', gen_salt('bf'));

-- ── Demo Auth Users with passwords ──────────────────────────
-- These match the personas from 00006_wp3_initiative_seed.sql

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, role, aud, created_at, updated_at,
  confirmation_token, recovery_token, is_anonymous
) VALUES
  (
    'a0000001-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'sophie@inspire2live.org',
    '$2a$10$PwC3lGPQtPNbVWGMpGBkaOKqFoFk5IROS.PLkpjLOEoQEKvJf6k8a',
    now(),
    '{"name":"Sophie van der Berg","role":"HubCoordinator","country":"NL"}'::jsonb,
    'authenticated', 'authenticated', now(), now(),
    '', '', false
  ),
  (
    'a0000001-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'maria@inspire2live.org',
    '$2a$10$PwC3lGPQtPNbVWGMpGBkaOKqFoFk5IROS.PLkpjLOEoQEKvJf6k8a',
    now(),
    '{"name":"Maria Hofer","role":"PatientAdvocate","country":"AT"}'::jsonb,
    'authenticated', 'authenticated', now(), now(),
    '', '', false
  ),
  (
    'a0000001-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'peter@inspire2live.org',
    '$2a$10$PwC3lGPQtPNbVWGMpGBkaOKqFoFk5IROS.PLkpjLOEoQEKvJf6k8a',
    now(),
    '{"name":"Peter Lindqvist","role":"BoardMember","country":"SE"}'::jsonb,
    'authenticated', 'authenticated', now(), now(),
    '', '', false
  ),
  (
    'a0000001-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'kai@inspire2live.org',
    '$2a$10$PwC3lGPQtPNbVWGMpGBkaOKqFoFk5IROS.PLkpjLOEoQEKvJf6k8a',
    now(),
    '{"name":"Dr. Kai Bergmann","role":"Researcher","country":"DE"}'::jsonb,
    'authenticated', 'authenticated', now(), now(),
    '', '', false
  ),
  (
    'a0000001-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000000',
    'nadia@inspire2live.org',
    '$2a$10$PwC3lGPQtPNbVWGMpGBkaOKqFoFk5IROS.PLkpjLOEoQEKvJf6k8a',
    now(),
    '{"name":"Dr. Nadia Rousseau","role":"Clinician","country":"FR"}'::jsonb,
    'authenticated', 'authenticated', now(), now(),
    '', '', false
  ),
  (
    'a0000001-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000000',
    'admin@inspire2live.org',
    '$2a$10$PwC3lGPQtPNbVWGMpGBkaOKqFoFk5IROS.PLkpjLOEoQEKvJf6k8a',
    now(),
    '{"name":"Platform Admin","role":"PlatformAdmin","country":"NL"}'::jsonb,
    'authenticated', 'authenticated', now(), now(),
    '', '', false
  ),
  (
    'a0000001-0000-0000-0000-000000000007',
    '00000000-0000-0000-0000-000000000000',
    'atefeh@inspire2live.org',
    '$2a$10$PwC3lGPQtPNbVWGMpGBkaOKqFoFk5IROS.PLkpjLOEoQEKvJf6k8a',
    now(),
    '{"name":"Atefeh Rahimi","role":"Moderator","country":"NL","comms_team":true}'::jsonb,
    'authenticated', 'authenticated', now(), now(),
    '', '', false
  )
ON CONFLICT (id) DO NOTHING;

-- Also insert into auth.identities (required by Supabase auth)
INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001',
   '{"sub":"a0000001-0000-0000-0000-000000000001","email":"sophie@inspire2live.org"}'::jsonb,
   'email', 'a0000001-0000-0000-0000-000000000001', now(), now(), now()),
  ('a0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000002',
   '{"sub":"a0000001-0000-0000-0000-000000000002","email":"maria@inspire2live.org"}'::jsonb,
   'email', 'a0000001-0000-0000-0000-000000000002', now(), now(), now()),
  ('a0000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000003',
   '{"sub":"a0000001-0000-0000-0000-000000000003","email":"peter@inspire2live.org"}'::jsonb,
   'email', 'a0000001-0000-0000-0000-000000000003', now(), now(), now()),
  ('a0000001-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000004',
   '{"sub":"a0000001-0000-0000-0000-000000000004","email":"kai@inspire2live.org"}'::jsonb,
   'email', 'a0000001-0000-0000-0000-000000000004', now(), now(), now()),
  ('a0000001-0000-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000005',
   '{"sub":"a0000001-0000-0000-0000-000000000005","email":"nadia@inspire2live.org"}'::jsonb,
   'email', 'a0000001-0000-0000-0000-000000000005', now(), now(), now()),
  ('a0000001-0000-0000-0000-000000000006', 'a0000001-0000-0000-0000-000000000006',
   '{"sub":"a0000001-0000-0000-0000-000000000006","email":"admin@inspire2live.org"}'::jsonb,
   'email', 'a0000001-0000-0000-0000-000000000006', now(), now(), now()),
  ('a0000001-0000-0000-0000-000000000007', 'a0000001-0000-0000-0000-000000000007',
   '{"sub":"a0000001-0000-0000-0000-000000000007","email":"atefeh@inspire2live.org"}'::jsonb,
   'email', 'a0000001-0000-0000-0000-000000000007', now(), now(), now())
ON CONFLICT (id) DO NOTHING;

-- ── Profiles (trigger may auto-create, but we ensure completeness) ──────
INSERT INTO public.profiles (
  id,
  name,
  email,
  role,
  organization,
  country,
  city,
  expertise_tags,
  bio,
  onboarding_completed,
  last_active_at,
  comms_team
)
VALUES
  ('a0000001-0000-0000-0000-000000000001', 'Sophie van der Berg', 'sophie@inspire2live.org', 'HubCoordinator', 'Inspire2Live Foundation', 'NL', 'Amsterdam', ARRAY['coordination','patient-engagement','research-translation'], 'Hub Coordinator for the Netherlands. Passionate about connecting patients with researchers.', true, now() - interval '1 day', false),
  ('a0000001-0000-0000-0000-000000000002', 'Maria Hofer', 'maria@inspire2live.org', 'PatientAdvocate', 'Austrian Cancer Aid', 'AT', 'Vienna', ARRAY['breast-cancer','patient-voice','advocacy'], 'Patient advocate with 8 years experience in breast cancer communities.', true, now() - interval '3 days', false),
  ('a0000001-0000-0000-0000-000000000003', 'Peter Lindqvist', 'peter@inspire2live.org', 'BoardMember', 'Nordic Oncology Foundation', 'SE', 'Stockholm', ARRAY['governance','funding','strategy'], 'Board member focused on sustainable funding for patient-led research.', true, now() - interval '10 days', false),
  ('a0000001-0000-0000-0000-000000000004', 'Dr. Kai Bergmann', 'kai@inspire2live.org', 'Researcher', 'Charite Berlin', 'DE', 'Berlin', ARRAY['molecular-diagnostics','liquid-biopsy','MCED'], 'Translational researcher specialising in multi-cancer early detection technologies.', true, now() - interval '2 days', false),
  ('a0000001-0000-0000-0000-000000000005', 'Dr. Nadia Rousseau', 'nadia@inspire2live.org', 'Clinician', 'Institut Gustave Roussy', 'FR', 'Paris', ARRAY['clinical-trials','outcomes-research','breast-cancer'], 'Oncologist and clinical trialist with focus on patient-reported outcomes.', true, now() - interval '1 day', false),
  ('a0000001-0000-0000-0000-000000000006', 'Platform Admin', 'admin@inspire2live.org', 'PlatformAdmin', 'Inspire2Live', 'NL', 'Amsterdam', ARRAY['platform-admin','user-management'], 'Platform administrator with full access to all features.', true, now(), false),
  ('a0000001-0000-0000-0000-000000000007', 'Atefeh Rahimi', 'atefeh@inspire2live.org', 'Moderator', 'Inspire2Live Communications', 'NL', 'Amsterdam', ARRAY['moderation','communications','story-distribution'], 'Moderator supporting the communications workspace and community publishing flow.', true, now() - interval '4 hours', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  organization = EXCLUDED.organization,
  country = EXCLUDED.country,
  city = EXCLUDED.city,
  expertise_tags = EXCLUDED.expertise_tags,
  bio = EXCLUDED.bio,
  onboarding_completed = true,
  last_active_at = EXCLUDED.last_active_at,
  comms_team = EXCLUDED.comms_team;

-- ============================================================
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Paste this entire file
-- 3. Click "Run"
-- 4. Then run migration 00006_wp3_initiative_seed.sql
--    (it references these user IDs for initiatives, tasks, etc.)
-- 5. All demo accounts use password: demo1234
-- ============================================================
