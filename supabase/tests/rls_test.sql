-- Twodo · the database's rules, tried by an attacker with a normal account (supabase/tests/run.sh).
-- People: A and B share space S1; C is signed in but in no space; D and E share space S2; F joins later.
-- Every check prints "ok - …"; the first one that doesn't hold stops the run with "not ok - …".
\set ON_ERROR_STOP 1
\set QUIET 1
set client_min_messages = notice;

create schema t;
create function t.ok(c boolean, what text) returns void language plpgsql as $$
begin if c is not true then raise exception 'not ok - %', what; end if; raise notice 'ok - %', what; end $$;
create function t.fails(q text, what text, expect text default null) returns void language plpgsql as $$
begin
  begin execute q; exception when others then
    if expect is not null and position(lower(expect) in lower(sqlerrm)) = 0 then raise exception 'not ok - % (failed, but with: %)', what, sqlerrm; end if;
    raise notice 'ok - %', what; return;
  end;
  raise exception 'not ok - % (it worked)', what;
end $$;
create function t.n(q text) returns bigint language plpgsql as $$ declare r bigint; begin execute 'select count(*) from (' || q || ') q' into r; return r; end $$;
create function t.v(q text) returns text language plpgsql as $$ declare r text; begin execute q into r; return r; end $$;
grant usage on schema t to anon, authenticated;
grant execute on all functions in schema t to anon, authenticated;

insert into auth.users(id) select ('00000000-0000-0000-0000-00000000000' || x)::uuid from unnest(array['a','b','c','d','e','f']) x;
create function t.as_(who text) returns void language sql as $$ select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000' || who, false) $$;
grant execute on function t.as_(text) to anon, authenticated;
\set S1 '''1111111111111111111111111111111111111111'''
\set S2 '''2222222222222222222222222222222222222222'''
\set T1 '''abababababababababababababababababababababababababababababababab'''
\set T2 '''cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd'''
\set T3 '''efefefefefefefefefefefefefefefefefefefefefefefefefefefefefefefef'''
create function t.h(tok text) returns text language sql as $$ select encode(sha256(decode(tok, 'hex')), 'hex') $$;
grant execute on function t.h(text) to anon, authenticated;

-- ===== not signed in: nothing at all =====
set role anon; select set_config('request.jwt.claim.sub', '', false);
select t.fails('select * from public.profiles', 'anon can''t read profiles', 'permission denied');
select t.fails('select * from public.records', 'anon can''t read records', 'permission denied');
select t.fails($q$select public.create_space('3333333333333333333333333333333333333333', repeat('0', 64), 'a')$q$, 'anon can''t create a space', 'permission denied');
reset role;

-- ===== spaces: creating, joining, the invitation =====
set role authenticated;
select t.as_('a');
select t.fails($q$select public.create_space('xyz', repeat('0', 64), 'a')$q$, 'a malformed space id is refused', 'Invalid space');
select public.create_space(:S1, t.h(:T1), 'a');
select t.ok(t.n('select * from public.space_members where space_id = ' || quote_literal(:S1)) = 1, 'A created S1 and is in slot a');
select t.fails('select * from public.spaces', 'nobody can read a space''s join hash', 'permission denied');
select t.ok(t.n('select id, created_at from public.spaces') = 1, 'A reads S1''s id');
select t.fails($q$select public.create_space('1111111111111111111111111111111111111111', repeat('0', 64), 'b')$q$, 'nobody can take over an existing space id');
select t.fails($q$insert into public.space_members values ('1111111111111111111111111111111111111111', '00000000-0000-0000-0000-00000000000c', 'b')$q$, 'members can''t be added by hand', 'permission denied');

select t.as_('c');
select t.ok(t.n('select id from public.spaces') = 0 and t.n('select * from public.space_members') = 0, 'C sees no space and no members');
select t.fails(format('select public.join_space(%s, %s, %s)', quote_literal(:S1), quote_literal(:T2), quote_literal('b')), 'a wrong token doesn''t join', 'Invalid invitation');
select t.fails(format('select public.join_space(%s, %s, %s)', quote_literal(:S1), quote_literal(:T1), quote_literal('a')), 'the right token can''t take a taken slot', 'Slot taken');

select t.as_('b');
select public.join_space(:S1, :T1, 'b');
select t.ok(t.n('select * from public.space_members') = 2, 'B joined S1 with the token, in slot b');
select t.as_('c');
select t.fails(format('select public.join_space(%s, %s, %s)', quote_literal(:S1), quote_literal(:T1), quote_literal('b')), 'once the space is full, the token never works again', 'Invalid invitation');
select t.fails(format('select public.renew_invite(%s, %s)', quote_literal(:S1), quote_literal(t.h(:T3))), 'an outsider can''t set a new invitation', 'Not a member');

