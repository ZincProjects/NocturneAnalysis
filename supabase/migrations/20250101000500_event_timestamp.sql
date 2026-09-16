-- Let the appender own `created_at`, but hold it to a window.
--
-- The original trigger stamped `created_at := now()` to stop a client dictating
-- the clock. That is the right instinct and the wrong place, because the hash
-- chain covers `created_at`: if the database rewrites the timestamp after the
-- digest is computed, every stored hash is wrong by construction and the chain
-- verifies as broken the moment anyone checks it.
--
-- The timestamp is now supplied by whoever inserts. That is not a weakening,
-- because nothing but the service role can insert into this table at all - the
-- RLS migration revokes INSERT from `anon` and `authenticated`, and the only
-- service-role path is the `append-event` Edge Function, which is server code
-- reading its own clock. A browser still cannot choose a timestamp.
--
-- What the trigger now does is bound it. An append claiming to have happened
-- more than two minutes from the database's own clock is rejected: it is
-- either a clock that has drifted badly enough to make a timeline misleading,
-- or an attempt to backdate an action. Two minutes is generous for serverless
-- clock skew and far tighter than anything that would let a student rewrite
-- the order of their own decisions.

create or replace function enforce_event_chain()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  head_hash text;
  skew interval;
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

  new.created_at := coalesce(new.created_at, now());
  -- Postgres has no abs(interval); take the larger of the two differences.
  skew := greatest(new.created_at - now(), now() - new.created_at);

  if skew > interval '2 minutes' then
    raise exception
      'event timestamp % is % away from server time and was rejected',
      new.created_at, skew
      using errcode = 'restrict_violation',
            hint = 'Events are stamped by the append-event Edge Function using server time.';
  end if;

  -- Time must not run backwards within a session, or the replayed timeline
  -- would disagree with the chain order.
  if exists (
    select 1 from session_events e
     where e.session_id = new.session_id
       and e.created_at > new.created_at
  ) then
    raise exception 'event timestamp % precedes an earlier event in the same session', new.created_at
      using errcode = 'restrict_violation';
  end if;

  return new;
end;
$$;
