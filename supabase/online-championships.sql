-- Apex GP · Online championships
-- Run this ONCE in your Supabase project: Dashboard → SQL Editor → New query → paste all of this → Run.
-- It is safe to run again (it only creates what is missing and replaces the functions).
--
-- Everything is readable by the game, but every change goes through the functions at the bottom,
-- which check the player's secret key (kept only in their browser), so nobody can edit other people's
-- sign-ups, votes or results.

create extension if not exists pgcrypto with schema extensions;

-- players: a random id + a hashed secret per browser (never readable from the game)
create table if not exists oc_players (
  id text primary key,
  secret_hash text not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists oc_champs (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                 -- 6-letter code people use to sign up
  name text not null,
  series text not null,                      -- f1 / f2 / indy / gt3 / lemans
  laps int not null,
  quali boolean not null default false,
  rounds jsonb not null,                     -- ["monza","spa",...] track ids, in order
  owner text not null references oc_players(id),
  created_at timestamptz not null default now()
);

create table if not exists oc_members (
  champ_id uuid not null references oc_champs(id) on delete cascade,
  player_id text not null references oc_players(id),
  name text not null,
  livery int not null default 0,
  joined_at timestamptz not null default now(),
  primary key (champ_id, player_id)
);

-- the start time the organiser has set for each round
create table if not exists oc_slots (
  id bigserial primary key,
  champ_id uuid not null references oc_champs(id) on delete cascade,
  round int not null,
  at timestamptz not null,
  proposed_by text not null references oc_players(id),
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (champ_id, round, at)
);

create table if not exists oc_votes (
  slot_id bigint not null references oc_slots(id) on delete cascade,
  player_id text not null references oc_players(id),
  primary key (slot_id, player_id)
);

create table if not exists oc_results (
  champ_id uuid not null references oc_champs(id) on delete cascade,
  round int not null,
  results jsonb not null,                    -- [{pid, name, dnf}] in finishing order
  submitted_by text not null references oc_players(id),
  submitted_at timestamptz not null default now(),
  primary key (champ_id, round)
);

create index if not exists oc_members_player on oc_members(player_id);
create index if not exists oc_slots_champ on oc_slots(champ_id);

-- read access for the game; no direct writes
alter table oc_players enable row level security;
alter table oc_champs enable row level security;
alter table oc_members enable row level security;
alter table oc_slots enable row level security;
alter table oc_votes enable row level security;
alter table oc_results enable row level security;
revoke all on oc_players from anon, authenticated;
do $$ begin
  create policy "read champs" on oc_champs for select using (true);
  create policy "read members" on oc_members for select using (true);
  create policy "read slots" on oc_slots for select using (true);
  create policy "read votes" on oc_votes for select using (true);
  create policy "read results" on oc_results for select using (true);
exception when duplicate_object then null; end $$;
grant select on oc_champs, oc_members, oc_slots, oc_votes, oc_results to anon, authenticated;

-- ---------- functions ----------

-- checks (or on first use, registers) a player id + secret
create or replace function oc_auth(p_id text, p_secret text, p_name text default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare h text := encode(digest(coalesce(p_secret, ''), 'sha256'), 'hex'); cur text;
begin
  if p_id is null or length(p_id) < 8 or length(p_id) > 40 or length(coalesce(p_secret, '')) < 16 then raise exception 'bad player key'; end if;
  select secret_hash into cur from oc_players where id = p_id;
  if cur is null then
    insert into oc_players(id, secret_hash, name) values (p_id, h, left(coalesce(nullif(trim(p_name), ''), 'Driver'), 16));
  elsif cur <> h then raise exception 'bad player key';
  elsif p_name is not null then update oc_players set name = left(trim(p_name), 16) where id = p_id;
  end if;
end $$;

create or replace function oc_is_member(p_champ uuid, p_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from oc_members where champ_id = p_champ and player_id = p_id) $$;

create or replace function oc_create(p_id text, p_secret text, p_name text, p_title text, p_series text, p_laps int, p_quali boolean, p_rounds jsonb, p_livery int default 0)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare c text; new_id uuid; chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; k int;
begin
  perform oc_auth(p_id, p_secret, p_name);
  if jsonb_typeof(p_rounds) <> 'array' or jsonb_array_length(p_rounds) < 1 or jsonb_array_length(p_rounds) > 40 then raise exception 'pick 1 to 40 rounds'; end if;
  if p_laps < 1 or p_laps > 100 then raise exception 'bad lap count'; end if;
  if (select count(*) from oc_champs where owner = p_id) >= 20 then raise exception 'you already run 20 championships'; end if;
  loop
    c := ''; for k in 1..6 loop c := c || substr(chars, 1 + floor(random() * length(chars))::int, 1); end loop;
    exit when not exists(select 1 from oc_champs where code = c);
  end loop;
  insert into oc_champs(code, name, series, laps, quali, rounds, owner)
    values (c, left(coalesce(nullif(trim(p_title), ''), 'Championship'), 40), left(p_series, 12), p_laps, p_quali, p_rounds, p_id) returning id into new_id;
  insert into oc_members(champ_id, player_id, name, livery) values (new_id, p_id, left(coalesce(nullif(trim(p_name), ''), 'Driver'), 16), coalesce(p_livery, 0));
  return json_build_object('id', new_id, 'code', c);
end $$;

create or replace function oc_join(p_id text, p_secret text, p_name text, p_code text, p_livery int default 0)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  perform oc_auth(p_id, p_secret, p_name);
  select id into cid from oc_champs where code = upper(trim(p_code));
  if cid is null then raise exception 'no championship with that code'; end if;
  if (select count(*) from oc_members where champ_id = cid) >= 40 then raise exception 'that championship is full'; end if;
  insert into oc_members(champ_id, player_id, name, livery) values (cid, p_id, left(coalesce(nullif(trim(p_name), ''), 'Driver'), 16), coalesce(p_livery, 0))
    on conflict (champ_id, player_id) do update set name = excluded.name, livery = excluded.livery;
  return cid;
end $$;

create or replace function oc_leave(p_id text, p_secret text, p_champ uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform oc_auth(p_id, p_secret);
  if (select owner from oc_champs where id = p_champ) = p_id then delete from oc_champs where id = p_champ;   -- organiser leaving deletes it
  else delete from oc_members where champ_id = p_champ and player_id = p_id; end if;
end $$;

create or replace function oc_propose(p_id text, p_secret text, p_champ uuid, p_round int, p_at timestamptz) returns bigint
language plpgsql security definer set search_path = public as $$
declare sid bigint;
begin
  -- only the organiser sets a round's start time; setting it again replaces the old one
  perform oc_auth(p_id, p_secret);
  if (select owner from oc_champs where id = p_champ) is distinct from p_id then raise exception 'only the organiser can set race times'; end if;
  if p_at < now() - interval '10 minutes' or p_at > now() + interval '1 year' then raise exception 'pick a time in the future'; end if;
  delete from oc_slots where champ_id = p_champ and round = p_round;
  insert into oc_slots(champ_id, round, at, proposed_by, locked) values (p_champ, p_round, date_trunc('minute', p_at), p_id, true) returning id into sid;
  return sid;
end $$;

create or replace function oc_vote(p_id text, p_secret text, p_slot bigint, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform oc_auth(p_id, p_secret);
  if not oc_is_member((select champ_id from oc_slots where id = p_slot), p_id) then raise exception 'sign up to this championship first'; end if;
  if p_on then insert into oc_votes(slot_id, player_id) values (p_slot, p_id) on conflict do nothing;
  else delete from oc_votes where slot_id = p_slot and player_id = p_id; end if;
end $$;

-- organiser: lock in one time for a round (or unlock it)
create or replace function oc_lock(p_id text, p_secret text, p_slot bigint) returns void
language plpgsql security definer set search_path = public as $$
declare s oc_slots;
begin
  perform oc_auth(p_id, p_secret);
  select * into s from oc_slots where id = p_slot;
  if (select owner from oc_champs where id = s.champ_id) <> p_id then raise exception 'only the organiser can lock a time'; end if;
  update oc_slots set locked = false where champ_id = s.champ_id and round = s.round and id <> p_slot;
  update oc_slots set locked = not s.locked where id = p_slot;
end $$;

-- a race's finishing order; the first one sent counts (the organiser can correct it)
create or replace function oc_result(p_id text, p_secret text, p_champ uuid, p_round int, p_results jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform oc_auth(p_id, p_secret);
  if not oc_is_member(p_champ, p_id) then raise exception 'not in this championship'; end if;
  if jsonb_typeof(p_results) <> 'array' or jsonb_array_length(p_results) > 60 then raise exception 'bad results'; end if;
  if (select owner from oc_champs where id = p_champ) = p_id then
    insert into oc_results(champ_id, round, results, submitted_by) values (p_champ, p_round, p_results, p_id)
      on conflict (champ_id, round) do update set results = excluded.results, submitted_by = excluded.submitted_by, submitted_at = now();
  else
    insert into oc_results(champ_id, round, results, submitted_by) values (p_champ, p_round, p_results, p_id) on conflict do nothing;
  end if;
end $$;

grant execute on function oc_create, oc_join, oc_leave, oc_propose, oc_vote, oc_lock, oc_result to anon, authenticated;
revoke execute on function oc_auth(text, text, text), oc_is_member(uuid, text) from public, anon, authenticated;
