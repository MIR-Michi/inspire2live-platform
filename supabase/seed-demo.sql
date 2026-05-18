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

UPDATE public.profiles
SET notification_prefs = jsonb_set(notification_prefs, '{digestDeliveryTime}', '"08:00"', true)
WHERE id IN (
  'a0000001-0000-0000-0000-000000000006',
  'a0000001-0000-0000-0000-000000000007'
);

-- ── Sprint 02 intake queue seeds ─────────────────────────────────────────
INSERT INTO public.intake_items (
  id,
  captured_at,
  capture_method,
  sender_name,
  raw_content,
  source_url,
  attached_media_ref,
  content_type,
  classification_confidence,
  is_peter_kapitein,
  status,
  dismissed_reason
)
VALUES
  (
    'b0000001-0000-0000-0000-000000000001',
    now() - interval '2 hours',
    'manual',
    'Stephen Rowley',
    'GUIDE.MRD General Assembly photos and a short caption from the Amsterdam meeting. Strong visual material for a fast LinkedIn recap and newsletter mention.',
    'https://guide-mrd.example.org/general-assembly',
    'SharePoint: /world-campus/guide-mrd/general-assembly-photos',
    'event_report',
    'high',
    false,
    'unreviewed',
    null
  ),
  (
    'b0000001-0000-0000-0000-000000000002',
    now() - interval '5 hours',
    'manual',
    'Kai Bergmann',
    'Tempus AI precision oncology article worth flagging for the newsletter with a short patient-advocacy framing note.',
    'https://www.tempus.com/news/precision-oncology-update',
    null,
    'article_share',
    'high',
    false,
    'unreviewed',
    null
  ),
  (
    'b0000001-0000-0000-0000-000000000003',
    now() - interval '8 hours',
    'manual',
    'Peter Kapitein',
    'A warm welcome to Michael from Austria. Michael joins our World Campus network with a strong background in patient advocacy and cross-border policy work.',
    null,
    null,
    'member_intro',
    'high',
    true,
    'unreviewed',
    null
  ),
  (
    'b0000001-0000-0000-0000-000000000004',
    now() - interval '10 hours',
    'manual',
    'Michael Hofer',
    'Thank you Peter and everyone for the warm welcome. I am based in Austria and look forward to supporting advocacy and policy efforts across the region.',
    null,
    null,
    'member_intro',
    'medium',
    false,
    'unreviewed',
    null
  ),
  (
    'b0000001-0000-0000-0000-000000000005',
    now() - interval '1 day',
    'manual',
    'Atefeh Rahimi',
    'Does anyone have the Congress Photos WhatsApp group or a SharePoint folder with the latest Congress media? We need it for follow-up publishing.',
    null,
    'Requested asset: Congress photos group / SharePoint folder',
    'media_request',
    'high',
    false,
    'unreviewed',
    null
  ),
  (
    'b0000001-0000-0000-0000-000000000006',
    now() - interval '1 day 2 hours',
    'manual',
    'Jeff Waldron',
    'I can share the congress videos and a few speaker clips if that helps the comms team wrap the event outputs this week.',
    null,
    'Offer: Congress videos and speaker clips',
    'media_request',
    'medium',
    false,
    'unreviewed',
    null
  ),
  (
    'b0000001-0000-0000-0000-000000000007',
    now() - interval '1 day 5 hours',
    'manual',
    'GUIDE.MRD team',
    'We participated as patient advocates in the latest GUIDE.MRD workshop and now have a short report plus action points for next quarter.',
    'https://guide-mrd.example.org/workshop-update',
    null,
    'initiative_update',
    'high',
    false,
    'unreviewed',
    null
  ),
  (
    'b0000001-0000-0000-0000-000000000008',
    now() - interval '2 days',
    'manual',
    'Tempus AI',
    'External article on precision medicine and equitable access. Strong candidate for a curated newsletter note.',
    'https://www.tempus.com/news/equitable-access',
    null,
    'article_share',
    'high',
    false,
    'routed',
    null
  ),
  (
    'b0000001-0000-0000-0000-000000000009',
    now() - interval '2 days 4 hours',
    'manual',
    'Peter Kapitein',
    'Happy birthday to our dear community champion today. Wishing you health and joy from all of us.',
    null,
    null,
    'noise',
    'high',
    true,
    'dismissed',
    'Social celebration, kept in archive only'
  ),
  (
    'b0000001-0000-0000-0000-000000000010',
    now() - interval '3 days',
    'manual',
    'Barbara',
    'Happy birthday Paul! Sending hugs from the whole network.',
    null,
    null,
    'noise',
    'high',
    false,
    'dismissed',
    'Birthday thread, hidden from active queue'
  )
