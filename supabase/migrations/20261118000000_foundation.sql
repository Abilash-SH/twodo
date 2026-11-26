-- Twodo · the iPhone app's database (Supabase), phase 1 (docs/architecture.md, section 2).
-- Public profiles, encrypted key backups, spaces of two, encrypted records and messages, chat reads, reactions,
-- partner requests and push tokens. Everything a person writes is ciphertext made on the phone: the server only
-- decides who may touch which row.
-- Rules that hold everywhere:
--   * Row Level Security on every table, starting from no access; each policy opens one thing.
--   * Grants are column by column: nobody can move a row to another space or key, or set who wrote it.
--   * Who wrote a row, which slot sent a message and the server's time are set here, never taken from the phone.
--   * Joining, leaving and inviting happen only through the functions below.
--   * Helpers live in `private`, which the API doesn't offer.
-- Tested as an attacker with a normal account: supabase/tests/run.sh.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

/* ---------- profiles: how you find each other by @username ---------- */
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_.]{3,20}$'),
  name text not null check (length(name) between 1 and 40),
  color text not null check (color ~ '^[a-z]{3,10}$'),
  pub jsonb not null check (jsonb_typeof(pub) = 'object' and length(pub::text) < 1000),
  updated_at timestamptz not null default now()
);
/* ---------- your private key and the space key, encrypted with your password's wrap key ---------- */
create table public.key_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  d text not null check (length(d) <= 20000),
  updated_at timestamptz not null default now()
);

/* ---------- spaces of two ---------- */
create table public.spaces (
  id text primary key check (id ~ '^[0-9a-f]{40}$'),
  join_hash bytea not null check (octet_length(join_hash) = 32),   -- SHA-256 of the join token; never readable
  join_until timestamptz not null,                                  -- an invitation lasts 24 hours
  created_at timestamptz not null default now()
);
create table public.space_members (
  space_id text not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  slot text not null check (slot in ('a', 'b')),
  primary key (space_id, user_id),
  unique (space_id, slot)
);
create index space_members_user_idx on public.space_members(user_id);

/* ---------- who is in a space (for policies; not callable through the API) ---------- */
create function private.is_member(p_space text) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.space_members where space_id = p_space and user_id = (select auth.uid())) $$;
create function private.my_slot(p_space text) returns text
language sql stable security definer set search_path = ''
as $$ select slot from public.space_members where space_id = p_space and user_id = (select auth.uid()) $$;
-- now, in the phones' clock unit (ms); an update time more than 5 minutes ahead is refused
create function private.now_ms() returns bigint language sql stable set search_path = ''
as $$ select (extract(epoch from now()) * 1000)::bigint $$;
revoke all on function private.is_member(text), private.my_slot(text), private.now_ms() from public, anon;
grant execute on function private.is_member(text), private.my_slot(text), private.now_ms() to authenticated;

/* ---------- encrypted content ---------- */
create table public.records (
  space_id text not null references public.spaces(id) on delete cascade,
  key text not null check (key ~ '^[A-Za-z0-9:_.-]{1,160}$'),
  u bigint not null check (u >= 0),
  d text not null check (length(d) <= 200000),
  writer uuid references auth.users(id) on delete set null,
  server_time timestamptz not null default now(),
  primary key (space_id, key)
);
create index records_changes_idx on public.records(space_id, server_time);
create table public.messages (
  space_id text not null references public.spaces(id) on delete cascade,
  id text not null check (id ~ '^[A-Za-z0-9_-]{1,160}$'),
  author text not null check (author in ('a', 'b')),
  u bigint not null check (u >= 0),
  d text not null check (length(d) <= 30000),
  server_time timestamptz not null default now(),
  primary key (space_id, id)
);
create index messages_changes_idx on public.messages(space_id, server_time);
create table public.chat_reads (
  space_id text not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  d text not null check (length(d) <= 2000),
  primary key (space_id, user_id)
);
create table public.reactions (
  space_id text not null references public.spaces(id) on delete cascade,
  message_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  d text not null check (length(d) <= 2000),
  primary key (space_id, message_id, user_id),
  foreign key (space_id, message_id) references public.messages(space_id, id) on delete cascade
);

/* ---------- partner requests and push tokens ---------- */
create table public.requests (
  to_user uuid not null references auth.users(id) on delete cascade,
  from_user uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('request', 'accepted')),
  d text not null check (length(d) <= 20000),   -- name, colour, public key, the wrapped space key (encrypted)
  created_at timestamptz not null default now(),
  primary key (to_user, from_user),
  check (to_user <> from_user)
);
create table public.push_tokens (
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null check (length(token) between 1 and 1000),
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  primary key (user_id, token)
);

