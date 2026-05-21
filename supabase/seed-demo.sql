-- ============================================================
-- SEED-DEMO: Create demo accounts with passwords for login
-- Run this in Supabase SQL Editor to populate demo data
-- Password for all accounts: demo1234
-- ============================================================
-- NOTE: This uses Supabase's internal auth schema.
-- The encrypted_password is generated on insert/update with:
--   SELECT crypt('demo1234', gen_salt('bf', 10));

-- ── Demo Auth Users with passwords ──────────────────────────
-- These match the personas from 00006_wp3_initiative_seed.sql

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, role, aud, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change, email_change_token_current, phone_change,
  phone_change_token, reauthentication_token, is_anonymous
) VALUES
  (
    'a0000001-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'sophie@inspire2live.org',
    crypt('demo1234', gen_salt('bf', 10)),
    now(),
    '{"name":"Sophie van der Berg","role":"HubCoordinator","country":"NL"}'::jsonb,
    'authenticated', 'authenticated', now(), now(),
    '', '', '', '', '', '', '', '', false
  ),
  (
    'a0000001-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'maria@inspire2live.org',
    crypt('demo1234', gen_salt('bf', 10)),
    now(),
    '{"name":"Maria Hofer","role":"PatientAdvocate","country":"AT"}'::jsonb,
    'authenticated', 'authenticated', now(), now(),
    '', '', '', '', '', '', '', '', false
  ),
  (
    'a0000001-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'peter@inspire2live.org',
    crypt('demo1234', gen_salt('bf', 10)),
    now(),
    '{"name":"Peter Lindqvist","role":"BoardMember","country":"SE"}'::jsonb,
    'authenticated', 'authenticated', now(), now(),
    '', '', '', '', '', '', '', '', false
  ),
  (
    'a0000001-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'kai@inspire2live.org',
    crypt('demo1234', gen_salt('bf', 10)),
    now(),
    '{"name":"Dr. Kai Bergmann","role":"Researcher","country":"DE"}'::jsonb,
    'authenticated', 'authenticated', now(), now(),
    '', '', '', '', '', '', '', '', false
  ),
  (
    'a0000001-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000000',
    'nadia@inspire2live.org',
    crypt('demo1234', gen_salt('bf', 10)),
    now(),
    '{"name":"Dr. Nadia Rousseau","role":"Clinician","country":"FR"}'::jsonb,
    'authenticated', 'authenticated', now(), now(),
    '', '', '', '', '', '', '', '', false
  ),
  (
    'a0000001-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000000',
    'admin@inspire2live.org',
    crypt('demo1234', gen_salt('bf', 10)),
    now(),
    '{"name":"Platform Admin","role":"PlatformAdmin","country":"NL"}'::jsonb,
    'authenticated', 'authenticated', now(), now(),
    '', '', '', '', '', '', '', '', false
  )
ON CONFLICT (id) DO NOTHING;

UPDATE auth.users
SET
  encrypted_password = crypt('demo1234', gen_salt('bf', 10)),
  aud = coalesce(aud, 'authenticated'),
  role = coalesce(role, 'authenticated'),
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  reauthentication_token = coalesce(reauthentication_token, '')
WHERE id IN (
  'a0000001-0000-0000-0000-000000000001',
  'a0000001-0000-0000-0000-000000000002',
  'a0000001-0000-0000-0000-000000000003',
  'a0000001-0000-0000-0000-000000000004',
  'a0000001-0000-0000-0000-000000000005',
  'a0000001-0000-0000-0000-000000000006'
);

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
   'email', 'a0000001-0000-0000-0000-000000000006', now(), now(), now())
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
  ('a0000001-0000-0000-0000-000000000006', 'Platform Admin', 'admin@inspire2live.org', 'PlatformAdmin', 'Inspire2Live', 'NL', 'Amsterdam', ARRAY['platform-admin','user-management'], 'Platform administrator with full access to all features.', true, now(), false)
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
  'a0000001-0000-0000-0000-000000000006'
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
    'Sophie van der Berg',
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
    'a0000001-0000-0000-0000-000000000001',
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
    'a0000001-0000-0000-0000-000000000001',
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
    'a0000001-0000-0000-0000-000000000001',
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

