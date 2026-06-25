-- ============================================================
-- MIGRATION 00076: AI FOUNDATION
--
-- Adds the Sprint 14 foundation data layer:
-- - ai_settings: one org-wide AI configuration record managed by PlatformAdmin
-- - ai_usage_log: immutable-ish usage telemetry for cost and reliability tracking
-- ============================================================

create table if not exists public.ai_settings (
  singleton          boolean     primary key default true check (singleton),
  api_key_ciphertext text,
  api_key_last4      text,
  model              text        not null default 'claude-opus-4-8',
  effort             text        not null default 'high',
  updated_by         uuid        references auth.users(id) on delete set null,
  updated_at         timestamptz not null default now(),

  constraint ai_settings_model_check check (model in (
    'claude-opus-4-8',
    'claude-opus-4-7',
    'claude-sonnet-4-6',
    'claude-haiku-4-5',
    'claude-fable-5'
  )),
  constraint ai_settings_effort_check check (effort in ('none', 'low', 'medium', 'high', 'xhigh', 'max'))
);

comment on table public.ai_settings is 'Single org-wide AI configuration. API keys are encrypted by server code before storage and never returned to browsers.';
comment on column public.ai_settings.api_key_ciphertext is 'AES-GCM encrypted Anthropic API key. Decrypt only server-side.';
comment on column public.ai_settings.api_key_last4 is 'Non-secret display hint for admins. Never enough to reconstruct the API key.';

alter table public.ai_settings enable row level security;

drop policy if exists ai_settings_select_admin on public.ai_settings;
create policy ai_settings_select_admin on public.ai_settings
  for select to authenticated
  using (public.current_user_role() = 'PlatformAdmin');

drop policy if exists ai_settings_write_admin on public.ai_settings;
create policy ai_settings_write_admin on public.ai_settings
  for all to authenticated
  using (public.current_user_role() = 'PlatformAdmin')
  with check (public.current_user_role() = 'PlatformAdmin');

create table if not exists public.ai_usage_log (
  id                          uuid        primary key default gen_random_uuid(),
  feature                     text        not null,
  model                       text        not null,
  effort                      text        not null default 'none',
  input_tokens                integer     not null default 0 check (input_tokens >= 0),
  output_tokens               integer     not null default 0 check (output_tokens >= 0),
  cache_creation_input_tokens integer     not null default 0 check (cache_creation_input_tokens >= 0),
  cache_read_input_tokens     integer     not null default 0 check (cache_read_input_tokens >= 0),
  estimated_cost_usd          numeric(12, 6),
  latency_ms                  integer     not null default 0 check (latency_ms >= 0),
  success                     boolean     not null default true,
  error_code                  text,
  error_message               text,
  created_by                  uuid        references auth.users(id) on delete set null,
  created_at                  timestamptz not null default now()
);

comment on table public.ai_usage_log is 'AI usage telemetry written by the server-side AI wrapper. Used for spend, latency, and reliability review.';

create index if not exists idx_ai_usage_log_created_at on public.ai_usage_log (created_at desc);
create index if not exists idx_ai_usage_log_feature on public.ai_usage_log (feature, created_at desc);
create index if not exists idx_ai_usage_log_created_by on public.ai_usage_log (created_by, created_at desc);

alter table public.ai_usage_log enable row level security;

drop policy if exists ai_usage_log_select_admin on public.ai_usage_log;
create policy ai_usage_log_select_admin on public.ai_usage_log
  for select to authenticated
  using (public.current_user_role() = 'PlatformAdmin');

drop policy if exists ai_usage_log_select_own on public.ai_usage_log;
create policy ai_usage_log_select_own on public.ai_usage_log
  for select to authenticated
  using (created_by = auth.uid());

drop policy if exists ai_usage_log_insert_authenticated on public.ai_usage_log;
create policy ai_usage_log_insert_authenticated on public.ai_usage_log
  for insert to authenticated
  with check (created_by = auth.uid() or public.current_user_role() = 'PlatformAdmin');

drop policy if exists ai_usage_log_no_update on public.ai_usage_log;
create policy ai_usage_log_no_update on public.ai_usage_log
  for update to authenticated
  using (false);

drop policy if exists ai_usage_log_no_delete on public.ai_usage_log;
create policy ai_usage_log_no_delete on public.ai_usage_log
  for delete to authenticated
  using (false);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists ai_settings_set_updated_at on public.ai_settings;
create trigger ai_settings_set_updated_at
  before update on public.ai_settings
  for each row execute function public.set_updated_at();
