-- Self-service sign-up, and closing two privilege holes found in review.
--
-- 1. Students could forge grades. The "students advance their own sessions"
--    policy allowed UPDATE on every column of their own session row, so a
--    student could PATCH score, max_score, status or is_sample directly through
--    PostgREST. Likewise the INSERT policy let them create a session that was
--    already 'graded' with a score of their choosing. Nothing in the app needs
--    students to update sessions at all - grading writes with the service role.
--
-- 2. Students could promote themselves. "update own profile" covered every
--    column, including role, so any student could set role = 'admin'.
--
-- RLS decides which rows; column privileges decide which columns. Both are
-- needed, and this migration adds the second.

-- ------------------------------------------------------------ sessions ----

drop policy if exists "students advance their own sessions" on sessions;

revoke insert, update on sessions from anon, authenticated;
grant insert (scenario_id, user_id, org_id) on sessions to authenticated;
grant update (adjusted_score, status) on sessions to authenticated;

drop policy if exists "staff grade sessions in their org" on sessions;
create policy "staff grade sessions in their org"
  on sessions for update
  using (org_id = app.auth_org_id() and app.auth_is_staff() and status <> 'in_progress')
  with check (org_id = app.auth_org_id() and app.auth_is_staff() and status = 'graded');

-- ------------------------------------------------------------ profiles ----

revoke insert, update on profiles from anon, authenticated;
grant update (display_name, handle, onboarding_completed_at) on profiles to authenticated;

-- Accounts are provisioned by the enrol script (service role) or by the
-- sign-up trigger below. No signed-in role needs to insert profiles, and an
-- instructor able to do so could attach arbitrary accounts to their org.
drop policy if exists "staff manage profiles in their org" on profiles;

-- -------------------------------------------------- instructor comments ----

-- The previous ALL policy let any instructor in an org edit or delete another
-- instructor's comments. Comments are feedback on the record; they are added,
-- not rewritten.
drop policy if exists "staff manage comments in their org" on instructor_comments;

create policy "staff read comments in their org"
  on instructor_comments for select
  using (
    exists (select 1 from sessions s where s.id = session_id and s.org_id = app.auth_org_id())
    and app.auth_is_staff()
  );

create policy "staff add comments in their org"
  on instructor_comments for insert
  with check (
    instructor_id = auth.uid()
    and app.auth_is_staff()
    and exists (select 1 from sessions s where s.id = session_id and s.org_id = app.auth_org_id())
  );

revoke update, delete on instructor_comments from anon, authenticated;

-- ------------------------------------------------------------- sign-up ----

alter table organizations
  add column if not exists join_code text unique,
  add column if not exists self_signup boolean not null default false;

-- At most one organisation receives people who sign up without a class code.
create unique index if not exists organizations_single_self_signup
  on organizations (self_signup) where self_signup;

update organizations
   set join_code = upper(substr(md5(gen_random_uuid()::text), 1, 8))
 where join_code is null;

alter table organizations
  alter column join_code set default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  alter column join_code set not null;

insert into organizations (name, kind, leaderboard_enabled, self_signup)
select 'Independent Learners', 'school', false, true
where not exists (select 1 from organizations where self_signup);

-- Lets the sign-up form say "that class code is not recognised" before an
-- account is created, instead of a generic database error afterwards. Returns
-- the organisation name and nothing else.
create or replace function public.lookup_join_code(p_code text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select name from public.organizations where join_code = upper(trim(p_code));
$$;

revoke all on function public.lookup_join_code(text) from public;
grant execute on function public.lookup_join_code(text) to anon, authenticated;

-- Creates the profile for a self-service sign-up.
--
-- Role is always 'student' regardless of what the client sends: user metadata
-- is written by the browser and is never trusted for anything privileged.
-- Accounts created by the enrol script carry app_metadata.provisioned (which
-- only the service role can set) and get their profile from the script.
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_code text;
  v_handle text;
  v_display text;
begin
  if coalesce(new.raw_app_meta_data ->> 'provisioned', 'false') = 'true' then
    return new;
  end if;

  if exists (select 1 from public.profiles where id = new.id) then
    return new;
  end if;

  v_code := upper(nullif(trim(new.raw_user_meta_data ->> 'join_code'), ''));

  if v_code is not null then
    select id into v_org from public.organizations where join_code = v_code;
    if v_org is null then
      raise exception 'Unknown class code' using errcode = 'check_violation';
    end if;
  else
    select id into v_org from public.organizations where self_signup limit 1;
  end if;

  if v_org is null then
    return new;
  end if;

  -- Handles appear on leaderboards and reports, so never derive one from the
  -- email address.
  v_handle := regexp_replace(coalesce(new.raw_user_meta_data ->> 'handle', ''), '[^A-Za-z0-9_.-]', '', 'g');
  if length(v_handle) < 3 then
    v_handle := 'analyst-' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  v_handle := left(v_handle, 25);

  while exists (select 1 from public.profiles where org_id = v_org and handle = v_handle) loop
    v_handle := left(v_handle, 25) || '-' || substr(md5(random()::text), 1, 4);
  end loop;

  v_display := left(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 80);

  insert into public.profiles (id, org_id, role, display_name, handle)
  values (new.id, v_org, 'student', coalesce(v_display, v_handle), v_handle);

  return new;
end;
$$;

revoke all on function app.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- ------------------------------------------ repair hand-inserted users ----

-- Supabase Auth scans these token columns as strings and fails every sign-in
-- with "Database error querying schema" when they are NULL, which is what an
-- INSERT into auth.users that does not name them leaves behind.
update auth.users
   set confirmation_token = coalesce(confirmation_token, ''),
       recovery_token = coalesce(recovery_token, ''),
       email_change_token_new = coalesce(email_change_token_new, ''),
       email_change = coalesce(email_change, '')
 where confirmation_token is null
    or recovery_token is null
    or email_change_token_new is null
    or email_change is null;

-- An email user with no identity row cannot sign in with a password either.
insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text,
       u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
       'email',
       now(), now(), now()
  from auth.users u
 where u.email is not null
   and not exists (select 1 from auth.identities i where i.user_id = u.id);

-- ------------------------------------------- anonymous policy helpers ----

-- Policies on sessions and related tables call these helpers for every role.
-- Without EXECUTE, an anonymous read of a sample session failed with
-- "permission denied for function auth_org_id" instead of being filtered.
-- For anon they simply return null, which no org or staff check matches.
grant usage on schema app to anon;
grant execute on function app.auth_org_id() to anon;
grant execute on function app.auth_role() to anon;
grant execute on function app.auth_is_staff() to anon;
