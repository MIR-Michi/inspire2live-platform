-- ============================================================
-- SEED DATA for local development
-- Run with: npx supabase db seed
-- This file is identical in content to migration 00005_seed_data.sql
-- but is used by `supabase db seed` for local resets
-- ============================================================

-- ============================================================
-- AUTH USERS (test personas)
-- ============================================================
insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_user_meta_data, is_anonymous
) values
  (
    '00000000-0000-0000-0000-000000000001',
    'maria@example.com',
    now(), now(), now(),
    '{"name": "Maria van den Berg", "role": "PatientAdvocate", "country": "NL"}'::jsonb,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'kwame@example.com',
    now(), now(), now(),
    '{"name": "Dr. Kwame Asante", "role": "Clinician", "country": "GH"}'::jsonb,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'sophie@example.com',
    now(), now(), now(),
    '{"name": "Sophie van der Berg", "role": "HubCoordinator", "country": "NL"}'::jsonb,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    'hiroshi@example.com',
    now(), now(), now(),
    '{"name": "Hiroshi Tanaka", "role": "IndustryPartner", "country": "JP"}'::jsonb,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000005',
    'amara@example.com',
    now(), now(), now(),
    '{"name": "Amara Okonkwo", "role": "HubCoordinator", "country": "NG"}'::jsonb,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000006',
    'peter@example.com',
    now(), now(), now(),
    '{"name": "Peter De Vries", "role": "BoardMember", "country": "BE"}'::jsonb,
    false
  )
on conflict (id) do nothing;

-- ============================================================
-- PROFILES
-- ============================================================
insert into public.profiles (
  id, name, email, role, country, city, timezone,
  expertise_tags, onboarding_completed, bio
) values
  (
    '00000000-0000-0000-0000-000000000001',
    'Maria van den Berg',
    'maria@example.com',
    'PatientAdvocate',
    'NL', 'Rotterdam', 'Europe/Amsterdam',
    '{"policy advocacy","breast cancer","parliamentary engagement"}',
    true,
    'Patient advocate with 8 years of experience in parliamentary lobbying for cancer diagnostics access in the Netherlands.'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'Dr. Kwame Asante',
    'kwame@example.com',
    'Clinician',
    'GH', 'Accra', 'Africa/Accra',
    '{"oncology","early detection","clinical research"}',
    true,
    'Oncologist at Korle Bu Teaching Hospital, specializing in early detection and community cancer screening programs.'
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'Sophie van der Berg',
    'sophie@example.com',
    'HubCoordinator',
    'NL', 'Amsterdam', 'Europe/Amsterdam',
    '{"project coordination","stakeholder management","digital platforms"}',
    true,
    'Hub Coordinator for Inspire2Live Netherlands, managing cross-initiative collaboration and platform operations.'
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    'Hiroshi Tanaka',
    'hiroshi@example.com',
    'IndustryPartner',
    'JP', 'Tokyo', 'Asia/Tokyo',
    '{"market access","regulatory affairs","oncology","diagnostics"}',
    true,
    'Head of Global Oncology Affairs at a leading diagnostics company. Committed to independence in all Inspire2Live contributions.'
  ),
  (
    '00000000-0000-0000-0000-000000000005',
    'Amara Okonkwo',
    'amara@example.com',
    'HubCoordinator',
    'NG', 'Lagos', 'Africa/Lagos',
    '{"public health","early detection","community health","breast cancer"}',
    true,
    'Public health specialist leading the Lagos Hub. Architect of the Breast Without Spot community screening model.'
  ),
  (
    '00000000-0000-0000-0000-000000000006',
    'Peter De Vries',
    'peter@example.com',
    'BoardMember',
    'BE', 'Brussels', 'Europe/Brussels',
    '{"healthcare governance","funding","strategy","EU health policy"}',
    true,
    'Board member and former EU health policy advisor. Oversees strategic direction and funding partnerships.'
  ),
  (
    '00000000-0000-0000-0000-000000000007',
    'Lina Costa',
    'lina@example.com',
    'Comms',
    'PT', 'Lisbon', 'Europe/Lisbon',
    '{"content strategy","storytelling","press relations","social media"}',
    true,
    'Communications lead coordinating the weekly content calendar, campus updates, and external storytelling for Inspire2Live.'
  )
