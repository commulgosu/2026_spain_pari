create table if not exists public.guestbook_entries (
  id uuid primary key default gen_random_uuid(),
  author text not null default '익명'
    check (char_length(author) <= 30),
  message text not null
    check (char_length(btrim(message)) between 2 and 1500),
  created_at timestamptz not null default now()
);

alter table public.guestbook_entries enable row level security;

revoke all on table public.guestbook_entries from anon, authenticated;
grant usage on schema public to anon;
grant select, insert on table public.guestbook_entries to anon;

drop policy if exists "Visitors can read guestbook" on public.guestbook_entries;
create policy "Visitors can read guestbook"
  on public.guestbook_entries for select to anon
  using (true);

drop policy if exists "Visitors can add guestbook entries" on public.guestbook_entries;
create policy "Visitors can add guestbook entries"
  on public.guestbook_entries for insert to anon
  with check (
    char_length(author) <= 30
    and char_length(btrim(message)) between 2 and 1500
  );
