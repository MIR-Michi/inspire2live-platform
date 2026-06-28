-- ============================================================
-- MIGRATION 00102: Seed Inspire2Live community CRM import
--
-- Imports the curated Inspire2Live contact list into comms_crm_contacts and
-- comms_crm_contact_links. Idempotent: contacts upsert on normalized_email
-- (DO NOTHING), links upsert on (contact_id, kind, coalesce(url, label)).
--
-- Campus membership (is_campus_member) is set FROM SCRATCH here: only contacts
-- whose organisation/bio reference Inspire2Live / OncoInv / I2L / World Campus
-- are flagged. The legacy campus_members roster is intentionally NOT used.
-- contact_kind/segment are derived by the 00101 trigger.
--
-- Source: inspire2live_CRM.csv (54 rows; 34 flagged as campus members).
-- Generated; do not edit by hand.
-- ============================================================

insert into public.comms_crm_contacts
  (full_name, email, phone, linkedin_url, organisation, organisation_url, country, continent, bio, person_type, is_campus_member, source_label)
values
  ('Ella Weggen', 'ella.weggen@wemos.org', null, 'https://nl.linkedin.com/in/ella-weggen-90386212', 'Wemos', 'https://www.wemos.nl', 'Netherlands', 'Europe', 'Senior Global Health Advocate at Wemos (access-to-medicines advocacy), Amsterdam', 'patient_advocate', false, 'Inspire2Live CRM import'),
  ('Dominik Narres', 'dominik.narres@fresenius.com', null, 'https://de.linkedin.com/in/dominik-narres', 'Fresenius Group', 'https://www.fresenius.com', 'Germany', 'Europe', 'Senior Manager Public Funding, Fresenius Group; on the EASYGEN CAR-T cell-therapy consortium', null, false, 'Inspire2Live CRM import'),
  ('Rebecca Scheiwe', 'rebecca.scheiwe@fresenius.com', null, 'https://www.linkedin.com/in/anna-rebecca-scheiwe-a430101a5/', 'Fresenius SE', 'https://www.fresenius.com', 'Germany', 'Europe', 'Manager, Fresenius SE (full name Anna Rebecca Scheiwe); EASYGEN CAR-T consortium', null, false, 'Inspire2Live CRM import'),
  ('Martha Arevalo', 'martha.arevalo@minbuza.nl', null, null, 'Netherlands Ministry of Foreign Affairs', 'https://www.government.nl/ministries/ministry-of-foreign-affairs', 'Netherlands', 'Europe', 'Netherlands Ministry of Foreign Affairs (per email domain); individual role unconfirmed', 'governmental', false, 'Inspire2Live CRM import'),
  ('Gilly Mathieson Hudsons', 'gillymathiesonhudsons@gmail.com', null, null, 'Cancer Patients Europe; Luxembourg for Finance', 'https://cancerpatientseurope.org/member/gilly-mathieson/', 'Luxembourg', 'Europe', 'BBC journalist/documentary-maker & stage-4 digestive-cancer patient advocate; Cancer Patients Europe member; comms manager, Luxembourg for Finance', 'comms', false, 'Inspire2Live CRM import'),
  ('Tess Padayachee', 'padayacheet@who.int', null, 'https://nl.linkedin.com/in/thesandree-tess-padayachee-8688445', 'World Health Organization', 'https://www.who.int', null, null, 'Thesandree (''Tess'') Padayachee, World Health Organization (WHO)', 'governmental', false, 'Inspire2Live CRM import'),
  ('Peter Hoogweg', 'peterhoogweg@gmail.com', null, 'https://www.linkedin.com/in/peterhoogweg/', 'OncoInv; Dutch Ministry of Defence', 'https://oncoinv.org', 'Netherlands', 'Europe', 'Active with OncoInv (Inspire2Live''s early-detection social enterprise); day job at the Dutch Ministry of Defence', 'governmental', true, 'Inspire2Live CRM import'),
  ('Alberto Domingo', 'alberto.domingo@thermofisher.com', null, null, 'Thermo Fisher Scientific', 'https://www.thermofisher.com', null, null, 'Thermo Fisher Scientific (per email domain); individual role unconfirmed', null, false, 'Inspire2Live CRM import'),
  ('Evert', 'evert@longkankernederland.nl', null, null, 'Longkanker Nederland', 'https://longkankernederland.nl', 'Netherlands', 'Europe', 'Longkanker Nederland (Dutch lung-cancer patient organisation); first name only', 'patient_advocate', false, 'Inspire2Live CRM import'),
  ('Pieter Snijder', 'p.l.snijderthuis@gmail.com', null, null, null, null, null, null, 'Role/organisation unconfirmed', null, false, 'Inspire2Live CRM import'),
  ('Hesham Elghazaly', 'heshamelghazaly@hotmail.com', null, null, 'Egyptian Cancer Society; Ain Shams University; Alfa Cure Oncology Center', 'https://ecs.org.eg', 'Egypt', 'Africa', 'President of the Egyptian Cancer Society; Professor of Clinical Oncology, Ain Shams University; Founder & CEO, Alfa Cure Oncology Center; member, IARC Scientific Committee; leads Egypt''s Presidential Initiative for Women''s Health', 'governmental', false, 'Inspire2Live CRM import'),
  ('Adam', 'adam@cancerbot.org', null, null, 'cancerbot.org', 'https://cancerbot.org', null, null, 'cancerbot.org (first name only)', null, false, 'Inspire2Live CRM import'),
  ('Peter Kapitein', 'peter.kapitein@inspire2live.org', null, 'https://www.linkedin.com/in/peterkapitein/', 'Inspire2Live ; De Nederlandsche Bank', 'https://inspire2live.org', 'Netherlands', 'Europe', 'Founder & President, Inspire2Live; patient advocate (living with lymphoma since 2005); programme manager at De Nederlandsche Bank', 'patient_advocate', true, 'Inspire2Live CRM import'),
  ('Sofia Jubany', 'jubany.sofia@gmail.com', '+54 9 2216 19-0255', null, 'pulmon.ar (founder); IASLC STARS', null, 'Argentina', 'South America', 'Lung-cancer research advocate, Argentina; founder of pulmon.ar; IASLC STARS programme; 2026 World Conference on Lung Cancer speaker; speaker for this World Campus session', 'researcher', true, 'Inspire2Live CRM import'),
  ('Hana Nimer', 'hananimer@saidcrc.org', '+961 3 458 476', null, 'SAID-CRC; Inspire2Live', null, 'Lebanon', 'Asia', 'Inspire2Live patient advocate; SAID-CRC', 'patient_advocate', true, 'Inspire2Live CRM import'),
  ('Harry Verbunt', 'harry.verbunt@inspire2live.org', null, null, 'Inspire2Live', 'https://inspire2live.org', 'Netherlands', 'Europe', 'Inspire2Live patient advocate', 'patient_advocate', true, 'Inspire2Live CRM import'),
  ('Ingrid Kroeze', 'ingrid.kroeze@inspire2live.org', null, null, 'Inspire2Live', 'https://inspire2live.org', 'Netherlands', 'Europe', 'Inspire2Live communications team', 'comms', true, 'Inspire2Live CRM import'),
  ('Amit Kumar Jain', 'amit.kumar.jain@inspire2live.org', null, null, 'Inspire2Live', 'https://inspire2live.org', null, null, 'Inspire2Live patient advocate (MBA)', 'patient_advocate', true, 'Inspire2Live CRM import'),
  ('Ilona Schelle', 'ilona.schelle@inspire2live.org', null, 'https://www.linkedin.com/in/ilona-schelle-5ab7ba1b/', 'OncoInv', 'https://oncoinv.org', 'Netherlands', 'Europe', 'Director of Business Development at OncoInv; helps direct Inspire2Live operations; co-chair of this session', null, true, 'Inspire2Live CRM import'),
  ('Ieva Kotryna Kovalevskyte', 'ieva@inspire2live.org', null, null, 'Inspire2Live', 'https://inspire2live.org', null, null, 'Inspire2Live communications team', 'comms', true, 'Inspire2Live CRM import'),
  ('Jean-Christophe Chiem', 'Jean-Christophe.Chiem@one2treat.com', null, 'https://www.linkedin.com/in/jeanchristophechiem/', 'One2Treat', 'https://one2treat.com', 'Belgium', 'Europe', 'Product Manager, eClinical Solutions at One2Treat (patient-centric clinical trials); Inspire2Live advocate; PhD public health', 'patient_advocate', true, 'Inspire2Live CRM import'),
  ('Carmen Loiselle', 'carmen.g.loiselle@mcgill.ca', null, null, 'McGill University', 'https://www.mcgill.ca', 'Canada', 'North America', 'Professor, Dept. of Oncology & Ingram School of Nursing, McGill University; Hope & Cope Chair in Psychosocial Oncology; President, Canadian Assoc. of Psychosocial Oncology; I2L advocate', 'clinician', true, 'Inspire2Live CRM import'),
  ('Piarella Peralta', 'piarella.peralta@inspire2live.org', null, 'https://nl.linkedin.com/in/piarella-peralta', 'Illumina ; Inspire2Live', 'https://www.illumina.com', 'Netherlands', 'Europe', 'Patient Advocacy Specialist, EMEA at Illumina; long-time Inspire2Live patient advocate; co-chair of this session', 'patient_advocate', true, 'Inspire2Live CRM import'),
  ('Carlo La Vecchia', 'carlo.lavecchia@unimi.it', null, null, 'University of Milan', 'https://www.unimi.it', 'Italy', 'Europe', 'Professor of Epidemiology & Biostatistics, University of Milan; world authority on cancer aetiology; Inspire2Live advocate', 'researcher', true, 'Inspire2Live CRM import'),
  ('Daniel Gomez', 'daniel.e.gomez.700@gmail.com', '+54 9 11 5893-9983', null, 'Inspire2Live', 'https://inspire2live.org', 'Argentina', 'South America', 'Inspire2Live patient advocate; speaker at the 2024 I2L Annual Congress', 'patient_advocate', true, 'Inspire2Live CRM import'),
  ('Franklin Mtei', 'franklinmtei@gmail.com', '+255 717 056 026', 'https://www.linkedin.com/in/franklin-mtei-48842195', 'Inspire2Live', 'https://inspire2live.org', 'Tanzania', 'Africa', 'Healthcare Consultant & Global Patient Advocate, Inspire2Live (Tanzania)', 'patient_advocate', true, 'Inspire2Live CRM import'),
  ('Diane Heditsian', 'dianeheditsian@gmail.com', null, 'https://www.linkedin.com/in/dianeheditsian/', 'deClarity (founder/CEO); Inspire2Live', null, 'United States', 'North America', 'Founder & CEO, deClarity (life-science communications); breast-cancer research advocate (UCSF/Stanford); Inspire2Live member', 'researcher', true, 'Inspire2Live CRM import'),
  ('Núria Malats', 'nmalats@cnio.es', null, null, 'CNIO - Spanish National Cancer Research Centre', 'https://www.cnio.es', 'Spain', 'Europe', 'Head of the Genetic & Molecular Epidemiology Group (Senior Group Leader), CNIO – Spanish National Cancer Research Centre, Madrid; Inspire2Live advocate', 'researcher', true, 'Inspire2Live CRM import'),
  ('Marwa Amer', 'marwa.amer@must.edu.eg', null, null, 'Misr University for Science & Technology', 'https://www.must.edu.eg', 'Egypt', 'Africa', 'Assistant Professor, Faculty of Biotechnology (bioinformatics/cancer biology), Misr University for Science & Technology, Cairo', 'researcher', false, 'Inspire2Live CRM import'),
  ('Nest of Hope Community', 'nestofhopecommunity@gmail.com', '+234 704 626 4458', null, null, null, 'Nigeria', 'Africa', 'Organisation (cancer-community group), not an individual', null, false, 'Inspire2Live CRM import'),
  ('Beatrice Wiafe Addai', 'drwiafe@gmail.com', '+233 24 191 8187', 'https://www.linkedin.com/in/dr-beatrice-addai-wiafe-18460355/', 'Breast Care International; Peace and Love Hospitals', 'https://breastcareinternational.org', 'Ghana', 'Africa', 'Founder & President, Breast Care International; CEO/Consultant Breast Surgeon, Peace and Love Hospitals, Ghana; Inspire2Live advocate', 'clinician', true, 'Inspire2Live CRM import'),
  ('Christian Ntizimira', 'christian.ntizimira@acreol.org', null, 'https://www.linkedin.com/in/christian-ntizimira-4a035833', 'ACREOL - African Center for Research on End-of-Life Care', 'https://acreol.org', 'Rwanda', 'Africa', 'Founder & Executive Director, ACREOL (African Center for Research on End-of-Life Care), Rwanda; palliative-care leader', null, false, 'Inspire2Live CRM import'),
  ('Jesper Verhey', 'jesper.verhey@oncoinv.org', null, 'https://www.linkedin.com/in/jesperverhey/', 'OncoInv', 'https://oncoinv.org', 'Netherlands', 'Europe', 'CEO of OncoInv (Inspire2Live''s multi-cancer early-detection social enterprise; OncoSeek blood test)', null, true, 'Inspire2Live CRM import'),
  ('Paul Eno', 'deapostle22@gmail.com', '+234 810 965 3919', null, 'Inspire2Live', 'https://inspire2live.org', 'Nigeria', 'Africa', 'Inspire2Live patient advocate (listed as ''Apostle Paul Eno'')', 'patient_advocate', true, 'Inspire2Live CRM import'),
  ('Jeffrey Waldron', 'jeffreyrwaldron@gmail.com', '+1 (508) 667-5552', null, 'Inspire2Live', 'https://inspire2live.org', 'United States', 'North America', 'Inspire2Live patient advocate', 'patient_advocate', true, 'Inspire2Live CRM import'),
  ('Maryam Israr', 'maryamisrar031@gmail.com', null, null, null, null, null, null, 'Role/organisation unconfirmed (possible match at Dow University, Karachi)', 'researcher', false, 'Inspire2Live CRM import'),
  ('Dominik Griebling', 'dominik.griebling@fresenius.com', null, null, 'Fresenius', 'https://www.fresenius.com', 'Germany', 'Europe', 'Fresenius (per email domain; same org as confirmed colleagues Narres & Scheiwe); individual role unconfirmed', null, false, 'Inspire2Live CRM import'),
  ('Robert Greene', 'robert.greene@pi-af.org', '+31 6 43017116', 'https://www.linkedin.com/in/robertsgreene/', 'Patient Inclusive Advocacy Foundation ; Inspire2Live', 'https://pi-af.org', 'Netherlands', 'Europe', 'Founder & President, Patient Inclusive Advocacy Foundation (formerly HungerNdThirst); Inspire2Live advocate; colon & prostate cancer survivor', 'patient_advocate', true, 'Inspire2Live CRM import'),
  ('Giulia Lima', 'giulia.lima@oncoinv.org', '+55 51 8144-7797', null, 'OncoInv', 'https://oncoinv.org', 'Brazil', 'South America', 'OncoInv — Inspire2Live''s multi-cancer early-detection social enterprise', null, true, 'Inspire2Live CRM import'),
  ('Liz O''Riordan', 'liz@oriordan.co.uk', '+44 7725 443746', 'https://www.linkedin.com/in/liz-o''riordan-5640b4272', 'Independent - author & keynote speaker', 'https://oriordan.co.uk', 'United Kingdom', 'Europe', 'Retired consultant breast surgeon, author & speaker; breast-cancer awareness advocate (UK)', 'clinician', false, 'Inspire2Live CRM import'),
  ('Ifeoma Okoye', 'ifeoma.okoye@unn.edu.ng', null, 'https://www.linkedin.com/in/profifeomaokoye/', 'University of Nigeria Nsukka / UNNCECT; Breast Without Spot', 'https://www.unn.edu.ng', 'Nigeria', 'Africa', 'Emeritus Professor of Radiation Medicine, University of Nigeria Nsukka; Director, UNN Centre of Excellence for Clinical Trials; founder, Breast Without Spot; Inspire2Live ''Hero of Cancer''', 'clinician', true, 'Inspire2Live CRM import'),
  ('Ligia Pereira Castro', 'ligia.pereiracastro@gmail.com', '+55 62 9984-5924', null, 'Inspire2Live', 'https://inspire2live.org', 'Brazil', 'South America', 'Inspire2Live patient advocate (listed as ''Ligia Castro'')', 'patient_advocate', true, 'Inspire2Live CRM import'),
  ('Anis Mansour', 'anis.mansour@inspire2live.org', '+20 15 00012000', 'https://www.linkedin.com/in/anismmansour/', 'Sharabassy Built-Environment Studio; Inspire2Live', null, 'Egypt', 'Africa', 'Architect (Technical Director, Sharabassy Built-Environment Studio); Inspire2Live patient advocate & lymphoma survivor, Egypt; founder of ''We Want Life''', 'patient_advocate', true, 'Inspire2Live CRM import'),
  ('Peter Allen', 'Pallen1512@outlook.com', null, null, null, null, null, null, 'Role/organisation unconfirmed', null, false, 'Inspire2Live CRM import'),
  ('Natacha Bolaños', 'natachab@lymphomacoalition.org', '+34 663 33 45 71', 'https://es.linkedin.com/in/natacha-bolaños-a6b8a23b', 'Lymphoma Coalition', 'https://lymphomacoalition.org', 'Spain', 'Europe', 'Head of Membership & Alliances / Regional Manager Europe, Lymphoma Coalition; Inspire2Live advocate', 'patient_advocate', true, 'Inspire2Live CRM import'),
  ('Harry Verbunt', 'harry.verbunt@hotmail.com', null, null, 'Inspire2Live', 'https://inspire2live.org', 'Netherlands', 'Europe', 'Inspire2Live patient advocate (2nd listing, personal email)', 'patient_advocate', true, 'Inspire2Live CRM import'),
  ('Eltjo Heddema', 'eltjo.heddema@inspire2live.org', null, 'https://www.linkedin.com/in/eltjo', 'Inspire2Live / OncoInv', 'https://oncoinv.org', 'Netherlands', 'Europe', 'Project Manager at Inspire2Live / OncoInv (multi-cancer early detection); ex-De Nederlandsche Bank & IBM; I2L patient advocate', 'patient_advocate', true, 'Inspire2Live CRM import'),
  ('HENARAN Foundation', 'henaran.fund@gmail.com', null, null, null, null, null, null, 'Organisation (foundation), not an individual', null, false, 'Inspire2Live CRM import'),
  ('Aboubacar Kaba', 'aboubacar.kaba@inspire2live.org', '+221 78 470 76 56', null, 'Inspire2Live - Guinea', 'https://inspire2live.org', 'Guinea', 'Africa', 'Inspire2Live patient advocate (Guinea)', 'patient_advocate', true, 'Inspire2Live CRM import'),
  ('Patty Gemmill', 'patty.gemmill@inspire2live.org', '+1 (704) 968-8882', null, 'Inspire2Live', 'https://inspire2live.org', 'United States', 'North America', 'Inspire2Live', null, true, 'Inspire2Live CRM import'),
  ('Richard Buck', 'rab2024@gmail.com', '+34 626 58 88 21', null, null, null, 'Spain', 'Europe', 'Role/organisation unconfirmed', null, false, 'Inspire2Live CRM import'),
  ('Aishwarya Desale', 'ardesale.design@gmail.com', null, null, 'Inspire2Live', 'https://inspire2live.org', null, null, 'Inspire2Live patient advocate (design background)', 'patient_advocate', true, 'Inspire2Live CRM import'),
  ('Nibedita Rath', 'nibedita.rath@ospfound.org', '+91 99005 06286', null, 'Open Source Pharma Foundation', 'https://www.ospfound.org', 'India', 'Asia', 'Open Source Pharma Foundation (OSPF), India; Inspire2Live advocate (drug repurposing)', 'patient_advocate', true, 'Inspire2Live CRM import'),
  ('Gladys Honein', 'gh30@aub.edu.lb', '+961 81 299 508', null, 'American University of Beirut - Hariri School of Nursing', 'https://www.aub.edu.lb', 'Lebanon', 'Asia', 'Associate Professor, Hariri School of Nursing, American University of Beirut; Inspire2Live advocate (full name Gladys N. Honein-AbouHaidar)', 'clinician', true, 'Inspire2Live CRM import')