on conflict (id) do nothing;

-- ============================================================
-- INITIATIVES
-- ============================================================
insert into public.initiatives (
  id, title, slug, description, status, phase, pillar,
  lead_id, cancer_types, countries, objectives
) values
  (
    '10000000-0000-0000-0000-000000000001',
    'Multi-Cancer Early Detection — OncoSeek® & SeekIn',
    'multi-cancer-early-detection',
    'A global initiative to develop and deploy accessible multi-cancer early detection technologies, with OncoSeek® and SeekIn as primary diagnostic platforms. Focused on reaching populations in Africa and Asia where access to standard diagnostics is limited.',
    'active', 'execution', 'inspire2go',
    '00000000-0000-0000-0000-000000000003',
    '{"multiple","breast","lung","colorectal","prostate"}',
    '{"NL","GH","NG","KE","JP","IN"}',
    '[
      {"title": "Validate OncoSeek accuracy in African populations", "status": "in_progress"},
      {"title": "Establish 5 clinical trial sites across Africa", "status": "in_progress"},
      {"title": "Publish evidence in peer-reviewed journal", "status": "upcoming"},
      {"title": "Achieve regulatory approval in 3 markets", "status": "upcoming"}
    ]'::jsonb
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'Molecular Diagnostics — Dutch Parliament Campaign',
    'molecular-diagnostics-nl',
    'Campaign to ensure molecular diagnostic testing is standard of care in the Netherlands, with structured parliamentary advocacy and evidence-based policy briefs. Targeting full reimbursement coverage by 2026.',
    'active', 'execution', 'inspire2live',
    '00000000-0000-0000-0000-000000000001',
    '{"multiple","breast","lung","colorectal"}',
    '{"NL"}',
    '[
      {"title": "Submit policy brief to Health Committee", "status": "completed"},
      {"title": "Secure 3 parliamentary sponsors", "status": "in_progress"},
      {"title": "Organize patient testimony session", "status": "upcoming"},
      {"title": "Achieve ministerial meeting", "status": "upcoming"}
    ]'::jsonb
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'Breast Without Spot — Nigeria',
    'breast-without-spot-nigeria',
    'Community-based breast cancer early detection program in Lagos State, with a model designed for replication across Nigerian states and other African countries. Training community health workers as first-line screeners.',
    'active', 'execution', 'world_campus',
    '00000000-0000-0000-0000-000000000005',
    '{"breast"}',
    '{"NG"}',
    '[
      {"title": "Train 50 community health workers", "status": "in_progress"},
      {"title": "Screen 1,000 women in Phase 1", "status": "in_progress"},
      {"title": "Document replication model", "status": "upcoming"},
      {"title": "Present model at World Campus session", "status": "upcoming"}
    ]'::jsonb
  )
on conflict (id) do nothing;

-- ============================================================
-- INITIATIVE MEMBERS
-- ============================================================
insert into public.initiative_members (initiative_id, user_id, role) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'lead'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'contributor'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 'contributor'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'partner'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'lead'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'contributor'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000006', 'reviewer'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000005', 'lead'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'contributor'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'reviewer')
on conflict (initiative_id, user_id) do nothing;

-- ============================================================
-- MILESTONES
-- ============================================================
insert into public.milestones (
  id, initiative_id, title, description, target_date, status,
  evidence_required, sort_order
) values
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Complete baseline accuracy study','Validate OncoSeek diagnostic accuracy across 500 participants in Ghana and Nigeria',current_date + interval '45 days','in_progress',true,1),
  ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Ethics approval from 3 African institutions','Obtain IRB/ethics committee approval for multi-site clinical trial',current_date + interval '90 days','upcoming',true,2),
  ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','Submit paper to Nature Medicine','First peer-reviewed publication of MCED results from African cohort',current_date + interval '180 days','upcoming',false,3),
  ('20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000002','Policy brief published and distributed','Formal policy brief on molecular diagnostics access submitted to Health Committee',current_date - interval '14 days','completed',true,1),
  ('20000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000002','Parliamentary motion tabled','At least one MP tables a motion in support of universal molecular diagnostics coverage',current_date + interval '30 days','in_progress',false,2),
  ('20000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000002','Minister meeting secured','Face-to-face meeting with Health Minister or senior advisor',current_date + interval '60 days','upcoming',false,3),
  ('20000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000003','50 community health workers trained','Complete training of first cohort of Lagos community health workers',current_date + interval '21 days','in_progress',true,1),
  ('20000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000003','500 women screened in Phase 1','First phase community screening complete with documented outcomes',current_date + interval '75 days','upcoming',true,2)
