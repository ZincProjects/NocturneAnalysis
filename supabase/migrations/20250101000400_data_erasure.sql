-- Right-to-erasure path for an otherwise immutable audit log.
--
-- The append-only design is the right default: a student must not be able to
-- edit their own history, and neither should an instructor. But "no row can
-- ever be removed" is not actually a position an institution can hold. Under
-- Singapore's PDPA - and this platform is aimed at Singapore schools and
-- polytechnics, where a large share of users are minors - an individual can
-- withdraw consent and request deletion, and the school has to be able to
-- honour that.
--
-- So erasure exists, but it is a deliberate, narrow, logged operation rather
-- than a DELETE anybody can issue:
--
--   * Only the service role can call it. It is not reachable from the browser
--     with an anon or user key.
--   * It takes an exclusive lock, so no append can slip through while the
--     triggers are briefly disabled.
--   * Triggers are restored in an exception handler, so a failure mid-purge
--     cannot leave the audit log mutable.
--   * It records that an erasure happened - counts, pseudonymous handle,
--     requester, reason - without retaining any of the erased content. The
--     institution can prove it honoured the request without keeping the data
--     the request was about.
--
-- This is a technical control, not legal advice. Have the actual retention and
-- erasure policy reviewed before any commercial rollout. See FOR-SCHOOLS.md.

create table data_erasures (
  id uuid primary key default gen_random_uuid(),
  org_id uuid,
  -- Pseudonym only. The legal name is exactly what the request asked us to
  -- forget, so it is not copied here.
  subject_handle text not null,
  sessions_purged integer not null,
  events_purged integer not null,
  requested_by text not null,
  reason text not null,
  purged_at timestamptz not null default now()
);

alter table data_erasures enable row level security;

create policy "staff read erasures for their org"
  on data_erasures for select
  using (org_id = app.auth_org_id() and app.auth_is_staff());

create or replace function app.purge_student_data(
  p_user_id uuid,
  p_requested_by text,
  p_reason text
)
returns data_erasures
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile profiles;
  v_sessions integer := 0;
  v_events integer := 0;
  v_record data_erasures;
begin
  if p_requested_by is null or length(trim(p_requested_by)) = 0 then
    raise exception 'an erasure must record who requested it';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'an erasure must record why it was carried out';
  end if;

  select * into v_profile from profiles where id = p_user_id;
  if not found then
    raise exception 'no profile found for %', p_user_id;
  end if;

  -- Block concurrent appends for the duration. Without this, an event could
  -- be written while the chain trigger is off and land unlinked.
  lock table session_events in access exclusive mode;
  lock table sessions in access exclusive mode;

  select count(*) into v_sessions from sessions where user_id = p_user_id;
  select count(*) into v_events
    from session_events e
    join sessions s on s.id = e.session_id
   where s.user_id = p_user_id;

  begin
    alter table session_events disable trigger session_events_no_delete;
    alter table sessions disable trigger sessions_no_delete;

    delete from session_events
     where session_id in (select id from sessions where user_id = p_user_id);
    delete from sessions where user_id = p_user_id;

    alter table session_events enable trigger session_events_no_delete;
    alter table sessions enable trigger sessions_no_delete;
  exception
    when others then
      -- Never leave the audit log mutable because a purge failed halfway.
      alter table session_events enable trigger session_events_no_delete;
      alter table sessions enable trigger sessions_no_delete;
      raise;
  end;

  insert into data_erasures (org_id, subject_handle, sessions_purged, events_purged,
                             requested_by, reason)
  values (v_profile.org_id, v_profile.handle, v_sessions, v_events, p_requested_by, p_reason)
  returning * into v_record;

  delete from onboarding_results where user_id = p_user_id;
  delete from profiles where id = p_user_id;

  return v_record;
end;
$$;

revoke all on function app.purge_student_data(uuid, text, text) from public;
grant execute on function app.purge_student_data(uuid, text, text) to service_role;

comment on function app.purge_student_data(uuid, text, text) is
  'PDPA erasure path. Service role only. Removes a student''s sessions and audit '
  'log, retaining a countersigned record that the erasure occurred. Restores the '
  'append-only triggers even on failure.';

-- ------------------------------------------------------------- realtime ---
-- Tables the live class view and live alert feed subscribe to. Realtime still
-- applies Row Level Security, so a subscriber only receives rows they could
-- have selected: an instructor sees their own organisation's sessions and
-- nobody else's.
alter publication supabase_realtime add table sessions;
alter publication supabase_realtime add table session_events;
