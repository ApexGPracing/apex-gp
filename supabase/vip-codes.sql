-- Apex GP · VIP codes checked online
-- Run this ONCE in your Supabase project: Dashboard → SQL Editor → New query → paste all of this → Run.
-- It is safe to run again. The codes themselves are added by the separate private file you were given
-- (vip-codes-private.sql); keep that one out of the repository.
--
-- How it works: the table below cannot be read by the game at all (row level security with no policies).
-- The game can only call the two functions: vip_claim swaps a valid, unused code for a secret token that
-- is stored on that device, and vip_check confirms a token when the game starts. Switching a code off
-- (revoked = true) takes VIP away from the device that used it.

create extension if not exists pgcrypto with schema extensions;

create table if not exists vip_codes (
  code_hash text primary key,          -- sha256 of 'apexgp-vip:' + the code (letters and digits only, upper case)
  num int,                             -- the code's number on your list
  revoked boolean not null default false,
  token uuid,                          -- set when the code is claimed
  claimed_at timestamptz
);
alter table vip_codes enable row level security;
revoke all on vip_codes from anon, authenticated;

create or replace function vip_claim(p_hash text) returns json
language plpgsql security definer set search_path = public as $$
declare r vip_codes; t uuid;
begin
  select * into r from vip_codes where code_hash = p_hash for update;
  if not found then return json_build_object('ok', false, 'why', 'invalid'); end if;
  if r.revoked then return json_build_object('ok', false, 'why', 'revoked'); end if;
  if r.token is not null then return json_build_object('ok', false, 'why', 'used'); end if;
  t := gen_random_uuid();
  update vip_codes set token = t, claimed_at = now() where code_hash = p_hash;
  return json_build_object('ok', true, 'token', t);
end $$;

create or replace function vip_check(p_token uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from vip_codes where token = p_token and not revoked);
$$;

revoke all on function vip_claim(text) from public;
revoke all on function vip_check(uuid) from public;
grant execute on function vip_claim(text) to anon, authenticated;
grant execute on function vip_check(uuid) to anon, authenticated;

-- Handy commands (run them on their own when you need them):
--   switch a code off:            update vip_codes set revoked = true where num = 42;
--   let a code be claimed again:  update vip_codes set token = null, claimed_at = null where num = 7;
--   see which codes are used:     select num, revoked, claimed_at from vip_codes order by num;
