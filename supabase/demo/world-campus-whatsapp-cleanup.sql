-- Cleanup for demo layer: I2L World Campus WhatsApp mock content
--
-- Removes only rows created by supabase/demo/world-campus-whatsapp-seed.sql.
-- It uses deterministic IDs plus demo tags/provider-message prefixes so the
-- layer can be removed safely after the product demo.

delete from public.content_calendar
where id in (
  '90000000-0000-4000-8000-000000000501',
  '90000000-0000-4000-8000-000000000502',
  '90000000-0000-4000-8000-000000000503',
  '90000000-0000-4000-8000-000000000504'
)
or coalesce(tags, '{}') @> array['demo_world_campus_whatsapp'];

delete from public.whatsapp_webhook_events
where provider_message_id like 'demo-world-campus-whatsapp:%'
or payload ->> 'layer' = 'demo_world_campus_whatsapp';

update public.campus_sessions
set slides_media_id = null
where id in (
  '90000000-0000-4000-8000-000000000101',
  '90000000-0000-4000-8000-000000000102'
);

delete from public.media_assets
where id in (
  '90000000-0000-4000-8000-000000000301',
  '90000000-0000-4000-8000-000000000302',
  '90000000-0000-4000-8000-000000000303'
)
or coalesce(tags, '{}') @> array['demo_world_campus_whatsapp']
or storage_path like 'demo/world-campus-whatsapp/%';

delete from public.campus_sessions
where id in (
  '90000000-0000-4000-8000-000000000101',
  '90000000-0000-4000-8000-000000000102'
)
or recording_url like '%/our-world-campus/library/dr-mao-mao-on-the-future-of-multi-cancer-early-detection/%';

delete from public.campus_members
where id in (
  '90000000-0000-4000-8000-000000000201',
  '90000000-0000-4000-8000-000000000202',
  '90000000-0000-4000-8000-000000000203',
  '90000000-0000-4000-8000-000000000204',
  '90000000-0000-4000-8000-000000000205',
  '90000000-0000-4000-8000-000000000206'
)
or whatsapp_id like 'demo-world-campus:%';

delete from public.intake_items
where id in (
  '90000000-0000-4000-8000-000000000401',
  '90000000-0000-4000-8000-000000000402',
  '90000000-0000-4000-8000-000000000403',
  '90000000-0000-4000-8000-000000000404',
  '90000000-0000-4000-8000-000000000405',
  '90000000-0000-4000-8000-000000000406',
  '90000000-0000-4000-8000-000000000407',
  '90000000-0000-4000-8000-000000000408',
  '90000000-0000-4000-8000-000000000409',
  '90000000-0000-4000-8000-000000000410'
)
or provider_message_id like 'demo-world-campus-whatsapp:%'
or classifier_rule_ids @> array['demo_world_campus_whatsapp'];
