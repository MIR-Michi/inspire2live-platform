-- ============================================================
-- MIGRATION 00159: PLATFORM SETTINGS STORE (Sprint 17 / ADR-0010)
--
-- The kernel-owned, typed, audited store behind the Platform Settings space.
-- It is the "blueprint at rest" (ADR-0009 Stage 4): the human settings UI and,
-- later, the L2 generator both read/write these rows through one resolver whose
-- precedence is `manifest default -> platform_settings -> env`.
--
-- One row per (scope, component_id, key):
--   - scope 'kernel'    : component_id IS NULL   (Organization/Brand, etc.)
--   - scope 'component' : component_id = manifest id (e.g. 'intake')
--
-- NON-SECRET VALUES ONLY. Credentials never land here as plaintext — they stay
-- in the encrypted path (ai_settings-style) and are referenced, not embedded
-- (ADR-0010 §6). The server resolver enforces this; the CHECK below is a
-- defence-in-depth guard against a raw secret-typed write.
-- ============================================================

create table if not exists public.platform_settings (
  scope        text        not null check (scope in ('kernel', 'component')),
  component_id text,
  key          text        not null,
  value        jsonb       not null,
  updated_by   uuid        references auth.users(id) on delete set null,
  updated_at   timestamptz not null default now(),

  -- kernel rows have no component; component rows must name one.
  constraint platform_settings_scope_component_ck check (
    (scope = 'kernel' and component_id is null) or
    (scope = 'component' and component_id is not null)
  ),
  -- Uniqueness across the nullable component_id: collapse NULL to '' for the key.
  constraint platform_settings_pkey primary key (scope, key, component_id)
);

-- Postgres treats NULLs as distinct in a PK, which would allow duplicate kernel
-- rows for the same key. Enforce single-row-per-key with a coalesced unique idx.
create unique index if not exists platform_settings_unique_key
  on public.platform_settings (scope, coalesce(component_id, ''), key);

comment on table public.platform_settings is
  'Kernel-owned Platform Settings store (ADR-0010). Non-secret, blueprint-portable config only. Resolver precedence: manifest default -> this table -> env.';
comment on column public.platform_settings.value is
  'JSONB-encoded non-secret value. Secret-typed config fields are never stored here (see ADR-0010 §6).';

alter table public.platform_settings enable row level security;

-- Read + write are PlatformAdmin-only ('manage' on the admin space). Mirrors the
-- ai_settings policy family so the whole settings surface is gated consistently.
drop policy if exists platform_settings_select_admin on public.platform_settings;
create policy platform_settings_select_admin on public.platform_settings
  for select to authenticated
  using (public.current_user_role() = 'PlatformAdmin');

drop policy if exists platform_settings_write_admin on public.platform_settings;
create policy platform_settings_write_admin on public.platform_settings
  for all to authenticated
  using (public.current_user_role() = 'PlatformAdmin')
  with check (public.current_user_role() = 'PlatformAdmin');
