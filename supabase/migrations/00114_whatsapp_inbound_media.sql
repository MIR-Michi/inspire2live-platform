-- ============================================================
-- MIGRATION 00113: Inbound WhatsApp media (images / video / documents / audio)
--
-- WhatsApp Cloud API webhooks never carry the media bytes — only a media id.
-- The webhook now records that a message has media (media_type / mime / filename)
-- with media_status = 'pending', and a background step downloads the bytes from
-- the Graph API, stores them in a private bucket, and flips media_status to
-- 'stored' (or 'failed'). The inbox reads the file back via a short-lived signed
-- URL. Media may contain personal/patient information, so the bucket is PRIVATE.
-- ============================================================

alter table public.intake_items
  add column if not exists media_type text
    check (media_type is null or media_type in ('image', 'video', 'document', 'audio')),
  add column if not exists media_mime_type text,
  add column if not exists media_storage_path text,
  add column if not exists media_filename text,
  add column if not exists media_size bigint,
  add column if not exists media_status text not null default 'none'
    check (media_status in ('none', 'pending', 'stored', 'failed'));

comment on column public.intake_items.media_status is
  'none = text only; pending = media detected, download queued; stored = bytes in bucket; failed = download/store failed.';

-- Index the small set of items still awaiting/failing media download so a retry
-- sweep can find them cheaply.
create index if not exists idx_intake_items_media_pending
  on public.intake_items (media_status)
  where media_status in ('pending', 'failed');

-- Private bucket for inbound WhatsApp media. No public policy: the app serves
-- files through service-role-signed URLs only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'whatsapp-inbound-media',
  'whatsapp-inbound-media',
  false,
  104857600, -- 100 MB (WhatsApp's largest media class, documents)
  null       -- any mime type WhatsApp accepts
)
on conflict (id) do nothing;