ON CONFLICT (id) DO UPDATE SET
  captured_at = EXCLUDED.captured_at,
  sender_name = EXCLUDED.sender_name,
  raw_content = EXCLUDED.raw_content,
  source_url = EXCLUDED.source_url,
  attached_media_ref = EXCLUDED.attached_media_ref,
  content_type = EXCLUDED.content_type,
  classification_confidence = EXCLUDED.classification_confidence,
  is_peter_kapitein = EXCLUDED.is_peter_kapitein,
  status = EXCLUDED.status,
  dismissed_reason = EXCLUDED.dismissed_reason;

-- ── Sprint 02 content calendar seeds ─────────────────────────────────────
INSERT INTO public.content_calendar (
  id,
  title,
  channels,
  status,
  scheduled_at,
  published_at,
  body_draft,
  author_id,
  source_intake_id,
  source_link,
  attached_media_refs,
  tags
)
VALUES
  (
    'b0000001-0000-0000-0000-000000000101',
    'Newsletter candidate: Tempus precision oncology access story',
    ARRAY['newsletter'],
    'draft',
    now() + interval '1 day',
    null,
    'Short curator note for the newsletter: why this Tempus update matters for access, education, and patient decision-making.',
    'a0000001-0000-0000-0000-000000000007',
    'b0000001-0000-0000-0000-000000000002',
    'https://www.tempus.com/news/precision-oncology-update',
    ARRAY[]::text[],
    ARRAY['newsletter', 'precision-oncology']
  ),
  (
    'b0000001-0000-0000-0000-000000000102',
    'GUIDE.MRD Amsterdam recap for LinkedIn',
    ARRAY['linkedin', 'newsletter'],
    'in_review',
    now() + interval '2 days',
    null,
    'Draft a concise event recap anchored in the patient-advocate perspective and pair it with 3-5 image highlights from the General Assembly.',
    'a0000001-0000-0000-0000-000000000007',
    'b0000001-0000-0000-0000-000000000001',
    'https://guide-mrd.example.org/general-assembly',
    ARRAY['SharePoint: /world-campus/guide-mrd/general-assembly-photos'],
    ARRAY['guide-mrd', 'event-report']
  ),
  (
    'b0000001-0000-0000-0000-000000000103',
    'World Campus weekly digest shell',
    ARRAY['newsletter', 'wordpress'],
    'scheduled',
    now() + interval '4 days',
    null,
    'Issue scaffold for this week''s comms roundup: Tempus article, GUIDE.MRD recap, new members, and media recovery follow-up.',
    'a0000001-0000-0000-0000-000000000006',
    null,
    null,
    ARRAY[]::text[],
    ARRAY['weekly-digest', 'world-campus']
  ),
  (
    'b0000001-0000-0000-0000-000000000104',
    'Precision advocacy article for WordPress',
    ARRAY['wordpress'],
    'draft',
    now() + interval '6 days',
    null,
    'Long-form outline connecting precision oncology research, patient voice, and the Tempus access angle for an Inspire2Live story post.',
    'a0000001-0000-0000-0000-000000000006',
    'b0000001-0000-0000-0000-000000000008',
    'https://www.tempus.com/news/equitable-access',
    ARRAY[]::text[],
    ARRAY['wordpress', 'research-share']
  ),
  (
    'b0000001-0000-0000-0000-000000000105',
    'Podcast note: lessons from GUIDE.MRD workshop',
    ARRAY['podcast', 'linkedin'],
    'archived',
    now() - interval '5 days',
    now() - interval '4 days',
    'Archived pilot draft kept as a reference for future repurposing.',
    'a0000001-0000-0000-0000-000000000007',
    'b0000001-0000-0000-0000-000000000007',
    'https://guide-mrd.example.org/workshop-update',
    ARRAY[]::text[],
    ARRAY['podcast', 'guide-mrd']
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  channels = EXCLUDED.channels,
  status = EXCLUDED.status,
  scheduled_at = EXCLUDED.scheduled_at,
  published_at = EXCLUDED.published_at,
  body_draft = EXCLUDED.body_draft,
  author_id = EXCLUDED.author_id,
  source_intake_id = EXCLUDED.source_intake_id,
  source_link = EXCLUDED.source_link,
  attached_media_refs = EXCLUDED.attached_media_refs,
  tags = EXCLUDED.tags;

-- ============================================================
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Paste this entire file
-- 3. Click "Run"
-- 4. Then run migration 00006_wp3_initiative_seed.sql
--    (it references these user IDs for initiatives, tasks, etc.)
-- 5. All demo accounts use password: demo1234
-- ============================================================
