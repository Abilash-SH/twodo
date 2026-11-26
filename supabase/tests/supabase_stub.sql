-- The few pieces of Supabase the migrations rely on, for testing on plain Postgres (supabase/tests/run.sh).
-- Roles and grants are set up the way a Supabase project has them, including its generous defaults on `public`
-- (the migrations must take those back).
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key, email text);
-- Supabase's auth.uid(): the signed-in person from the request's JWT (here: a setting the tests change)
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated, service_role;
