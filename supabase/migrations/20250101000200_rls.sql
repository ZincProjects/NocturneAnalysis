-- Row Level Security.
--
-- Shape of the rules:
--   * Reference content (scenarios, MITRE, OWASP, badges) is readable by
--     anyone, including anonymous visitors, so /scenarios, /mitre, /owasp and
--     /samples work logged out.
--   * Student rows are readable and writable only by that student, and only
--     inside their own organization.
--   * Instructors and admins read everything in their own organization and
--     nothing outside it.
--   * Nobody gets UPDATE or DELETE on session_events. Not students, not
--     instructors, not admins. The triggers in the integrity migration back
--     this up even for service-role callers.
--   * Nobody gets INSERT on session_events either: appends go exclusively
--     through the append-event Edge Function, which uses the service role
--     after re-checking that the caller owns the session. Letting the browser
--     insert directly would let a student choose their own hashes.

-- Helper functions are SECURITY DEFINER so that reading the caller's own
-- profile inside a profiles policy does not recurse.

create or replace function auth_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from profiles where id = auth.uid();
$$;

create or replace function auth_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function auth_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from profiles where id = auth.uid()) in ('instructor', 'admin'), false);
$$;

revoke execute on function auth_org_id() from public;
revoke execute on function auth_role() from public;
revoke execute on function auth_is_staff() from public;
grant execute on function auth_org_id() to authenticated;
grant execute on function auth_role() to authenticated;
grant execute on function auth_is_staff() to authenticated;

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table scenarios enable row level security;
alter table scenario_phases enable row level security;
alter table scenario_assets enable row level security;
alter table mitre_techniques enable row level security;
alter table owasp_categories enable row level security;
alter table scenario_technique_map enable row level security;
alter table scenario_owasp_map enable row level security;
alter table sessions enable row level security;
alter table session_events enable row level security;
alter table findings enable row level security;
alter table session_decisions enable row level security;
alter table reports enable row level security;
alter table badges enable row level security;
alter table session_badges enable row level security;
alter table instructor_comments enable row level security;
alter table assignments enable row level security;
alter table onboarding_results enable row level security;

-- ------------------------------------------- public reference content -----

create policy "reference content is world readable"
  on scenarios for select using (is_published);

create policy "phases follow their scenario"
  on scenario_phases for select using (
    exists (select 1 from scenarios s where s.id = scenario_id and s.is_published)
  );

create policy "assets follow their scenario"
  on scenario_assets for select using (
    exists (select 1 from scenarios s where s.id = scenario_id and s.is_published)
  );

create policy "mitre is world readable" on mitre_techniques for select using (true);
create policy "owasp is world readable" on owasp_categories for select using (true);
create policy "technique map is world readable" on scenario_technique_map for select using (true);
create policy "owasp map is world readable" on scenario_owasp_map for select using (true);
create policy "badges are world readable" on badges for select using (true);

-- ---------------------------------------------------- organizations -------

create policy "members read their own org"
  on organizations for select
  using (id = auth_org_id());

create policy "admins update their own org"
  on organizations for update
  using (id = auth_org_id() and auth_role() = 'admin')
  with check (id = auth_org_id());

-- --------------------------------------------------------- profiles -------

create policy "read own profile"
  on profiles for select
  using (id = auth.uid());

create policy "staff read profiles in their org"
  on profiles for select
  using (org_id = auth_org_id() and auth_is_staff());

create policy "update own profile"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and org_id = auth_org_id());

create policy "staff manage profiles in their org"
  on profiles for insert
  with check (org_id = auth_org_id() and auth_is_staff());

-- --------------------------------------------------------- sessions -------

create policy "students read their own sessions"
  on sessions for select
  using (user_id = auth.uid());

create policy "staff read sessions in their org"
  on sessions for select
  using (org_id = auth_org_id() and auth_is_staff());

-- Sample sessions back the logged-out /samples gallery.
create policy "sample sessions are world readable"
  on sessions for select
  using (is_sample);

create policy "students start their own sessions"
  on sessions for insert
  with check (user_id = auth.uid() and org_id = auth_org_id() and not is_sample);

create policy "students advance their own sessions"
  on sessions for update
  using (user_id = auth.uid() and status <> 'graded')
  with check (user_id = auth.uid() and org_id = auth_org_id());

create policy "staff grade sessions in their org"
  on sessions for update
  using (org_id = auth_org_id() and auth_is_staff())
  with check (org_id = auth_org_id());

-- ---------------------------------------------------- session_events ------

