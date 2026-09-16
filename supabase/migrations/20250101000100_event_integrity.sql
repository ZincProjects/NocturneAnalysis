-- Append-only, hash-linked event log.
--
-- Three independent controls, because "the app doesn't do that" is not an
-- integrity guarantee:
--
--   1. No role - including admin, including the table owner's normal grants -
--      may UPDATE or DELETE a row. A trigger raises regardless of privilege.
--   2. Every insert must reference the current head of that session's chain,
--      so a row cannot be spliced in, removed or reordered without the break
--      showing up immediately.
--   3. created_at is stamped by the database, never by the caller.
--
-- The SHA-256 digest itself is computed by the append-event Edge Function
-- (see supabase/functions/append-event). Postgres cannot cheaply reproduce the
-- exact canonical-JSON byte sequence that the TypeScript implementation uses,
-- so digest verification lives in application code where one implementation
-- serves the Edge Function, the tests and the instructor's verify button.
-- Linkage is enforced here; content is verified there. Both are needed.

-- ------------------------------------------------- reject mutation --------

create or replace function reject_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'session_events is append-only: % is not permitted on the incident audit log', tg_op
    using errcode = 'restrict_violation',
          hint = 'Corrections are recorded as new events (INSTRUCTOR_COMMENT), never as edits.';
end;
$$;

create trigger session_events_no_update
  before update on session_events
  for each row execute function reject_event_mutation();

create trigger session_events_no_delete
  before delete on session_events
  for each row execute function reject_event_mutation();

-- Deleting a session cascades to its events, which the delete trigger would
-- block. Retaining the audit trail is the point, so sessions are not deletable
-- either: an instructor voids a session by status, not by removal.
create or replace function reject_session_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'sessions cannot be deleted because their audit log is immutable'
    using errcode = 'restrict_violation';
end;
$$;

create trigger sessions_no_delete
  before delete on sessions
  for each row execute function reject_session_delete();

-- ------------------------------------------------- enforce linkage --------

create or replace function enforce_event_chain()
returns trigger
language plpgsql
as $$
declare
  head_hash text;
begin
  -- Serialise appends for this session so two concurrent inserts cannot both
  -- claim the same predecessor.
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

  -- The server owns the clock. A client-supplied timestamp is discarded.
  new.created_at := now();

  return new;
end;
$$;

create trigger session_events_chain
  before insert on session_events
  for each row execute function enforce_event_chain();

-- ------------------------------------------------- read-side helpers ------

-- Linkage check callable from SQL, used by the instructor console and by the
-- integrity test. Returns one row describing the chain's state.
create or replace function verify_session_chain(p_session_id uuid)
returns table (
  event_count bigint,
  linkage_valid boolean,
  broken_at_seq bigint,
  head_hash text
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  expected text := '';
  rec record;
  broken bigint := null;
  last_hash text := null;
  total bigint := 0;
begin
  for rec in
    select e.seq, e.prev_hash, e.hash
      from session_events e
     where e.session_id = p_session_id
     order by e.seq
  loop
    total := total + 1;
    if broken is null and rec.prev_hash is distinct from expected then
      broken := rec.seq;
    end if;
    expected := rec.hash;
    last_hash := rec.hash;
  end loop;

  return query select total, broken is null, broken, last_hash;
end;
$$;

-- Current head of a session's chain. The Edge Function calls this to fill in
-- prev_hash without racing another append.
create or replace function session_chain_head(p_session_id uuid)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    (select hash from session_events
      where session_id = p_session_id
      order by seq desc
      limit 1),
    ''
  );
$$;