/* ---------- set by the server, never by the phone ---------- */
create function private.own_row() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- the signed-in person, whatever the phone sent (inserts only: grants stop these columns changing later)
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  case tg_table_name
    when 'profiles' then new.id := (select auth.uid()); new.updated_at := now();
    when 'key_backups' then new.user_id := (select auth.uid()); new.updated_at := now();
    when 'chat_reads', 'reactions', 'push_tokens' then new.user_id := (select auth.uid());
    when 'requests' then new.from_user := (select auth.uid()); new.created_at := now();
  end case;
  return new;
end $$;
create trigger profiles_own before insert on public.profiles for each row execute function private.own_row();
create trigger key_backups_own before insert on public.key_backups for each row execute function private.own_row();
create trigger chat_reads_own before insert on public.chat_reads for each row execute function private.own_row();
create trigger reactions_own before insert on public.reactions for each row execute function private.own_row();
create trigger push_tokens_own before insert on public.push_tokens for each row execute function private.own_row();
create trigger requests_own before insert on public.requests for each row execute function private.own_row();
create function private.touched() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger profiles_touched before update on public.profiles for each row execute function private.touched();
create trigger key_backups_touched before update on public.key_backups for each row execute function private.touched();

-- Records and messages: an older write never replaces a newer one (it is skipped); an update time far in the
-- future is refused (it would freeze the row for both of you); who wrote it and when come from the server.
create function private.guard_content() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.u > private.now_ms() + 300000 then raise exception 'Update time is in the future'; end if;
  if tg_op = 'UPDATE' then
    if new.u <= old.u then return null; end if;
  elsif tg_table_name = 'messages' then
    new.author := private.my_slot(new.space_id);
    if new.author is null then raise exception 'Not a member'; end if;
  end if;
  if tg_table_name = 'records' then new.writer := (select auth.uid()); end if;
  new.server_time := now();
  return new;
end $$;
create trigger records_guard before insert or update on public.records for each row execute function private.guard_content();
create trigger messages_guard before insert or update on public.messages for each row execute function private.guard_content();
revoke all on function private.own_row(), private.touched(), private.guard_content() from public, anon, authenticated;

/* ---------- creating, joining, inviting again and leaving: only through these ---------- */
create function public.create_space(p_id text, p_join_hash text, p_slot text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_id !~ '^[0-9a-f]{40}$' or p_join_hash !~ '^[0-9a-f]{64}$' or p_slot not in ('a', 'b') then raise exception 'Invalid space'; end if;
  insert into public.spaces(id, join_hash, join_until) values (p_id, decode(p_join_hash, 'hex'), now() + interval '24 hours');
  insert into public.space_members(space_id, user_id, slot) values (p_id, (select auth.uid()), p_slot);
end $$;

-- The token is HKDF(space key, …) made on a phone that holds the key; the server keeps only its SHA-256.
-- Once the second person is in, the hash is replaced by a random one: the token never works again.
create function public.join_space(p_id text, p_token text, p_slot text)
returns void language plpgsql security definer set search_path = '' as $$
declare s record; n int;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_id !~ '^[0-9a-f]{40}$' or p_token !~ '^[0-9a-f]{64}$' or p_slot not in ('a', 'b') then raise exception 'Invalid invitation'; end if;
  select join_hash, join_until into s from public.spaces where id = p_id for update;   -- one join at a time
  if not found or s.join_until < now() or s.join_hash <> sha256(decode(p_token, 'hex')) then raise exception 'Invalid invitation'; end if;
  if exists (select 1 from public.space_members where space_id = p_id and user_id = (select auth.uid())) then raise exception 'Already a member'; end if;
  select count(*) into n from public.space_members where space_id = p_id;
  if n >= 2 then raise exception 'Space full'; end if;
  if exists (select 1 from public.space_members where space_id = p_id and slot = p_slot) then raise exception 'Slot taken'; end if;
  insert into public.space_members(space_id, user_id, slot) values (p_id, (select auth.uid()), p_slot);
  if n + 1 >= 2 then
    update public.spaces set join_hash = sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'UTF8')), join_until = now() where id = p_id;
  end if;
end $$;