on conflict (id) do nothing;

-- ============================================================
-- HUBS
-- ============================================================
insert into public.hubs (id, name, country, region, coordinator_id, status, description, latitude, longitude, timezone, established_date) values
  ('30000000-0000-0000-0000-000000000001','Netherlands Hub','NL','Western Europe','00000000-0000-0000-0000-000000000003','active','The founding hub, coordinating all Dutch initiatives and serving as the platform''s operational center.',52.3676,4.9041,'Europe/Amsterdam','2019-01-01'),
  ('30000000-0000-0000-0000-000000000002','Ghana Hub','GH','West Africa','00000000-0000-0000-0000-000000000002','active','Hub focused on early detection access in Ghana, with strong links to Korle Bu Teaching Hospital.',5.6037,-0.1870,'Africa/Accra','2021-06-01'),
  ('30000000-0000-0000-0000-000000000003','Nigeria Hub — Lagos','NG','West Africa','00000000-0000-0000-0000-000000000005','active','Hub driving community-based cancer education and early detection in Lagos State.',6.5244,3.3792,'Africa/Lagos','2022-03-01'),
  ('30000000-0000-0000-0000-000000000004','Japan Hub','JP','East Asia','00000000-0000-0000-0000-000000000004','forming','Emerging hub connecting Japanese oncology research with the global Inspire2Live network.',35.6762,139.6503,'Asia/Tokyo',null)
on conflict (id) do nothing;

-- Hub members
insert into public.hub_members (hub_id, user_id) values
  ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003'),
  ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002'),
  ('30000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000005'),
  ('30000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000004')
on conflict (hub_id, user_id) do nothing;

-- Congress event
insert into public.congress_events (id, year, theme, start_date, end_date, location, status) values
  ('40000000-0000-0000-0000-000000000001',2026,'Closing the Gap: Early Detection for All','2026-10-15','2026-10-17','Amsterdam, Netherlands','upcoming')
on conflict (year) do nothing;

-- ============================================================
-- PATIENT STORIES (demo)
-- ============================================================

insert into public.patient_stories (
  id, author_id, title, summary, body, status, slug, tags,
  is_anonymous, display_name, consent_to_publish, allow_contact,
  submitted_at, reviewed_at, approved_at, published_at
) values
  (
    '50000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'The day my diagnosis became a calendar',
    'A lived experience of time pressure, uncertainty, and the need for clear navigation.',
    'I remember the moment when everything became appointments: scans, consults, waiting rooms. The hardest part was not the treatment — it was the uncertainty and the lack of a clear map. What helped was one nurse who wrote down next steps in plain language. What I wish decision-makers knew: patients don''t need more information; they need clearer pathways. One change that would matter: a single point of contact who stays with you across the journey.',
    'published',
    'the-day-my-diagnosis-became-a-calendar',
    array['diagnosis','navigation','communication'],
    false,
    'Maria van den Berg',
    true,
    false,
    now() - interval '14 days',
    now() - interval '12 days',
    now() - interval '12 days',
    now() - interval '10 days'
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'What access really means when you live outside the city',
    'Travel, costs, and invisible barriers that shape health outcomes.',
    'Access isn''t a policy word when you''re the one taking three buses for a 15-minute appointment. Every missed connection is a new stress. What didn''t help: being told to “just come earlier”. What helped: a local peer group sharing practical tips. What I wish decision-makers knew: logistics is part of care. One change that would matter: funding for community-based navigation and transport support.',
    'submitted',
    null,
    array['access','equity','logistics'],
    true,
    null,
    true,
    false,
    now() - interval '2 days',
    null,
    null,
    null
  )
on conflict (id) do nothing;

insert into public.patient_story_events (story_id, actor_id, action, notes, created_at) values
  ('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','published','Reviewed and published as a public patient story.', now() - interval '10 days'),
  ('50000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','submitted','Submitted for review.', now() - interval '2 days')
on conflict (id) do nothing;
