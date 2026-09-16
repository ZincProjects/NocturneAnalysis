-- Hardening pass over the RLS helper functions.
--
-- Two issues the database linter is right about:
--
--   1. The helpers lived in `public`, which Supabase exposes through PostgREST.
--      That made `auth_org_id()`, `auth_role()` and `auth_is_staff()` callable
--      as RPC endpoints by anyone holding an anon key. They only ever return
--      the caller's own organization and role, so the disclosure was minor -
--      but an endpoint that exists only to serve RLS internals has no business
--      being part of the public API surface. They now live in a private `app`
--      schema that PostgREST does not expose, while remaining usable from
--      policies.
--
--   2. The trigger functions did not pin `search_path`. A SECURITY DEFINER or
--      trigger function without a fixed search_path can be steered to resolve
--      an unqualified name against an attacker-controlled schema. These are the
--      functions that enforce the append-only audit log, so they are precisely
--      the ones that must not be steerable.
--
-- A security product that ships with security advisories outstanding is a bad
-- look in front of the people this is pitched to, quite apart from being wrong.

create schema if not exists app;

revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

create or replace function app.auth_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from profiles where id = auth.uid();
$$;

create or replace function app.auth_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function app.auth_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from profiles where id = auth.uid()) in ('instructor', 'admin'),
    false
  );
$$;

revoke all on function app.auth_org_id() from public;
revoke all on function app.auth_role() from public;
revoke all on function app.auth_is_staff() from public;
grant execute on function app.auth_org_id() to authenticated, service_role;
grant execute on function app.auth_role() to authenticated, service_role;
grant execute on function app.auth_is_staff() to authenticated, service_role;

-- --------------------------------------------- repoint every policy ------

drop policy if exists "members read their own org" on organizations;
create policy "members read their own org"
  on organizations for select using (id = app.auth_org_id());

drop policy if exists "admins update their own org" on organizations;
create policy "admins update their own org"
  on organizations for update
  using (id = app.auth_org_id() and app.auth_role() = 'admin')
  with check (id = app.auth_org_id());

drop policy if exists "staff read profiles in their org" on profiles;
create policy "staff read profiles in their org"
  on profiles for select
  using (org_id = app.auth_org_id() and app.auth_is_staff());

drop policy if exists "update own profile" on profiles;
create policy "update own profile"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and org_id = app.auth_org_id());

drop policy if exists "staff manage profiles in their org" on profiles;
create policy "staff manage profiles in their org"
  on profiles for insert
  with check (org_id = app.auth_org_id() and app.auth_is_staff());

drop policy if exists "staff read sessions in their org" on sessions;
create policy "staff read sessions in their org"
  on sessions for select
  using (org_id = app.auth_org_id() and app.auth_is_staff());

drop policy if exists "students start their own sessions" on sessions;
create policy "students start their own sessions"
  on sessions for insert
  with check (user_id = auth.uid() and org_id = app.auth_org_id() and not is_sample);

drop policy if exists "students advance their own sessions" on sessions;
create policy "students advance their own sessions"
  on sessions for update
  using (user_id = auth.uid() and status <> 'graded')
  with check (user_id = auth.uid() and org_id = app.auth_org_id());

drop policy if exists "staff grade sessions in their org" on sessions;
create policy "staff grade sessions in their org"
  on sessions for update
  using (org_id = app.auth_org_id() and app.auth_is_staff())
  with check (org_id = app.auth_org_id());

drop policy if exists "staff read events in their org" on session_events;
create policy "staff read events in their org"
  on session_events for select
  using (
    exists (select 1 from sessions s where s.id = session_id and s.org_id = app.auth_org_id())
    and app.auth_is_staff()
  );

drop policy if exists "staff read findings in their org" on findings;
create policy "staff read findings in their org"
  on findings for select
  using (
    exists (select 1 from sessions s where s.id = session_id and s.org_id = app.auth_org_id())
    and app.auth_is_staff()
  );

drop policy if exists "staff read decisions in their org" on session_decisions;
create policy "staff read decisions in their org"
  on session_decisions for select
  using (
    exists (select 1 from sessions s where s.id = session_id and s.org_id = app.auth_org_id())
    and app.auth_is_staff()
  );

drop policy if exists "staff read reports in their org" on reports;
create policy "staff read reports in their org"
  on reports for select
  using (
    exists (select 1 from sessions s where s.id = session_id and s.org_id = app.auth_org_id())
    and app.auth_is_staff()
  );

drop policy if exists "staff read badges in their org" on session_badges;
create policy "staff read badges in their org"
  on session_badges for select
  using (
    exists (select 1 from sessions s where s.id = session_id and s.org_id = app.auth_org_id())
    and app.auth_is_staff()
  );

drop policy if exists "staff manage comments in their org" on instructor_comments;
create policy "staff manage comments in their org"
  on instructor_comments for all
  using (
    exists (select 1 from sessions s where s.id = session_id and s.org_id = app.auth_org_id())
    and app.auth_is_staff()
  )
  with check (
    instructor_id = auth.uid()
    and exists (select 1 from sessions s where s.id = session_id and s.org_id = app.auth_org_id())
  );

drop policy if exists "members read assignments for their org" on assignments;
create policy "members read assignments for their org"
  on assignments for select using (org_id = app.auth_org_id());

drop policy if exists "staff manage assignments for their org" on assignments;
create policy "staff manage assignments for their org"
  on assignments for all
  using (org_id = app.auth_org_id() and app.auth_is_staff())
  with check (org_id = app.auth_org_id() and app.auth_is_staff());

drop policy if exists "staff read onboarding results in their org" on onboarding_results;
create policy "staff read onboarding results in their org"
  on onboarding_results for select
  using (
    exists (select 1 from profiles p where p.id = user_id and p.org_id = app.auth_org_id())
    and app.auth_is_staff()
  );

-- The leaderboard view joins organizations, which is itself RLS-protected, so
-- it needs no helper of its own.

drop function if exists public.auth_org_id();
drop function if exists public.auth_role();
drop function if exists public.auth_is_staff();

-- ------------------------------------- pin search_path on the triggers ----

create or replace function reject_event_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception
    'session_events is append-only: % is not permitted on the incident audit log', tg_op
    using errcode = 'restrict_violation',
          hint = 'Corrections are recorded as new events (INSTRUCTOR_COMMENT), never as edits.';
end;
$$;

create or replace function reject_session_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'sessions cannot be deleted because their audit log is immutable'
    using errcode = 'restrict_violation';
end;
$$;

create or replace function enforce_event_chain()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  head_hash text;
begin
  perform 1 from sessions where id = new.session_id for update;

  select e.hash
    into head_hash
    from session_events e
   where e.session_id = new.session_id
   order by e.seq desc
   limit 1;

  head_hash := coalesce(head_hash, '');

  if new.prev_hash is distinct from head_hash then
    raise exception
      'event chain broken for session %: prev_hash % does not match the current head %',
      new.session_id, coalesce(new.prev_hash, '<null>'), head_hash
      using errcode = 'restrict_violation';
  end if;

  new.created_at := now();

  return new;
end;
$$;
