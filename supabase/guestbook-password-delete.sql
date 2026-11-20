-- Run once in Supabase SQL Editor to let each author delete their own entry
-- with a per-entry password. The original password is never stored.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

alter table public.guestbook_entries
  add column if not exists delete_password_hash text;

-- Password hashes must not be readable through the public REST API.
revoke select on table public.guestbook_entries from anon, authenticated;
grant select (id, author, message, created_at)
  on table public.guestbook_entries to anon, authenticated;

-- New entries must go through the function that hashes the password.
revoke insert on table public.guestbook_entries from anon, authenticated;

create or replace function public.create_guestbook_entry(
  p_author text,
  p_message text,
  p_password text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_password is null or octet_length(p_password) < 6 or octet_length(p_password) > 72 then
    raise exception '삭제 비밀번호는 6~72바이트로 입력해 주세요.' using errcode = '22023';
  end if;
  if p_message is null or char_length(btrim(p_message)) < 2 or char_length(btrim(p_message)) > 1500 then
    raise exception '메시지는 2~1500자로 입력해 주세요.' using errcode = '22023';
  end if;
  if char_length(coalesce(p_author, '')) > 30 then
    raise exception '닉네임은 30자 이내로 입력해 주세요.' using errcode = '22023';
  end if;

  insert into public.guestbook_entries (author, message, delete_password_hash)
  values (
    coalesce(nullif(btrim(p_author), ''), '익명'),
    btrim(p_message),
    extensions.crypt(p_password, extensions.gen_salt('bf'))
  );
end;
$$;

create or replace function public.delete_guestbook_entry(
  p_id uuid,
  p_password text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored_hash text;
begin
  if p_password is null then
    return false;
  end if;

  select delete_password_hash into stored_hash
  from public.guestbook_entries
  where id = p_id;

  if stored_hash is null or extensions.crypt(p_password, stored_hash) <> stored_hash then
    return false;
  end if;

  delete from public.guestbook_entries where id = p_id;
  return found;
end;
$$;

revoke all on function public.create_guestbook_entry(text, text, text) from public;
revoke all on function public.delete_guestbook_entry(uuid, text) from public;
grant execute on function public.create_guestbook_entry(text, text, text) to anon, authenticated;
grant execute on function public.delete_guestbook_entry(uuid, text) to anon, authenticated;