-- ── Sprint 03 event pipeline seeds ───────────────────────────────────────
INSERT INTO public.events (
  id,
  name,
  event_type,
  is_annual_congress,
  start_date,
  end_date,
  location_city,
  location_country,
  organiser,
  stage,
  i2l_representatives,
  initiative_ids,
  output_report_drafted,
  output_linkedin_published,
  output_newsletter_mentioned,
  output_media_stored,
  notes
)
VALUES
  (
    'c0000001-0000-0000-0000-000000000201',
    'GUIDE.MRD General Assembly Amsterdam',
    'conference',
    false,
    CURRENT_DATE - 21,
    CURRENT_DATE - 19,
    'Amsterdam',
    'Netherlands',
    'GUIDE.MRD consortium',
    'post_event',
    ARRAY['a0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000006']::uuid[],
    (SELECT array_agg(id) FROM (SELECT id FROM public.initiatives ORDER BY title LIMIT 1) initiative_rows),
    true,
    false,
    true,
    true,
    'The Assembly produced a concise patient-advocacy recap, image package, and several follow-up actions for the comms queue.'
  ),
  (
    'c0000001-0000-0000-0000-000000000202',
    'Annual Congress 2026',
    'congress',
    true,
    CURRENT_DATE + 35,
    CURRENT_DATE + 37,
    'Amsterdam',
    'Netherlands',
    'Inspire2Live Foundation',
    'announced',
    ARRAY['a0000001-0000-0000-0000-000000000006']::uuid[],
    (SELECT array_agg(id) FROM (SELECT id FROM public.initiatives ORDER BY title LIMIT 2) initiative_rows),
    false,
    false,
    false,
    false,
    'Planning banner event for the existing Congress workspace linkage.'
  ),
  (
    'c0000001-0000-0000-0000-000000000203',
    'World Campus London Forum',
    'symposium',
    false,
    CURRENT_DATE + 12,
    CURRENT_DATE + 12,
    'London',
    'United Kingdom',
    'World Campus coordination',
    'attending',
    ARRAY['a0000001-0000-0000-0000-000000000001']::uuid[],
    (SELECT array_agg(id) FROM (SELECT id FROM public.initiatives ORDER BY title OFFSET 1 LIMIT 1) initiative_rows),
    false,
    false,
    false,
    false,
    'Comms team is preparing live coverage notes and speaker follow-up.'
  ),
  (
    'c0000001-0000-0000-0000-000000000204',
    'Precision Oncology Summit',
    'conference',
    false,
    CURRENT_DATE - 1,
    CURRENT_DATE + 1,
    'Berlin',
    'Germany',
    'Precision Oncology Alliance',
    'in_progress',
    ARRAY['a0000001-0000-0000-0000-000000000001']::uuid[],
    (SELECT array_agg(id) FROM (SELECT id FROM public.initiatives ORDER BY title OFFSET 2 LIMIT 1) initiative_rows),
    false,
    false,
    false,
    false,
    'Live signal collection is still underway from the summit sessions.'
  ),
  (
    'c0000001-0000-0000-0000-000000000205',
    'Archived Brussels Policy Workshop',
    'workshop',
    false,
    CURRENT_DATE - 180,
    CURRENT_DATE - 179,
    'Brussels',
    'Belgium',
    'European Policy Forum',
    'archived',
    ARRAY['a0000001-0000-0000-0000-000000000006']::uuid[],
    null,
    true,
    true,
    true,
    true,
    'Historical workshop kept as a reference for lifecycle and output tracking.'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  event_type = EXCLUDED.event_type,
  is_annual_congress = EXCLUDED.is_annual_congress,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  location_city = EXCLUDED.location_city,
  location_country = EXCLUDED.location_country,
  organiser = EXCLUDED.organiser,
  stage = EXCLUDED.stage,
  i2l_representatives = EXCLUDED.i2l_representatives,
  initiative_ids = EXCLUDED.initiative_ids,
  output_report_drafted = EXCLUDED.output_report_drafted,
  output_linkedin_published = EXCLUDED.output_linkedin_published,
  output_newsletter_mentioned = EXCLUDED.output_newsletter_mentioned,
  output_media_stored = EXCLUDED.output_media_stored,
  notes = EXCLUDED.notes;

UPDATE public.content_calendar
SET source_event_id = 'c0000001-0000-0000-0000-000000000201'
WHERE id IN (
  'b0000001-0000-0000-0000-000000000102',
  'b0000001-0000-0000-0000-000000000105'
);

-- ── Sprint 03 World Campus seeds ─────────────────────────────────────────
INSERT INTO public.campus_members (
  id,
  name,
  country,
  organisation,
  role_description,
  date_welcomed,
  welcomed_by_peter,
  initiative_affiliations,
  notes,
  last_channel_activity
)
VALUES
  ('c0000001-0000-0000-0000-000000000402', 'Stephen Rowley', 'United Kingdom', 'GUIDE.MRD', 'Patient advocate and partner liaison', CURRENT_DATE - 120, false, null, 'Regular source for GUIDE.MRD updates and event follow-up.', now() - interval '1 day'),
  ('c0000001-0000-0000-0000-000000000403', 'Jeff Waldron', 'United States', 'World Campus', 'Media and partnerships contributor', CURRENT_DATE - 115, false, null, 'Often helps recover videos and speaker clips.', now() - interval '2 days'),
  ('c0000001-0000-0000-0000-000000000404', 'Michael from Austria', 'Austria', 'Independent advocacy network', 'Cross-border policy advocate', CURRENT_DATE - 3, true, null, 'Welcomed into the World Campus by Peter Kapitein.', now() - interval '8 hours'),
  ('c0000001-0000-0000-0000-000000000405', 'Kemi Adekanye', 'Nigeria', 'Lagos Oncology Network', 'Community builder and initiative connector', CURRENT_DATE - 5, true, null, 'Warm introduction shared by Peter with strong World Campus relevance.', now() - interval '1 day'),
  ('c0000001-0000-0000-0000-000000000406', 'Peter Kapitein', 'Netherlands', 'Inspire2Live Foundation', 'Founder and signal amplifier', CURRENT_DATE - 400, false, null, 'Founder presence for the signal layer and founder badge views.', now() - interval '12 hours'),
  ('c0000001-0000-0000-0000-000000000407', 'Sophie van der Berg', 'Netherlands', 'Inspire2Live Foundation', 'Hub coordinator', CURRENT_DATE - 300, false, null, 'Helps connect local and global hub work.', now() - interval '3 days'),
  ('c0000001-0000-0000-0000-000000000408', 'Maria Hofer', 'Austria', 'Austrian Cancer Aid', 'Patient advocate', CURRENT_DATE - 280, false, null, 'Existing advocate profile mirrored into the campus log.', now() - interval '5 days'),
  ('c0000001-0000-0000-0000-000000000409', 'Kai Bergmann', 'Germany', 'Charite Berlin', 'Researcher', CURRENT_DATE - 260, false, null, 'Feeds article-share opportunities into comms.', now() - interval '2 days'),
  ('c0000001-0000-0000-0000-000000000410', 'Nadia Rousseau', 'France', 'Institut Gustave Roussy', 'Clinician', CURRENT_DATE - 250, false, null, 'Bridges clinical and patient-facing comms angles.', now() - interval '6 days'),
  ('c0000001-0000-0000-0000-000000000411', 'Barbara', 'Belgium', 'Community network', 'Community member', CURRENT_DATE - 220, false, null, 'Seen mostly in social or birthday threads.', now() - interval '9 days'),
  ('c0000001-0000-0000-0000-000000000412', 'Michael Hofer', 'Austria', 'Regional policy alliance', 'Advocacy collaborator', CURRENT_DATE - 2, false, null, 'Self-introduction followed the welcome message from Peter.', now() - interval '6 hours')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  country = EXCLUDED.country,
  organisation = EXCLUDED.organisation,
  role_description = EXCLUDED.role_description,
  date_welcomed = EXCLUDED.date_welcomed,
  welcomed_by_peter = EXCLUDED.welcomed_by_peter,
  initiative_affiliations = EXCLUDED.initiative_affiliations,
  notes = EXCLUDED.notes,
  last_channel_activity = EXCLUDED.last_channel_activity;

INSERT INTO public.campus_sessions (
  id,
  session_date,
  theme,
  participating_hub_ids,
  summary,
  action_items_for_publication,
  recording_url,
  initiative_ids,
  published_outputs,
  created_by
)
VALUES
  (
    'c0000001-0000-0000-0000-000000000301',
    CURRENT_DATE - 14,
    'Patient voice for GUIDE.MRD event follow-up',
    (SELECT array_agg(id) FROM (SELECT id FROM public.hubs ORDER BY name LIMIT 2) hub_rows),
    'Reviewed the GUIDE.MRD General Assembly outputs and agreed on a recap plus newsletter mention.',
    ARRAY['Publish LinkedIn recap with 3-5 images', 'Reuse newsletter copy in the weekly digest'],
    'https://example.org/world-campus/guide-mrd-recording',
    (SELECT array_agg(id) FROM (SELECT id FROM public.initiatives ORDER BY title LIMIT 1) initiative_rows),
    ARRAY['b0000001-0000-0000-0000-000000000102']::uuid[],
    'a0000001-0000-0000-0000-000000000001'
  ),
  (
    'c0000001-0000-0000-0000-000000000302',
    CURRENT_DATE - 7,
    'Welcoming new World Campus members',
    (SELECT array_agg(id) FROM (SELECT id FROM public.hubs ORDER BY name OFFSET 1 LIMIT 2) hub_rows),
    'Captured new member welcomes from Peter and aligned on the follow-up intro story for Michael and Kemi.',
    ARRAY['Draft member spotlight for newsletter', 'Confirm countries and organisation fields'],
    'https://example.org/world-campus/welcomes-recording',
    null,
    ARRAY['b0000001-0000-0000-0000-000000000106']::uuid[],
    'a0000001-0000-0000-0000-000000000001'
  ),
  (
    'c0000001-0000-0000-0000-000000000303',
    CURRENT_DATE + 4,
    'Annual Congress coordination touchpoint',
    (SELECT array_agg(id) FROM (SELECT id FROM public.hubs ORDER BY name LIMIT 3) hub_rows),
    'Pre-congress sync covering intake routing, event banner visibility, and media recovery dependencies.',
    ARRAY['Promote congress banner in event pipeline', 'Track media requests against placeholder assets'],
    null,
    (SELECT array_agg(id) FROM (SELECT id FROM public.initiatives ORDER BY title LIMIT 2) initiative_rows),
    ARRAY['b0000001-0000-0000-0000-000000000103']::uuid[],
    'a0000001-0000-0000-0000-000000000006'
  )
ON CONFLICT (id) DO UPDATE SET
  session_date = EXCLUDED.session_date,
  theme = EXCLUDED.theme,
  participating_hub_ids = EXCLUDED.participating_hub_ids,
  summary = EXCLUDED.summary,
  action_items_for_publication = EXCLUDED.action_items_for_publication,
  recording_url = EXCLUDED.recording_url,
  initiative_ids = EXCLUDED.initiative_ids,
  published_outputs = EXCLUDED.published_outputs,
  created_by = EXCLUDED.created_by;

-- ── Sprint 04 media library + recovery seeds ─────────────────────────────
INSERT INTO public.media_assets (
  id,
  title,
  asset_type,
  rights_status,
  sharepoint_url,
  contributed_by,
  event_id,
  session_id,
  initiative_id,
  tags,
  usage_count
)
VALUES
  (
    'c0000001-0000-0000-0000-000000000501',
    'GUIDE.MRD Amsterdam photo set',
    'photo',
    'approved_for_publication',
    'https://sharepoint.example.org/world-campus/guide-mrd/amsterdam-photo-set',
    'a0000001-0000-0000-0000-000000000001',
    'c0000001-0000-0000-0000-000000000201',
    null,
    (SELECT id FROM public.initiatives ORDER BY title LIMIT 1),
    ARRAY['guide-mrd', 'photos', 'event-recap'],
    1
  ),
  (
    'c0000001-0000-0000-0000-000000000502',
    'GUIDE.MRD keynote clip',
    'video',
    'internal_only',
    'https://sharepoint.example.org/world-campus/guide-mrd/keynote-clip',
    'a0000001-0000-0000-0000-000000000003',
    'c0000001-0000-0000-0000-000000000201',
    null,
    (SELECT id FROM public.initiatives ORDER BY title LIMIT 1),
    ARRAY['guide-mrd', 'video', 'keynote'],
    0
  ),
  (
    'c0000001-0000-0000-0000-000000000503',
    'World Campus welcome session slides',
    'slides',
    'approved_for_publication',
    'https://sharepoint.example.org/world-campus/welcomes/session-slides',
    'a0000001-0000-0000-0000-000000000006',
    null,
    'c0000001-0000-0000-0000-000000000302',
    null,
    ARRAY['world-campus', 'member-welcome', 'slides'],
    1
  ),
  (
    'c0000001-0000-0000-0000-000000000504',
    'GUIDE.MRD follow-up session recording',
    'recording',
    'internal_only',
    'https://sharepoint.example.org/world-campus/guide-mrd/follow-up-recording',
    'a0000001-0000-0000-0000-000000000001',
    null,
    'c0000001-0000-0000-0000-000000000301',
    (SELECT id FROM public.initiatives ORDER BY title LIMIT 1),
    ARRAY['guide-mrd', 'recording', 'world-campus'],
    1
  ),
  (
    'c0000001-0000-0000-0000-000000000505',
    'Annual Congress speaker gallery',
    'photo',
    'approved_for_publication',
    'https://sharepoint.example.org/world-campus/congress/speaker-gallery',
    'a0000001-0000-0000-0000-000000000001',
    'c0000001-0000-0000-0000-000000000202',
    null,
    null,
    ARRAY['congress', 'photos', 'recovered'],
    1
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  asset_type = EXCLUDED.asset_type,
  rights_status = EXCLUDED.rights_status,
  sharepoint_url = EXCLUDED.sharepoint_url,
  contributed_by = EXCLUDED.contributed_by,
  event_id = EXCLUDED.event_id,
  session_id = EXCLUDED.session_id,
  initiative_id = EXCLUDED.initiative_id,
  tags = EXCLUDED.tags,
  usage_count = EXCLUDED.usage_count;

INSERT INTO public.media_recovery_requests (
  id,
  title,
  summary,
  request_intake_id,
  requested_by,
  event_id,
  status,
  resolution_notes,
  resolved_asset_id,
  created_at,
  resolved_at
)
VALUES
  (
    'c0000001-0000-0000-0000-000000000601',
    'Congress Photos WhatsApp group or SharePoint folder',
    'Sophie is trying to recover the latest Annual Congress photos so the team can finish follow-up publishing.',
    'b0000001-0000-0000-0000-000000000005',
    'a0000001-0000-0000-0000-000000000001',
    'c0000001-0000-0000-0000-000000000202',
    'open',
    null,
    null,
    now() - interval '22 hours',
    null
  ),
  (
    'c0000001-0000-0000-0000-000000000602',
    'Annual Congress highlight photo recovery',
    'Resolved recovery thread for the congress highlight set now stored in SharePoint and linked back into the media library.',
    'c0000001-0000-0000-0000-000000000016',
    'a0000001-0000-0000-0000-000000000001',
    'c0000001-0000-0000-0000-000000000202',
    'resolved',
    'Resolved after the congress photographer uploaded the final gallery to SharePoint.',
    'c0000001-0000-0000-0000-000000000505',
    now() - interval '3 days',
    now() - interval '2 days'
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  request_intake_id = EXCLUDED.request_intake_id,
  requested_by = EXCLUDED.requested_by,
  event_id = EXCLUDED.event_id,
  status = EXCLUDED.status,
  resolution_notes = EXCLUDED.resolution_notes,
  resolved_asset_id = EXCLUDED.resolved_asset_id,
  created_at = EXCLUDED.created_at,
  resolved_at = EXCLUDED.resolved_at;

INSERT INTO public.media_recovery_offers (
  id,
  recovery_request_id,
  intake_item_id,
  offered_by,
  notes,
  sharepoint_url,
  created_at
)
VALUES
  (
    'c0000001-0000-0000-0000-000000000701',
    'c0000001-0000-0000-0000-000000000601',
    'b0000001-0000-0000-0000-000000000006',
    'Jeff Waldron',
    'Jeff can share congress videos plus a folder with speaker clips for the comms wrap-up.',
    'https://sharepoint.example.org/world-campus/congress/jeff-speaker-clips',
    now() - interval '20 hours'
  )
ON CONFLICT (id) DO UPDATE SET
  recovery_request_id = EXCLUDED.recovery_request_id,
  intake_item_id = EXCLUDED.intake_item_id,
  offered_by = EXCLUDED.offered_by,
  notes = EXCLUDED.notes,
  sharepoint_url = EXCLUDED.sharepoint_url,
  created_at = EXCLUDED.created_at;

-- ── Sprint 03 routed intake verification seeds ───────────────────────────
INSERT INTO public.intake_items (
  id,
  captured_at,
  capture_method,
  sender_name,
  raw_content,
  content_type,
  classification_confidence,
  is_peter_kapitein,
  status,
  routed_to_type,
  routed_to_id,
  reviewed_by,
  reviewed_at
)
VALUES
  (
    'c0000001-0000-0000-0000-000000000011',
    now() - interval '11 days',
    'manual',
    'Stephen Rowley',
    'GUIDE.MRD General Assembly Amsterdam report is ready for structured event follow-up and output tracking.',
    'event_report',
    'high',
    false,
    'routed',
    'event',
    'c0000001-0000-0000-0000-000000000201',
    'a0000001-0000-0000-0000-000000000001',
    now() - interval '10 days'
  ),
  (
    'c0000001-0000-0000-0000-000000000012',
    now() - interval '9 days',
    'manual',
    'Jeff Waldron',
    'The GUIDE.MRD keynote clip still needs to be moved into the media library so the comms team can reuse it later.',
    'event_report',
    'medium',
    false,
    'routed',
    'media_asset',
    'c0000001-0000-0000-0000-000000000502',
    'a0000001-0000-0000-0000-000000000001',
    now() - interval '8 days'
  ),
  (
    'c0000001-0000-0000-0000-000000000013',
    now() - interval '3 days',
    'manual',
    'Peter Kapitein',
    'A warm welcome to Michael from Austria. Michael joins our World Campus network with a strong background in patient advocacy and cross-border policy work.',
    'member_intro',
    'high',
    true,
    'routed',
    'campus_member',
    'c0000001-0000-0000-0000-000000000404',
    'a0000001-0000-0000-0000-000000000001',
    now() - interval '3 days'
  ),
  (
    'c0000001-0000-0000-0000-000000000014',
    now() - interval '6 days',
    'manual',
    'GUIDE.MRD team',
    'The World Campus London Forum should be linked to the initiative follow-up planning and tracked in the event pipeline.',
    'initiative_update',
    'medium',
    false,
    'routed',
    'event',
    'c0000001-0000-0000-0000-000000000203',
    'a0000001-0000-0000-0000-000000000001',
    now() - interval '5 days'
  ),
  (
    'c0000001-0000-0000-0000-000000000015',
    now() - interval '4 days',
    'manual',
    'Peter Kapitein',
    'Kemi Adekanye from Nigeria is bringing strong community-building energy into the World Campus and should be visible in the member log.',
    'initiative_update',
    'high',
    true,
    'routed',
    'campus_member',
    'c0000001-0000-0000-0000-000000000405',
    'a0000001-0000-0000-0000-000000000001',
    now() - interval '4 days'
  ),
  (
    'c0000001-0000-0000-0000-000000000016',
    now() - interval '2 days',
    'manual',
    'Sophie van der Berg',
    'The Annual Congress highlight photo set still needs a single cleaned-up SharePoint destination for the publishing team.',
    'media_request',
    'medium',
    false,
    'routed',
    'media_asset',
    'c0000001-0000-0000-0000-000000000602',
    'a0000001-0000-0000-0000-000000000001',
    now() - interval '2 days'
  )
ON CONFLICT (id) DO UPDATE SET
  captured_at = EXCLUDED.captured_at,
  sender_name = EXCLUDED.sender_name,
  raw_content = EXCLUDED.raw_content,
  content_type = EXCLUDED.content_type,
  classification_confidence = EXCLUDED.classification_confidence,
  is_peter_kapitein = EXCLUDED.is_peter_kapitein,
  status = EXCLUDED.status,
  routed_to_type = EXCLUDED.routed_to_type,
  routed_to_id = EXCLUDED.routed_to_id,
  reviewed_by = EXCLUDED.reviewed_by,
  reviewed_at = EXCLUDED.reviewed_at;

UPDATE public.intake_items
SET
  status = 'routed',
  routed_to_type = 'calendar',
  routed_to_id = 'b0000001-0000-0000-0000-000000000104',
  reviewed_by = 'a0000001-0000-0000-0000-000000000001',
  reviewed_at = now() - interval '2 days'
WHERE id = 'b0000001-0000-0000-0000-000000000008';

UPDATE public.intake_items
SET
  status = 'routed',
  routed_to_type = 'media_asset',
  routed_to_id = 'c0000001-0000-0000-0000-000000000601',
  reviewed_by = 'a0000001-0000-0000-0000-000000000001',
  reviewed_at = now() - interval '22 hours'
WHERE id = 'b0000001-0000-0000-0000-000000000005';

UPDATE public.intake_items
SET
  status = 'routed',
  routed_to_type = 'media_asset',
  routed_to_id = 'c0000001-0000-0000-0000-000000000601',
  reviewed_by = 'a0000001-0000-0000-0000-000000000001',
  reviewed_at = now() - interval '20 hours'
WHERE id = 'b0000001-0000-0000-0000-000000000006';

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
  source_event_id,
  attached_media_refs,
  tags
)
VALUES
  (
    'b0000001-0000-0000-0000-000000000106',
    'Welcome Michael from Austria to World Campus',
    ARRAY['linkedin', 'newsletter'],
    'draft',
    now() + interval '3 days',
    null,
    'Short welcome note introducing Michael from Austria and tying his policy background into the World Campus community story.',
    'a0000001-0000-0000-0000-000000000001',
    'c0000001-0000-0000-0000-000000000013',
    null,
    ARRAY['c0000001-0000-0000-0000-000000000503']::uuid[],
    ARRAY['member-spotlight', 'michael-from-austria']
  ),
  (
    'b0000001-0000-0000-0000-000000000107',
    'Annual Congress visual follow-up',
    ARRAY['linkedin', 'wordpress'],
    'published',
    now() - interval '1 day',
    now() - interval '18 hours',
    'Published congress follow-up using the recovered speaker gallery and a short recap for both LinkedIn and WordPress.',
    'a0000001-0000-0000-0000-000000000006',
    'c0000001-0000-0000-0000-000000000016',
    'c0000001-0000-0000-0000-000000000202',
    ARRAY['c0000001-0000-0000-0000-000000000505']::uuid[],
    ARRAY['congress', 'media-follow-up']
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
  source_event_id = EXCLUDED.source_event_id,
  attached_media_refs = EXCLUDED.attached_media_refs,
  tags = EXCLUDED.tags;

UPDATE public.content_calendar
SET attached_media_refs = ARRAY['c0000001-0000-0000-0000-000000000501']::uuid[]
WHERE id = 'b0000001-0000-0000-0000-000000000102';

UPDATE public.content_calendar
SET attached_media_refs = ARRAY['c0000001-0000-0000-0000-000000000504']::uuid[]
WHERE id = 'b0000001-0000-0000-0000-000000000105';

INSERT INTO public.notifications (
  id,
  user_id,
  type,
  title,
  body,
  link_url,
  is_read,
  created_at
)
VALUES
  (
    'c0000001-0000-0000-0000-000000000801',
    'a0000001-0000-0000-0000-000000000001',
    'media_recovery_offer',
    'New media recovery offer',
    'Jeff Waldron linked a Congress media offer to the open recovery request.',
    '/app/comms/media',
    false,
    now() - interval '20 hours'
  )
ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  type = EXCLUDED.type,
  title = EXCLUDED.title,
  body = EXCLUDED.body,
  link_url = EXCLUDED.link_url,
  is_read = EXCLUDED.is_read,
  created_at = EXCLUDED.created_at;

-- ============================================================
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Paste this entire file
-- 3. Click "Run"
-- 4. Then run migration 00006_wp3_initiative_seed.sql
--    (it references these user IDs for initiatives, tasks, etc.)
-- 5. All demo accounts use password: demo1234
-- ============================================================