-- SELECT only. There is deliberately no INSERT, UPDATE or DELETE policy on
-- this table for any role.
create policy "students read their own events"
  on session_events for select
  using (
    exists (
      select 1 from sessions s
       where s.id = session_id and s.user_id = auth.uid()
    )
  );

create policy "staff read events in their org"
  on session_events for select
  using (
    exists (
      select 1 from sessions s
       where s.id = session_id and s.org_id = auth_org_id()
    ) and auth_is_staff()
  );

create policy "sample session events are world readable"
  on session_events for select
  using (
    exists (select 1 from sessions s where s.id = session_id and s.is_sample)
  );

revoke insert, update, delete on session_events from anon, authenticated;

-- ------------------------------------------ findings / decisions ----------

create policy "students manage their own findings"
  on findings for all
  using (exists (select 1 from sessions s where s.id = session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from sessions s where s.id = session_id and s.user_id = auth.uid()));

create policy "staff read findings in their org"
  on findings for select
  using (
    exists (select 1 from sessions s where s.id = session_id and s.org_id = auth_org_id())
    and auth_is_staff()
  );

create policy "sample findings are world readable"
  on findings for select
  using (exists (select 1 from sessions s where s.id = session_id and s.is_sample));

create policy "students manage their own decisions"
  on session_decisions for all
  using (exists (select 1 from sessions s where s.id = session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from sessions s where s.id = session_id and s.user_id = auth.uid()));

create policy "staff read decisions in their org"
  on session_decisions for select
  using (
    exists (select 1 from sessions s where s.id = session_id and s.org_id = auth_org_id())
    and auth_is_staff()
  );

create policy "sample decisions are world readable"
  on session_decisions for select
  using (exists (select 1 from sessions s where s.id = session_id and s.is_sample));

-- ---------------------------------------------------------- reports -------

create policy "students read their own reports"
  on reports for select
  using (exists (select 1 from sessions s where s.id = session_id and s.user_id = auth.uid()));

create policy "staff read reports in their org"
  on reports for select
  using (
    exists (select 1 from sessions s where s.id = session_id and s.org_id = auth_org_id())
    and auth_is_staff()
  );

create policy "sample reports are world readable"
  on reports for select
  using (exists (select 1 from sessions s where s.id = session_id and s.is_sample));

-- ----------------------------------------------------- session_badges -----

create policy "students read their own badges"
  on session_badges for select
  using (exists (select 1 from sessions s where s.id = session_id and s.user_id = auth.uid()));

create policy "staff read badges in their org"
  on session_badges for select
  using (
    exists (select 1 from sessions s where s.id = session_id and s.org_id = auth_org_id())
    and auth_is_staff()
  );

-- ------------------------------------------------ instructor_comments -----

create policy "students read comments on their own sessions"
  on instructor_comments for select
  using (exists (select 1 from sessions s where s.id = session_id and s.user_id = auth.uid()));

create policy "staff manage comments in their org"
  on instructor_comments for all
  using (
    exists (select 1 from sessions s where s.id = session_id and s.org_id = auth_org_id())
    and auth_is_staff()
  )
  with check (
    instructor_id = auth.uid()
    and exists (select 1 from sessions s where s.id = session_id and s.org_id = auth_org_id())
  );

-- ------------------------------------------------------ assignments -------

create policy "members read assignments for their org"
  on assignments for select
  using (org_id = auth_org_id());

create policy "staff manage assignments for their org"
  on assignments for all
  using (org_id = auth_org_id() and auth_is_staff())
  with check (org_id = auth_org_id() and auth_is_staff());

-- ----------------------------------------------- onboarding_results -------

create policy "students manage their own onboarding result"
  on onboarding_results for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "staff read onboarding results in their org"
  on onboarding_results for select
  using (
    exists (select 1 from profiles p where p.id = user_id and p.org_id = auth_org_id())
    and auth_is_staff()
  );

-- ------------------------------------------------------- leaderboard ------

-- Exposes pseudonymous handles only, and only when the org has opted in.
-- display_name is never selected here.
create or replace view leaderboard_entries
with (security_invoker = true)
as
  select
    p.org_id,
    p.handle,
    p.cohort,
    count(distinct s.id) filter (where s.status in ('submitted', 'graded')) as completed_sessions,
    coalesce(sum(coalesce(s.adjusted_score, s.score)), 0) as total_score,
    max(s.completed_at) as last_completed_at
  from profiles p
  join organizations o on o.id = p.org_id and o.leaderboard_enabled
  left join sessions s on s.user_id = p.id
  where p.role = 'student'
  group by p.org_id, p.handle, p.cohort;

grant select on leaderboard_entries to authenticated;
