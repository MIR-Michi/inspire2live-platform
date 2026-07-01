-- ============================================================
-- MIGRATION 00112: Guest conference resolution
--
-- Guests can report a conference that is not yet in the platform. Those manual
-- entries should become real rows in public.conferences so the team sees them in
-- the Conferences space and future guests can find them via autocomplete.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- Rewrite submit_conference_guest_form so manual conference names are resolved
-- into public.conferences before the guest submission is stored.
create or replace function public.submit_conference_guest_form(
  p_raw_token           text,
  p_submitter_name      text,
  p_submitter_email     text,
  p_submitter_phone     text,
  p_submitter_org       text,
  p_conference_id       uuid,
  p_conference_name     text,
  p_conference_start    date,
  p_conference_end      date,
  p_conference_location text,
  p_role                text,
  p_notes               text,
  p_is_registered       boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash             text;
  v_token_id         uuid;
  v_sub_id           uuid;
  v_creator_id       uuid;
  v_target_stage     text;
  v_conference_id    uuid;
  v_slug             text;
  v_dedupe_key       text;
begin
  v_hash := encode(extensions.digest(p_raw_token, 'sha256'), 'hex');

  select id, created_by into v_token_id, v_creator_id
  from public.conference_guest_tokens
  where token_hash = v_hash
    and revoked_at is null
    and expires_at > now();

  if v_token_id is null then
    raise exception 'invalid_token';
  end if;

  v_conference_id := p_conference_id;

  if v_conference_id is null then
    v_slug := trim(both '-' from regexp_replace(lower(trim(p_conference_name)), '[^a-z0-9]+', '-', 'g'));
    if v_slug is null or v_slug = '' then
      v_slug := 'guest-conference';
    end if;
    v_dedupe_key := 'guest-' || left(v_slug, 96) || '-' || coalesce(to_char(p_conference_start, 'YYYY-MM'), 'unscheduled');

    select id into v_conference_id
    from public.conferences
    where lower(trim(name)) = lower(trim(p_conference_name))
      and start_date is not distinct from p_conference_start
    order by discovered_at desc
    limit 1;

    if v_conference_id is null then
      insert into public.conferences (
        name,
        organizer,
        region,
        location,
        main_focus,
        topics,
        format,
        start_date,
        end_date,
        website_url,
        source_url,
        summary,
        relevance,
        dedupe_key,
        created_by
      ) values (
        p_conference_name,
        null,
        'global',
        p_conference_location,
        null,
        '{}',
        'in_person',
        p_conference_start,
        p_conference_end,
        null,
        'guest-submission',
        'Created from a guest attendance report.',
        50,
        v_dedupe_key,
        v_creator_id
      )
      on conflict (dedupe_key) do update
        set name = excluded.name,
            location = coalesce(public.conferences.location, excluded.location),
            start_date = coalesce(public.conferences.start_date, excluded.start_date),
            end_date = coalesce(public.conferences.end_date, excluded.end_date),
            updated_at = now()
      returning id into v_conference_id;
    end if;
  end if;

  insert into public.conference_guest_submissions (
    token_id, submitter_name, submitter_email, submitter_phone,
    submitter_organisation, conference_id, conference_name,
    conference_start_date, conference_end_date, conference_location,
    role_at_conference, notes, is_registered
  ) values (
    v_token_id, p_submitter_name, p_submitter_email, p_submitter_phone,
    p_submitter_org, v_conference_id, p_conference_name,
    p_conference_start, p_conference_end, p_conference_location,
    p_role, p_notes, coalesce(p_is_registered, false)
  )
  returning id into v_sub_id;

  update public.conference_guest_tokens
  set used_count = used_count + 1
  where id = v_token_id;

  if v_conference_id is not null then
    v_target_stage := case when coalesce(p_is_registered, false) then 'registered' else 'intended' end;

    insert into public.conference_tracking (conference_id, stage, added_by)
    values (v_conference_id, v_target_stage, v_creator_id)
    on conflict (conference_id) do update
      set stage = case
        when conference_tracking.stage = 'archived' then conference_tracking.stage
        when conference_tracking.stage = 'follow_up' then conference_tracking.stage
        when conference_tracking.stage = 'ongoing' then conference_tracking.stage
        when conference_tracking.stage = 'registered' and v_target_stage = 'intended' then conference_tracking.stage
        else v_target_stage
      end,
      updated_at = now();
  end if;

  return jsonb_build_object(
    'submissionId', v_sub_id,
    'creatorId', v_creator_id
  );
end;
$$;

revoke all on function public.submit_conference_guest_form(text,text,text,text,text,uuid,text,date,date,text,text,text,boolean) from public;
grant execute on function public.submit_conference_guest_form(text,text,text,text,text,uuid,text,date,date,text,text,text,boolean) to anon;
grant execute on function public.submit_conference_guest_form(text,text,text,text,text,uuid,text,date,date,text,text,text,boolean) to authenticated;

-- Backfill existing manual guest submissions that were stored only as free text.
do $$
declare
  rec record;
  v_conf_id uuid;
  v_slug text;
  v_dedupe_key text;
begin
  for rec in
    select
      lower(trim(s.conference_name)) as name_key,
      min(s.conference_name) as conference_name,
      s.conference_start_date,
      s.conference_end_date,
      min(s.conference_location) as conference_location,
      (array_agg(t.created_by order by s.created_at desc))[1] as created_by,
      bool_or(s.is_registered) as any_registered
    from public.conference_guest_submissions s
    join public.conference_guest_tokens t on t.id = s.token_id
    where s.conference_id is null
      and trim(s.conference_name) <> ''
    group by lower(trim(s.conference_name)), s.conference_start_date, s.conference_end_date
  loop
    v_slug := trim(both '-' from regexp_replace(lower(trim(rec.conference_name)), '[^a-z0-9]+', '-', 'g'));
    if v_slug is null or v_slug = '' then
      v_slug := 'guest-conference';
    end if;
    v_dedupe_key := 'guest-' || left(v_slug, 96) || '-' || coalesce(to_char(rec.conference_start_date, 'YYYY-MM'), 'unscheduled');

    select id into v_conf_id
    from public.conferences
    where lower(trim(name)) = rec.name_key
      and start_date is not distinct from rec.conference_start_date
    order by discovered_at desc
    limit 1;

    if v_conf_id is null then
      insert into public.conferences (
        name,
        organizer,
        region,
        location,
        main_focus,
        topics,
        format,
        start_date,
        end_date,
        website_url,
        source_url,
        summary,
        relevance,
        dedupe_key,
        created_by
      ) values (
        rec.conference_name,
        null,
        'global',
        rec.conference_location,
        null,
        '{}',
        'in_person',
        rec.conference_start_date,
        rec.conference_end_date,
        null,
        'guest-submission',
        'Created from a guest attendance report.',
        50,
        v_dedupe_key,
        rec.created_by
      )
      on conflict (dedupe_key) do update
        set name = excluded.name,
            location = coalesce(public.conferences.location, excluded.location),
            start_date = coalesce(public.conferences.start_date, excluded.start_date),
            end_date = coalesce(public.conferences.end_date, excluded.end_date),
            updated_at = now()
      returning id into v_conf_id;
    end if;

    update public.conference_guest_submissions s
    set conference_id = v_conf_id,
        updated_at = now()
    where s.conference_id is null
      and lower(trim(s.conference_name)) = rec.name_key
      and s.conference_start_date is not distinct from rec.conference_start_date
      and s.conference_end_date is not distinct from rec.conference_end_date;

    insert into public.conference_tracking (conference_id, stage, added_by)
    values (v_conf_id, case when rec.any_registered then 'registered' else 'intended' end, rec.created_by)
    on conflict (conference_id) do update
      set stage = case
        when conference_tracking.stage in ('ongoing', 'follow_up', 'archived') then conference_tracking.stage
        when conference_tracking.stage = 'registered' then conference_tracking.stage
        when rec.any_registered then 'registered'
        else conference_tracking.stage
      end,
      updated_at = now();
  end loop;
end;
$$;

notify pgrst, 'reload schema';