-- After your partner left: a member sets a new invitation (a new token's hash), again for 24 hours.
create function public.renew_invite(p_id text, p_join_hash text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_join_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid invitation'; end if;
  perform 1 from public.spaces where id = p_id for update;
  if not private.is_member(p_id) then raise exception 'Not a member'; end if;
  if (select count(*) from public.space_members where space_id = p_id) >= 2 then raise exception 'Space full'; end if;
  update public.spaces set join_hash = decode(p_join_hash, 'hex'), join_until = now() + interval '24 hours' where id = p_id;
end $$;

-- Unpairing: you leave; the last one to leave takes the whole space (and everything in it) away.
create function public.leave_space(p_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  perform 1 from public.spaces where id = p_id for update;
  delete from public.space_members where space_id = p_id and user_id = (select auth.uid());
  if not found then raise exception 'Not a member'; end if;
  if not exists (select 1 from public.space_members where space_id = p_id) then delete from public.spaces where id = p_id; end if;
end $$;
revoke all on function public.create_space(text, text, text), public.join_space(text, text, text), public.renew_invite(text, text), public.leave_space(text) from public, anon;
grant execute on function public.create_space(text, text, text), public.join_space(text, text, text), public.renew_invite(text, text), public.leave_space(text) to authenticated;

/* ---------- Row Level Security: each policy opens exactly one thing ---------- */
alter table public.profiles enable row level security;
alter table public.key_backups enable row level security;
alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.records enable row level security;
alter table public.messages enable row level security;
alter table public.chat_reads enable row level security;
alter table public.reactions enable row level security;
alter table public.requests enable row level security;
alter table public.push_tokens enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_add on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_edit on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_remove on public.profiles for delete to authenticated using (id = (select auth.uid()));

create policy key_backups_own on public.key_backups for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy spaces_read on public.spaces for select to authenticated using (private.is_member(id));
create policy members_read on public.space_members for select to authenticated using (private.is_member(space_id));

create policy records_read on public.records for select to authenticated using (private.is_member(space_id));
create policy records_add on public.records for insert to authenticated with check (private.is_member(space_id));
create policy records_edit on public.records for update to authenticated using (private.is_member(space_id)) with check (private.is_member(space_id));

create policy messages_read on public.messages for select to authenticated using (private.is_member(space_id));
create policy messages_add on public.messages for insert to authenticated
  with check (private.is_member(space_id) and author = private.my_slot(space_id));
create policy messages_edit on public.messages for update to authenticated
  using (author = private.my_slot(space_id)) with check (author = private.my_slot(space_id));
create policy messages_unsend on public.messages for delete to authenticated using (author = private.my_slot(space_id));

create policy reads_read on public.chat_reads for select to authenticated using (private.is_member(space_id));
create policy reads_add on public.chat_reads for insert to authenticated with check (private.is_member(space_id) and user_id = (select auth.uid()));
create policy reads_edit on public.chat_reads for update to authenticated using (user_id = (select auth.uid()) and private.is_member(space_id)) with check (user_id = (select auth.uid()));

create policy reactions_read on public.reactions for select to authenticated using (private.is_member(space_id));
create policy reactions_add on public.reactions for insert to authenticated with check (private.is_member(space_id) and user_id = (select auth.uid()));
create policy reactions_edit on public.reactions for update to authenticated using (user_id = (select auth.uid()) and private.is_member(space_id)) with check (user_id = (select auth.uid()));
create policy reactions_remove on public.reactions for delete to authenticated using (user_id = (select auth.uid()));

create policy requests_read on public.requests for select to authenticated using (to_user = (select auth.uid()) or from_user = (select auth.uid()));
create policy requests_add on public.requests for insert to authenticated with check (from_user = (select auth.uid()));
create policy requests_edit on public.requests for update to authenticated using (from_user = (select auth.uid())) with check (from_user = (select auth.uid()));
create policy requests_remove on public.requests for delete to authenticated using (to_user = (select auth.uid()) or from_user = (select auth.uid()));

create policy push_tokens_own on public.push_tokens for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

/* ---------- grants: nothing for anon; for signed-in people only these columns and commands ---------- */
-- Supabase gives anon and authenticated everything on new tables by default (TRUNCATE ignores RLS): take it all
-- back first, then grant what each table needs.
revoke all on public.profiles, public.key_backups, public.spaces, public.space_members, public.records, public.messages,
  public.chat_reads, public.reactions, public.requests, public.push_tokens from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (username, name, color, pub), update (username, name, color, pub), delete on public.profiles to authenticated;
grant select, insert (d), update (d), delete on public.key_backups to authenticated;
grant select (id, join_until, created_at) on public.spaces to authenticated;                   -- never join_hash
grant select on public.space_members to authenticated;
grant select, insert (space_id, key, u, d), update (u, d) on public.records to authenticated;
grant select, insert (space_id, id, u, d), update (u, d), delete on public.messages to authenticated;
grant select, insert (space_id, d), update (d) on public.chat_reads to authenticated;
grant select, insert (space_id, message_id, d), update (d), delete on public.reactions to authenticated;
grant select, insert (to_user, kind, d), update (kind, d), delete on public.requests to authenticated;
grant select, insert (token, platform), delete on public.push_tokens to authenticated;
