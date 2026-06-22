-- Allow authenticated users to insert notifications for any recipient.
-- All notification inserts originate from auth-gated server actions;
-- the application layer enforces who may trigger a notification.
create policy "notifications_insert" on public.notifications
  for insert
  with check (auth.uid() is not null);