-- an invitation older than 24 hours doesn't work
select t.as_('d');
select public.create_space(:S2, t.h(:T2), 'a');
reset role; update public.spaces set join_until = now() - interval '1 minute' where id = :S2; set role authenticated;
select t.as_('e');
select t.fails(format('select public.join_space(%s, %s, %s)', quote_literal(:S2), quote_literal(:T2), quote_literal('b')), 'an expired invitation doesn''t work', 'Invalid invitation');
select t.as_('d'); select public.renew_invite(:S2, t.h(:T2));
select t.as_('e'); select public.join_space(:S2, :T2, 'b');
select t.ok(t.n('select * from public.space_members') = 2, 'after D renewed it, E joined S2');

-- ===== records =====
select t.as_('a');
insert into public.records(space_id, key, u, d) values (:S1, 't:shared', 1000, 'cipher-A');
select t.ok(t.v($q$select writer::text from public.records where key = 't:shared'$q$) = '00000000-0000-0000-0000-00000000000a', 'the server records who wrote it');
select t.fails($q$insert into public.records(space_id, key, u, d, writer) values ('1111111111111111111111111111111111111111', 't:x', 1, 'x', '00000000-0000-0000-0000-00000000000b')$q$, 'the phone can''t say who wrote it', 'permission denied');
select t.fails($q$insert into public.records(space_id, key, u, d, server_time) values ('1111111111111111111111111111111111111111', 't:x', 1, 'x', now() - interval '1 year')$q$, 'the phone can''t set the server''s time', 'permission denied');
select t.as_('b');
select t.ok(t.v($q$select d from public.records where key = 't:shared'$q$) = 'cipher-A', 'B reads it');
update public.records set u = 2000, d = 'cipher-B' where space_id = :S1 and key = 't:shared';
select t.ok(t.v($q$select d || '/' || writer::text from public.records where key = 't:shared'$q$) = 'cipher-B/00000000-0000-0000-0000-00000000000b', 'B edits a shared to-do without sending who wrote it');
update public.records set u = 1500, d = 'older' where space_id = :S1 and key = 't:shared';
select t.ok(t.v($q$select d from public.records where key = 't:shared'$q$) = 'cipher-B', 'an older write is skipped');
insert into public.records(space_id, key, u, d) values (:S1, 't:shared', 1800, 'older again') on conflict (space_id, key) do update set u = excluded.u, d = excluded.d;
select t.ok(t.v($q$select d from public.records where key = 't:shared'$q$) = 'cipher-B', 'an older upsert is skipped too');
select t.fails($q$update public.records set u = (extract(epoch from now()) * 1000)::bigint + 86400000, d = 'frozen' where key = 't:shared'$q$, 'an update time a day ahead is refused (it would freeze the row)', 'future');
select t.fails($q$update public.records set key = 't:moved' where key = 't:shared'$q$, 'a record can''t change its key', 'permission denied');
select t.fails($q$delete from public.records where key = 't:shared'$q$, 'records aren''t deleted (deleted is a flag inside)', 'permission denied');
select t.fails('truncate public.records', 'TRUNCATE is refused (it would ignore the rules)', 'permission denied');

select t.as_('c');
select t.ok(t.n('select * from public.records') = 0, 'C reads no records');
select t.fails($q$insert into public.records(space_id, key, u, d) values ('1111111111111111111111111111111111111111', 't:evil', 1, 'x')$q$, 'C can''t add to S1', 'row-level security');
update public.records set u = 9999, d = 'evil' where space_id = :S1;
select t.as_('a');
select t.ok(t.v($q$select d from public.records where key = 't:shared'$q$) = 'cipher-B', 'C''s update changed nothing');

select t.as_('d');
select t.ok(t.n('select * from public.records') = 0, 'D (another space) reads none of S1');
select t.fails($q$update public.records set space_id = '2222222222222222222222222222222222222222' where key = 't:shared'$q$, 'D can''t move S1''s rows into S2', 'permission denied');
select t.fails($q$insert into public.records(space_id, key, u, d) values ('1111111111111111111111111111111111111111', 't:evil', 1, 'x')$q$, 'D can''t write into S1', 'row-level security');

