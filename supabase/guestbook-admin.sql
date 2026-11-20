create table if not exists public.guestbook_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.guestbook_admins enable row level security;
revoke all on table public.guestbook_admins from anon, authenticated;
grant usage on schema public to authenticated;
grant select on table public.guestbook_admins to authenticated;

drop policy if exists "Admins can read own membership" on public.guestbook_admins;
create policy "Admins can read own membership"
  on public.guestbook_admins for select to authenticated
  using (user_id = auth.uid());

grant delete on table public.guestbook_entries to authenticated;
drop policy if exists "Registered admins can delete guestbook entries" on public.guestbook_entries;
create policy "Registered admins can delete guestbook entries"
  on public.guestbook_entries for delete to authenticated
  using (
    exists (
      select 1 from public.guestbook_admins
      where user_id = auth.uid()
    )
  );