on conflict (normalized_email) where normalized_email is not null do nothing;

insert into public.comms_crm_contact_links (contact_id, kind, label, url, position)
select c.id, v.kind, v.label, v.url, v.position
from (values
  ('dominik.narres@fresenius.com', 'media', 'EASYGEN CAR-T consortium launch', 'https://www.fresenius.com/pressrelease-easygen', 1),
  ('rebecca.scheiwe@fresenius.com', 'publication', 'Co-author, dialysis-membrane symposium review, Front. Med. 2024', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11520239/', 1),
  ('gillymathiesonhudsons@gmail.com', 'talk', 'ENTERO24 digestive-cancer advocacy panel (2024)', null, 1),
  ('gillymathiesonhudsons@gmail.com', 'media', 'OncoDaily blog', 'https://oncodaily.com/blog/189399', 2),
  ('gillymathiesonhudsons@gmail.com', 'media', 'BBC documentary ''The Hudsons Bay Boys''', null, 3),
  ('peterhoogweg@gmail.com', 'media', 'LinkedIn posts on OncoSeek/OncoInv', 'https://www.linkedin.com/in/peterhoogweg/', 1),
  ('heshamelghazaly@hotmail.com', 'publication', 'Google Scholar', 'https://scholar.google.com/citations?user=1N9yTIEAAAAJ', 1),
  ('heshamelghazaly@hotmail.com', 'talk', 'GBCC 2026, moderator', 'https://oncodaily.com/voices/hesham-elghazaly-494012', 2),
  ('heshamelghazaly@hotmail.com', 'talk', 'ASCO-ECS Strategic Dialogue, Chicago Jun 2026', 'https://oncodaily.com/voices/hesham-elghazaly-515978', 3),
  ('heshamelghazaly@hotmail.com', 'talk', 'IARC 60th-anniversary remarks', 'https://oncodaily.com/voices/hesham-elghazaly-520185', 4),
  ('heshamelghazaly@hotmail.com', 'talk', 'ESMO Early Breast Cancer Scientific Committee', 'https://oncodaily.com/voices/hesham-elghazaly-469722', 5),
  ('heshamelghazaly@hotmail.com', 'media', 'OncoDaily author page', 'https://oncodaily.com/voices/hesham-elghazaly-527658', 6),
  ('peter.kapitein@inspire2live.org', 'publication', 'Memoir ''Ik heb kanker / I Have Cancer''', null, 1),
  ('peter.kapitein@inspire2live.org', 'publication', 'columns at HealthManagement.org', 'https://healthmanagement.org/viewProfile/98696/Peter_Kapitein', 2),
  ('peter.kapitein@inspire2live.org', 'talk', 'Inspire2Live Annual Congress (host)', null, 3),
  ('peter.kapitein@inspire2live.org', 'talk', 'Green Transition 2023, Sofia', 'https://greentransition.bg', 4),
  ('peter.kapitein@inspire2live.org', 'media', 'Volkskrant interview', 'http://inspire2live.org/interview-peter-kapitein/', 5),
  ('peter.kapitein@inspire2live.org', 'media', 'European Cancer Organisation profile', 'https://www.europeancancer.org/content/peter-kapitein.html', 6),
  ('jubany.sofia@gmail.com', 'talk', '2026 World Conference on Lung Cancer, guest speaker', 'https://www.iaslc.org/iaslc-news/press-release/personal-loss-research-advocacy', 1),
  ('jubany.sofia@gmail.com', 'talk', 'I2L World Campus speaker', null, 2),
  ('jubany.sofia@gmail.com', 'media', 'IASLC feature', 'https://www.iaslc.org/iaslc-news/press-release/personal-loss-research-advocacy', 3),
  ('jubany.sofia@gmail.com', 'media', 'OncoDaily', 'https://oncodaily.com/voices/sofia-jubany-468253', 4),
  ('jean-christophe.chiem@one2treat.com', 'publication', 'ResearchGate', 'https://www.researchgate.net/profile/Jean-Christophe-Chiem', 1),
  ('jean-christophe.chiem@one2treat.com', 'publication', 'Google Scholar', 'https://scholar.google.com/citations?user=iVCYe1EAAAAJ', 2),
  ('jean-christophe.chiem@one2treat.com', 'talk', 'IDDI real-world-evidence webinar', null, 3),
  ('jean-christophe.chiem@one2treat.com', 'media', 'Inspire2Live advocate profile', 'https://inspire2live.org/about-us/patient-advocacy/meet-our-patient-advocates/jean-christophe-chiem/', 4),
  ('carmen.g.loiselle@mcgill.ca', 'publication', '160+ papers', null, 1),
  ('carmen.g.loiselle@mcgill.ca', 'publication', 'Loiselle Lab', 'https://www.loisellelab.ca/', 2),
  ('carmen.g.loiselle@mcgill.ca', 'publication', 'McGill faculty page', 'https://www.mcgill.ca/nursing/about/faculty/faculty-directory/carmen-g-loiselle', 3),
  ('piarella.peralta@inspire2live.org', 'talk', 'Biotech Atelier speaker', 'https://biotech-atelier.com/speakers/piarella-peralta/', 1),
  ('carlo.lavecchia@unimi.it', 'publication', 'One of the world''s most-cited cancer epidemiologists', null, 1),
  ('carlo.lavecchia@unimi.it', 'publication', '1000+ papers (PubMed: )', 'https://pubmed.ncbi.nlm.nih.gov/?term=La+Vecchia+C', 2),
  ('franklinmtei@gmail.com', 'media', 'LinkedIn', 'https://www.linkedin.com/in/franklin-mtei-48842195', 1),
  ('dianeheditsian@gmail.com', 'talk', 'Breast-cancer research advocacy, UCSF/Stanford', null, 1),
  ('nmalats@cnio.es', 'publication', '300+ papers, h-index 81', null, 1),
  ('nmalats@cnio.es', 'publication', 'ResearchGate', 'https://www.researchgate.net/profile/Nuria-Malats', 2),
  ('nmalats@cnio.es', 'publication', 'ORCID', 'https://orcid.org/0000-0003-2538-3784', 3),
  ('drwiafe@gmail.com', 'publication', 'Wikipedia', 'https://en.wikipedia.org/wiki/Beatrice_Wiafe_Addai', 1),
  ('drwiafe@gmail.com', 'publication', 'Purdue IBCN bio', 'https://www.purdue.edu/discoverypark/ibcn/assets/pdfs/Wiafe%20Addai%20bio.pdf', 2),
  ('drwiafe@gmail.com', 'talk', 'ecancer interview, 2019 CC-LMIC meeting', 'https://ecancer.org/en/video/8844', 3),
  ('drwiafe@gmail.com', 'talk', 'Milan & Berlin Breast Cancer Conferences', null, 4),
  ('drwiafe@gmail.com', 'media', 'Direct Relief feature, 2025', 'https://www.directrelief.org/2025/09/changing-ghanas-fight-against-breast-cancer/', 5),
  ('christian.ntizimira@acreol.org', 'publication', 'Book ''The Safari Concept: An African Framework on End-of-Life Care'' (Batinya, 2023)', 'https://www.amazon.com/Safari-Concept-African-Framework-Life/dp/B0C7F97HMR', 1),
  ('christian.ntizimira@acreol.org', 'talk', 'Stanford event', 'https://events.stanford.edu/event/the-safari-concept-an-african-framework-for-end-of-life-care', 2),
  ('christian.ntizimira@acreol.org', 'talk', 'ecancer video', 'https://ecancer.org/en/video/11755-the-safari-concept', 3),
  ('christian.ntizimira@acreol.org', 'media', '''Conversations About Advance Care Planning'' podcast #85', 'https://conversationsaboutadvancecareplanning.libsyn.com/85-the-safari-concept-with-dr-christian-ntizimira', 4),
  ('christian.ntizimira@acreol.org', 'media', 'OncoDaily', 'https://oncodaily.com/voices/christian-ntizimira-481271', 5),
  ('jesper.verhey@oncoinv.org', 'media', 'OncoInv / TFHC profile', 'https://tfhc.nl/oncoinv-expanding-access-to-early-cancer-detection/', 1),
  ('robert.greene@pi-af.org', 'publication', 'Co-author, ERN GENTURIS hereditary-cancer germline-testing study (2025)', null, 1),
  ('robert.greene@pi-af.org', 'media', 'European Cancer Organisation profile', 'https://www.europeancancer.org/content/robert-greene2.html', 2),
  ('robert.greene@pi-af.org', 'media', 'LinkedIn', 'https://www.linkedin.com/in/robertsgreene/', 3),
  ('liz@oriordan.co.uk', 'publication', 'Books ''The Complete Guide to Breast Cancer'' (2018), ''Under the Knife'' (2023), ''The Cancer Roadmap'' (2024) - Amazon', 'https://www.amazon.com/stores/author/B07DVN268B', 1),
  ('liz@oriordan.co.uk', 'publication', 'academic paper, ecancermedicalscience 2019', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6974364/', 2),
  ('liz@oriordan.co.uk', 'talk', 'TEDx Stuttgart ''The Jar of Joy'' (2016)', 'https://www.youtube.com/watch?v=Wc1PIAG8Bgg', 3),
  ('liz@oriordan.co.uk', 'media', 'Podcast ''So Now I''ve Got Breast Cancer''', null, 4),
  ('liz@oriordan.co.uk', 'media', 'BBC R5 ''You, Me and the Big C''', null, 5),
  ('liz@oriordan.co.uk', 'media', 'Wikipedia', 'https://en.wikipedia.org/wiki/Liz_O%27Riordan', 6),
  ('ifeoma.okoye@unn.edu.ng', 'publication', 'Google Scholar', 'https://scholar.google.com/citations?user=yH61aPAAAAAJ', 1),
  ('ifeoma.okoye@unn.edu.ng', 'publication', '6 books incl. ''Enthroning Early Detection of Breast Cancer in Nigeria''', null, 2),
  ('ifeoma.okoye@unn.edu.ng', 'talk', 'Free LMICs Radiology Series with Stanford (CME lectures)', null, 3),
  ('ifeoma.okoye@unn.edu.ng', 'talk', 'Nigerian Clinical Trial Summit', null, 4),
  ('ifeoma.okoye@unn.edu.ng', 'media', 'LinkedIn', 'https://www.linkedin.com/in/profifeomaokoye/', 5),
  ('anis.mansour@inspire2live.org', 'media', 'Inspire2Live advocate profile', 'https://inspire2live.org/about-us/patient-advocacy/meet-our-patient-advocates/anis-mansour/', 1),
  ('natachab@lymphomacoalition.org', 'publication', 'HemaSphere 2025', 'https://onlinelibrary.wiley.com/doi/10.1002/hem3.70204', 1),
  ('natachab@lymphomacoalition.org', 'publication', 'Lancet/SSRN preprint 2026', 'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6841440', 2),
  ('natachab@lymphomacoalition.org', 'publication', 'ResearchGate', 'https://www.researchgate.net/profile/Natacha-Bolanos', 3),
  ('natachab@lymphomacoalition.org', 'talk', 'VJHemOnc speaker videos', 'https://www.vjhemonc.com/speaker/natacha-bolanos/', 4),
  ('natachab@lymphomacoalition.org', 'talk', 'EBMT 2024 Patient Advocacy', null, 5),
  ('natachab@lymphomacoalition.org', 'media', 'PharmaBoardroom interview', 'https://pharmaboardroom.com/interviews/natacha-bolanos-global-alliances-manager-regional-manager-europe-lymphoma-coalition/', 6),
  ('eltjo.heddema@inspire2live.org', 'media', 'BNR Nieuwsradio appearances', null, 1),
  ('eltjo.heddema@inspire2live.org', 'media', 'LinkedIn', 'https://www.linkedin.com/in/eltjo', 2)
) as v(email, kind, label, url, position)
join public.comms_crm_contacts c on c.normalized_email = v.email
on conflict (contact_id, kind, coalesce(url, label)) do nothing;

notify pgrst, 'reload schema';
