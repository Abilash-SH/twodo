-- Twodo native phase 1: encrypted records and membership boundary.
-- All content columns contain client-encrypted ciphertext only.
create extension if not exists pgcrypto;

create table public.spaces (
  id text primary key check (id ~ '^[0-9a-f]{40}$'),
  join_hash bytea not null check (octet_length(join_hash) = 32),
  created_at timestamptz not null default now()
);
create table public.space_members (
  space_id text not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  slot text not null check (slot in ('a','b')),
  primary key (space_id,user_id),
  unique (space_id,slot)
);
create index space_members_user_idx on public.space_members(user_id);

-- SECURITY DEFINER only for the narrow membership lookup; never exposed as an RPC.
create function public.is_space_member(p_space text) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.space_members
 where space_id = p_space and user_id = (select auth.uid())) $$;
revoke all on function public.is_space_member(text) from public, anon;
grant execute on function public.is_space_member(text) to authenticated;

create function public.create_space(p_id text, p_join_hash text, p_slot text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 if p_id !~ '^[0-9a-f]{40}$' or p_join_hash !~ '^[0-9a-f]{64}$'
    or p_slot not in ('a','b') then raise exception 'Invalid space'; end if;
 insert into public.spaces(id,join_hash) values (p_id, decode(p_join_hash,'hex'));
 insert into public.space_members(space_id,user_id,slot)
 values (p_id,(select auth.uid()),p_slot);
end $$;
create function public.join_space(p_id text, p_token text, p_slot text)
returns void language plpgsql security definer set search_path = ''
as $$
declare expected bytea;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 if p_id !~ '^[0-9a-f]{40}$' or p_token !~ '^[0-9a-f]{64}$'
    or p_slot not in ('a','b') then raise exception 'Invalid invitation'; end if;
 -- Serialize joins to prevent racing into the same slot.
 select join_hash into expected from public.spaces where id=p_id for update;
 if expected is null or expected <> extensions.digest(decode(p_token,'hex'),'sha256')
 then raise exception 'Invalid invitation'; end if;
 if (select count(*) from public.space_members where space_id=p_id) >= 2
 then raise exception 'Space full'; end if;
 insert into public.space_members(space_id,user_id,slot)
 values(p_id,(select auth.uid()),p_slot);
end $$;
revoke all on function public.create_space(text,text,text) from public,anon;
revoke all on function public.join_space(text,text,text) from public,anon;
grant execute on function public.create_space(text,text,text) to authenticated;
grant execute on function public.join_space(text,text,text) to authenticated;

create table public.records (
 space_id text not null references public.spaces(id) on delete cascade,
 key text not null check (length(key) between 1 and 160),
 u bigint not null check (u >= 0),
 d text not null check (length(d) <= 200000),
 writer uuid not null default auth.uid() references auth.users(id),
 server_time timestamptz not null default now(),
 primary key(space_id,key)
);
create table public.messages (
 space_id text not null references public.spaces(id) on delete cascade,
 id text not null check (length(id) between 1 and 160),
 author text not null check (author in ('a','b')),
 u bigint not null check (u >= 0),
 d text not null check (length(d) <= 30000),
 server_time timestamptz not null default now(),
 primary key(space_id,id)
);
create table public.chat_reads (
 space_id text not null references public.spaces(id) on delete cascade,
 user_id uuid not null references auth.users(id),
 d text not null check (length(d) <= 30000),
 primary key(space_id,user_id)
);
create table public.reactions (
 space_id text not null references public.spaces(id) on delete cascade,
 message_id text not null,
 user_id uuid not null references auth.users(id),
 d text not null check (length(d) <= 30000),
 primary key(space_id,message_id,user_id),
 foreign key(space_id,message_id) references public.messages(space_id,id) on delete cascade
);

alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.records enable row level security;
alter table public.messages enable row level security;
alter table public.chat_reads enable row level security;
alter table public.reactions enable row level security;

create policy spaces_read on public.spaces for select to authenticated
 using (public.is_space_member(id));
create policy members_read on public.space_members for select to authenticated
 using (public.is_space_member(space_id));
create policy records_read on public.records for select to authenticated
 using (public.is_space_member(space_id));
create policy records_add on public.records for insert to authenticated
 with check (public.is_space_member(space_id) and writer = (select auth.uid()));
create policy records_edit on public.records for update to authenticated
 using (public.is_space_member(space_id))
 with check (public.is_space_member(space_id) and writer = (select auth.uid()));
create policy messages_read on public.messages for select to authenticated
 using (public.is_space_member(space_id));
create policy messages_add on public.messages for insert to authenticated
 with check (public.is_space_member(space_id) and author =
  (select slot from public.space_members where space_id=messages.space_id and user_id=(select auth.uid())));
create policy messages_edit on public.messages for update to authenticated
 using (public.is_space_member(space_id) and author =
  (select slot from public.space_members where space_id=messages.space_id and user_id=(select auth.uid())))
 with check (public.is_space_member(space_id) and author =
  (select slot from public.space_members where space_id=messages.space_id and user_id=(select auth.uid())));
create policy reads_select on public.chat_reads for select to authenticated using (public.is_space_member(space_id));
create policy reads_insert on public.chat_reads for insert to authenticated
 with check (public.is_space_member(space_id) and user_id=(select auth.uid()));
create policy reads_update on public.chat_reads for update to authenticated
 using (public.is_space_member(space_id) and user_id=(select auth.uid()))
 with check (public.is_space_member(space_id) and user_id=(select auth.uid()));
create policy reactions_select on public.reactions for select to authenticated using (public.is_space_member(space_id));
create policy reactions_insert on public.reactions for insert to authenticated
 with check (public.is_space_member(space_id) and user_id=(select auth.uid()));
create policy reactions_update on public.reactions for update to authenticated
 using (public.is_space_member(space_id) and user_id=(select auth.uid()))
 with check (public.is_space_member(space_id) and user_id=(select auth.uid()));
create policy reactions_delete on public.reactions for delete to authenticated
 using (public.is_space_member(space_id) and user_id=(select auth.uid()));

-- Never allow older ciphertext to overwrite a newer local edit.
create function public.prevent_stale_record() returns trigger language plpgsql
set search_path = '' as $$
begin
 if new.u <= old.u then return null; end if;
 new.server_time = now();
 return new;
end $$;
create trigger record_newer before update on public.records
for each row execute function public.prevent_stale_record();
create trigger message_newer before update on public.messages
for each row execute function public.prevent_stale_record();

-- Harden grants: no direct mutation of space membership or join hashes.
revoke all on public.spaces,public.space_members,public.records,public.messages,public.chat_reads,public.reactions from anon;
grant select on public.spaces,public.space_members to authenticated;
grant select,insert,update on public.records,public.messages,public.chat_reads,public.reactions to authenticated;
grant delete on public.reactions to authenticated;
