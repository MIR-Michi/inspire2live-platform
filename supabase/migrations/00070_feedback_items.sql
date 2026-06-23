-- Feedback items captured via the contextual test mode.
-- Each row represents one piece of feedback from a tester.

create table public.feedback_items (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        references auth.users(id) on delete set null,
  user_name   text,
  user_role   text,
  page_url    text        not null,
  page_title  text,
  element_path text,
  element_text text,
  feedback_type text not null default 'bug'
    check (feedback_type in ('bug', 'suggestion', 'question')),
  message     text        not null,
  status      text        not null default 'open'
    check (status in ('open', 'reviewed', 'resolved')),
  admin_note  text,
  created_at  timestamptz not null default now()
);

alter table public.feedback_items enable row level security;

-- Authenticated users can submit their own feedback
create policy "feedback_insert" on public.feedback_items
  for insert to authenticated
  with check (auth.uid() = user_id);

-- Users can read their own feedback
create policy "feedback_select_own" on public.feedback_items
  for select to authenticated
  using (auth.uid() = user_id);

-- Admins manage all feedback via admin client (bypasses RLS) –
-- explicit policy for completeness
create policy "feedback_admin_all" on public.feedback_items
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'PlatformAdmin'
    )
  );
