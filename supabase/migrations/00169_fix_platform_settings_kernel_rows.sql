-- ============================================================
-- MIGRATION 00169: FIX KERNEL PLATFORM SETTINGS ROWS
--
-- Migration 00159 used (scope, key, component_id) as a primary key while
-- kernel-owned rows intentionally use component_id IS NULL. PostgreSQL makes
-- every primary-key column NOT NULL, so Organization and Design panel saves
-- failed before the first kernel row could be inserted.
--
-- Keep the existing coalesced unique index as the logical key and remove the
-- incompatible composite primary key. The table is a small configuration store
-- addressed through explicit scope/component/key filters, so a surrogate key is
-- unnecessary.
-- ============================================================

alter table public.platform_settings
  drop constraint if exists platform_settings_pkey;

alter table public.platform_settings
  alter column component_id drop not null;

create unique index if not exists platform_settings_unique_key
  on public.platform_settings (scope, coalesce(component_id, ''), key);

comment on table public.platform_settings is
  'Kernel-owned Platform Settings store (ADR-0010). Kernel rows use component_id NULL; component rows use their manifest id.';

notify pgrst, 'reload schema';