-- ===== messages =====
select t.as_('b');
insert into public.messages(space_id, id, u, d) values (:S1, 'm1', 10, 'hello');
select t.ok(t.v($q$select author from public.messages where id = 'm1'$q$) = 'b', 'B''s message is B''s, set by the server');
select t.fails($q$insert into public.messages(space_id, id, author, u, d) values ('1111111111111111111111111111111111111111', 'm2', 'a', 10, 'as A')$q$, 'B can''t send as A', 'permission denied');
select t.as_('a');
update public.messages set u = 20, d = 'edited by A' where id = 'm1';
select t.ok(t.v($q$select d from public.messages where id = 'm1'$q$) = 'hello', 'A can''t edit B''s message');
delete from public.messages where id = 'm1';
select t.ok(t.n($q$select * from public.messages where id = 'm1'$q$) = 1, 'A can''t unsend B''s message');
insert into public.reactions(space_id, message_id, d) values (:S1, 'm1', 'heart');
select t.ok(t.v($q$select user_id::text from public.reactions$q$) = '00000000-0000-0000-0000-00000000000a', 'A''s reaction is A''s');
select t.as_('b');
update public.reactions set d = 'changed' where message_id = 'm1';
delete from public.reactions where message_id = 'm1';
select t.ok(t.v('select d from public.reactions') = 'heart', 'B can''t change or remove A''s reaction');
update public.messages set u = 30, d = 'edited' where id = 'm1';
select t.ok(t.v($q$select d from public.messages where id = 'm1'$q$) = 'edited', 'B edits B''s message');
delete from public.messages where id = 'm1';
select t.ok(t.n('select * from public.messages') = 0 and t.n('select * from public.reactions') = 0, 'B unsends it (its reactions go too)');

-- ===== chat reads =====
insert into public.chat_reads(space_id, d) values (:S1, 'read-B');
select t.as_('a');
update public.chat_reads set d = 'forged' where space_id = :S1;
select t.ok(t.v('select d from public.chat_reads') = 'read-B', 'A reads B''s position but can''t change it');
select t.as_('c');
select t.fails($q$insert into public.chat_reads(space_id, d) values ('1111111111111111111111111111111111111111', 'x')$q$, 'C can''t write a read position in S1', 'row-level security');

-- ===== profiles, key backups, requests, push tokens =====
select t.as_('a');
insert into public.profiles(username, name, color, pub) values ('abilash', 'Abilash', 'blue', '{"kty":"EC"}');
select t.as_('c');
insert into public.profiles(username, name, color, pub) values ('cee', 'C', 'pink', '{"kty":"EC"}');
select t.ok(t.n('select * from public.profiles') = 2, 'anyone signed in can find profiles by username');
update public.profiles set name = 'Hacked' where username = 'abilash';
select t.ok(t.v($q$select name from public.profiles where username = 'abilash'$q$) = 'Abilash', 'C can''t change A''s profile');
select t.fails($q$insert into public.profiles(username, name, color, pub) values ('abilash', 'X', 'red', '{}')$q$, 'a username is unique');
select t.fails($q$update public.profiles set id = '00000000-0000-0000-0000-00000000000a' where username = 'cee'$q$, 'a profile can''t take another account''s id', 'permission denied');
select t.as_('a');
insert into public.key_backups(d) values ('wrapped-keys-A');
select t.as_('c');
select t.ok(t.n('select * from public.key_backups') = 0, 'C can''t read A''s key backup');
insert into public.requests(to_user, kind, d) values ('00000000-0000-0000-0000-00000000000a', 'request', 'req');
select t.ok(t.v('select from_user::text from public.requests') = '00000000-0000-0000-0000-00000000000c', 'a request is from whoever sends it');
select t.as_('b');
select t.ok(t.n('select * from public.requests') = 0, 'B can''t see a request to A');
select t.as_('a');
update public.requests set d = 'tampered';
select t.ok(t.v('select d from public.requests') = 'req', 'A reads it but can''t change it');
delete from public.requests;
select t.ok(t.n('select * from public.requests') = 0, 'A turns it down');
insert into public.push_tokens(token, platform) values ('apns-token-A', 'ios');
select t.as_('b');
select t.ok(t.n('select * from public.push_tokens') = 0, 'B can''t see A''s push token');

-- ===== helpers aren't part of the API =====
select t.fails($q$select public.is_space_member('1111111111111111111111111111111111111111')$q$, 'the membership helper isn''t in public', 'does not exist');

-- ===== leaving, and a new partner =====
select public.leave_space(:S1);
select t.ok(t.n('select * from public.records') = 0 and t.n('select id from public.spaces') = 0, 'B left S1 and reads nothing of it any more');
select t.as_('a');
select t.ok(t.n('select * from public.space_members') = 1, 'A is still in S1, alone');
select public.renew_invite(:S1, t.h(:T3));
select t.as_('f'); select public.join_space(:S1, :T3, 'b');
select t.ok(t.n($q$select * from public.records where key = 't:shared'$q$) = 1, 'F joined with A''s new invitation and reads S1');
select public.leave_space(:S1);
select t.as_('a'); select public.leave_space(:S1);
reset role;
select t.ok(t.n(format('select * from public.records where space_id = %s', quote_literal(:S1))) = 0 and t.n(format('select * from public.spaces where id = %s', quote_literal(:S1))) = 0, 'when the last one leaves, the space and everything in it are gone');

