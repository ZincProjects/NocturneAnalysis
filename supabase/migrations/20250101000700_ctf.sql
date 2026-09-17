-- Nocturne CTF: a small jeopardy-style capture the flag that runs beside the
-- SOC scenarios.
--
-- Players are not Supabase Auth users. They join with a handle, and the web
-- server keeps a random player token in an httpOnly cookie. Only the SHA-256 of
-- that token is stored here.
--
-- No CTF table is readable or writable by anon or authenticated. Everything a
-- player can do goes through the SECURITY DEFINER functions below, which take
-- the player token and apply the rules in one transaction: the event window,
-- the one-solve-per-challenge rule and the wrong-guess lockout. Flag hashes
-- never leave the database.
--
-- The organiser screen uses the service role and so works on the tables
-- directly.

-- ------------------------------------------------------------------ tables --

create table public.ctf_event (
  id smallint primary key default 1 check (id = 1),
  title text not null default 'Nocturne CTF',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default true,
  -- SHA-256 of the optional join passcode. Never the passcode itself.
  passcode_hash text check (passcode_hash ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.ctf_players (
  id uuid primary key default gen_random_uuid(),
  handle text not null check (handle ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{2,23}$'),
  team_name text check (char_length(team_name) between 1 and 32),
  -- SHA-256 of the passcode this player joined with, when one was required.
  passcode_hash text check (passcode_hash ~ '^[0-9a-f]{64}$'),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create unique index ctf_players_handle_key on public.ctf_players (lower(handle));

create table public.ctf_challenges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  category text not null check (category in ('web', 'crypto', 'forensics', 'misc')),
  title text not null,
  prompt_md text not null,
  -- Shown once the player has solved the challenge, or after the event ends.
  explanation_md text not null default '',
  points integer not null check (points > 0),
  -- sha256(normalizeFlag(flag)); see src/lib/ctf/flag.ts for the rule.
  flag_hash text not null check (flag_hash ~ '^[0-9a-f]{64}$'),
  -- [{ "text": "...", "cost": 25 }], revealed in order.
  hints jsonb not null default '[]'::jsonb check (jsonb_typeof(hints) = 'array'),
  file_path text check (file_path ~ '^/ctf-files/[A-Za-z0-9._-]+$'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.ctf_submissions (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.ctf_players (id) on delete cascade,
  challenge_id uuid not null references public.ctf_challenges (id) on delete cascade,
  submitted_value text not null check (char_length(submitted_value) <= 200),
  is_correct boolean not null,
  created_at timestamptz not null default now()
);

-- A solved challenge can never be scored twice.
create unique index ctf_submissions_one_solve
  on public.ctf_submissions (player_id, challenge_id)
  where is_correct;

create index ctf_submissions_player_challenge
  on public.ctf_submissions (player_id, challenge_id, created_at desc);

create index ctf_submissions_correct on public.ctf_submissions (challenge_id, created_at)
  where is_correct;

create table public.ctf_hint_reveals (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.ctf_players (id) on delete cascade,
  challenge_id uuid not null references public.ctf_challenges (id) on delete cascade,
  hint_index integer not null check (hint_index >= 0),
  revealed_at timestamptz not null default now(),
  unique (player_id, challenge_id, hint_index)
);

-- Values the deliberately vulnerable challenge pages serve. Kept out of the
-- repository; the seed script writes them.
create table public.ctf_site_secrets (
  key text primary key,
  value text not null
);

alter table public.ctf_event enable row level security;
alter table public.ctf_players enable row level security;
alter table public.ctf_challenges enable row level security;
alter table public.ctf_submissions enable row level security;
alter table public.ctf_hint_reveals enable row level security;
alter table public.ctf_site_secrets enable row level security;

revoke all on public.ctf_event, public.ctf_players, public.ctf_challenges,
  public.ctf_submissions, public.ctf_hint_reveals, public.ctf_site_secrets
  from anon, authenticated;

-- ------------------------------------------------------------------- views --

-- Score = points for solves minus the cost of every hint revealed. Ties go to
-- whoever reached the score first.
create view public.ctf_scoreboard
with (security_invoker = true) as
with solves as (
  select s.player_id, count(*) as solves, sum(c.points) as points, max(s.created_at) as last_solve_at
  from public.ctf_submissions s
  join public.ctf_challenges c on c.id = s.challenge_id
  where s.is_correct
  group by s.player_id
),
hint_costs as (
  select r.player_id, sum(coalesce((c.hints -> r.hint_index ->> 'cost')::integer, 0)) as cost
  from public.ctf_hint_reveals r
  join public.ctf_challenges c on c.id = r.challenge_id
  group by r.player_id
)
select
  p.id as player_id,
  p.handle,
  p.team_name,
  coalesce(sv.points, 0) - coalesce(h.cost, 0) as score,
  coalesce(sv.solves, 0) as solves,
  coalesce(h.cost, 0) as hint_cost,
  sv.last_solve_at,
  p.created_at
from public.ctf_players p
left join solves sv on sv.player_id = p.id
left join hint_costs h on h.player_id = p.id;

create view public.ctf_first_bloods
with (security_invoker = true) as
select distinct on (s.challenge_id)
  s.challenge_id,
  s.player_id,
  s.created_at
from public.ctf_submissions s
where s.is_correct
order by s.challenge_id, s.created_at, s.id;

create view public.ctf_challenge_stats
with (security_invoker = true) as
select
  c.id as challenge_id,
  c.slug,
  c.title,
  c.category,
  c.points,
  c.is_active,
  c.sort_order,
  count(s.id) as attempts,
  count(s.id) filter (where s.is_correct) as solves,
  count(distinct s.player_id) as players
from public.ctf_challenges c
left join public.ctf_submissions s on s.challenge_id = c.id
group by c.id;

revoke all on public.ctf_scoreboard, public.ctf_first_bloods, public.ctf_challenge_stats
  from anon, authenticated;

-- --------------------------------------------------------------- internals --

create or replace function app.ctf_sha256(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(p_value, 'UTF8')), 'hex');
$$;

create or replace function app.ctf_player(p_token text)
returns public.ctf_players
language sql
stable
security definer
set search_path = ''
as $$
  select p.*
  from public.ctf_players p
  where p_token is not null
    and char_length(p_token) between 32 and 128
    and p.token_hash = app.ctf_sha256(p_token);
$$;

-- 'upcoming' | 'live' | 'ended' | 'inactive' | 'unscheduled'
create or replace function app.ctf_event_status()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select case
        when not e.is_active then 'inactive'
        when now() < e.starts_at then 'upcoming'
        when now() >= e.ends_at then 'ended'
        else 'live'
      end
      from public.ctf_event e
      where e.id = 1
    ),
    'unscheduled'
  );
$$;

create or replace function app.ctf_event_json()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'title', coalesce(e.title, 'Nocturne CTF'),
    'starts_at', e.starts_at,
    'ends_at', e.ends_at,
    'status', app.ctf_event_status(),
    'requires_passcode', coalesce(e.passcode_hash is not null, false),
    'server_now', now()
  )
  from (select 1) one
  left join public.ctf_event e on e.id = 1;
$$;

revoke all on function app.ctf_sha256(text), app.ctf_player(text), app.ctf_event_status(),
  app.ctf_event_json() from public, anon, authenticated;

-- ---------------------------------------------------------- player-facing --

create or replace function public.ctf_event_info()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select app.ctf_event_json();
$$;

create or replace function public.ctf_join(p_handle text, p_team text, p_passcode text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_event public.ctf_event;
  v_status text := app.ctf_event_status();
  v_handle text := btrim(coalesce(p_handle, ''));
  v_team text := nullif(btrim(coalesce(p_team, '')), '');
  v_token text;
  v_player_id uuid;
begin
  if v_status in ('unscheduled', 'inactive') then
    raise exception 'ctf:not_open';
  end if;
  if v_status = 'ended' then
    raise exception 'ctf:ended';
  end if;

  select * into v_event from public.ctf_event where id = 1;

  if v_event.passcode_hash is not null
     and app.ctf_sha256(coalesce(p_passcode, '')) <> v_event.passcode_hash then
    raise exception 'ctf:bad_passcode';
  end if;

  if v_handle !~ '^[A-Za-z0-9][A-Za-z0-9_.-]{2,23}$' then
    raise exception 'ctf:bad_handle';
  end if;
  if v_team is not null and (char_length(v_team) > 32 or v_team ~ '[[:cntrl:]]') then
    raise exception 'ctf:bad_team';
  end if;

  -- Joining is anonymous, so this is the only thing standing between a script
  -- and ten thousand fresh players, each with a fresh set of guesses.
  perform pg_advisory_xact_lock(hashtextextended('ctf_join', 0));
  if (select count(*) from public.ctf_players where created_at > now() - interval '1 minute') >= 120 then
    raise exception 'ctf:busy';
  end if;

  if exists (select 1 from public.ctf_players where lower(handle) = lower(v_handle)) then
    raise exception 'ctf:handle_taken';
  end if;

  -- Two v4 UUIDs: 244 random bits from the server's CSPRNG.
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  insert into public.ctf_players (handle, team_name, passcode_hash, token_hash)
  values (
    v_handle,
    v_team,
    case when v_event.passcode_hash is not null then v_event.passcode_hash end,
    app.ctf_sha256(v_token)
  )
  returning id into v_player_id;

  return jsonb_build_object('token', v_token, 'player_id', v_player_id, 'handle', v_handle);
end;
$$;

-- Everything the challenge grid needs, for one player.
create or replace function public.ctf_player_state(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_player public.ctf_players := app.ctf_player(p_token);
  v_status text := app.ctf_event_status();
  v_challenges jsonb := '[]'::jsonb;
  v_score record;
  v_rank bigint;
begin
  if v_player.id is null then
    return null;
  end if;

  select * into v_score from public.ctf_scoreboard where player_id = v_player.id;

  select count(*) + 1 into v_rank
  from public.ctf_scoreboard b
  where b.score > v_score.score
     or (b.score = v_score.score and v_score.solves > 0 and b.solves > 0
         and b.last_solve_at < v_score.last_solve_at);

  if v_status in ('live', 'ended') then
    select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.category_order, x.sort_order, x.points), '[]'::jsonb)
    into v_challenges
    from (
      select
        c.slug,
        c.category,
        c.title,
        c.points,
        c.sort_order,
        array_position(array['web', 'crypto', 'forensics', 'misc'], c.category) as category_order,
        jsonb_array_length(c.hints) as hint_count,
        (select count(*) from public.ctf_hint_reveals r
          where r.player_id = v_player.id and r.challenge_id = c.id) as hints_revealed,
        mine.created_at as solved_at,
        mine.created_at is not null as solved,
        (select count(*) from public.ctf_submissions s
          where s.player_id = v_player.id and s.challenge_id = c.id) as attempts,
        (select count(*) from public.ctf_submissions s
          where s.challenge_id = c.id and s.is_correct) as solve_count,
        c.file_path is not null as has_file
      from public.ctf_challenges c
      left join public.ctf_submissions mine
        on mine.challenge_id = c.id and mine.player_id = v_player.id and mine.is_correct
      where c.is_active
    ) x;
  end if;

  return jsonb_build_object(
    'player', jsonb_build_object(
      'handle', v_player.handle,
      'team_name', v_player.team_name,
      'score', v_score.score,
      'solves', v_score.solves,
      'hint_cost', v_score.hint_cost,
      'rank', v_rank,
      'player_count', (select count(*) from public.ctf_players)
    ),
    'event', app.ctf_event_json(),
    'challenges', v_challenges
  );
end;
$$;

create or replace function public.ctf_challenge_detail(p_token text, p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_player public.ctf_players := app.ctf_player(p_token);
  v_status text := app.ctf_event_status();
  v_challenge public.ctf_challenges;
  v_solved_at timestamptz;
  v_revealed integer;
  v_wrong integer;
  v_last_wrong timestamptz;
  v_retry integer := 0;
begin
  if v_player.id is null then
    raise exception 'ctf:no_player';
  end if;
  if v_status not in ('live', 'ended') then
    raise exception 'ctf:not_live';
  end if;

  select * into v_challenge from public.ctf_challenges where slug = p_slug and is_active;
  if v_challenge.id is null then
    return null;
  end if;

  select created_at into v_solved_at from public.ctf_submissions
  where player_id = v_player.id and challenge_id = v_challenge.id and is_correct;

  select count(*) into v_revealed from public.ctf_hint_reveals
  where player_id = v_player.id and challenge_id = v_challenge.id;

  select count(*), max(created_at) into v_wrong, v_last_wrong from public.ctf_submissions
  where player_id = v_player.id and challenge_id = v_challenge.id and not is_correct;

  if v_solved_at is null and v_wrong > 0 and v_wrong % 5 = 0
     and v_last_wrong > now() - interval '60 seconds' then
    v_retry := ceil(extract(epoch from (v_last_wrong + interval '60 seconds' - now())))::integer;
  end if;

  return jsonb_build_object(
    'slug', v_challenge.slug,
    'category', v_challenge.category,
    'title', v_challenge.title,
    'points', v_challenge.points,
    'prompt_md', v_challenge.prompt_md,
    'file_path', v_challenge.file_path,
    'solved', v_solved_at is not null,
    'solved_at', v_solved_at,
    'attempts', v_wrong + (case when v_solved_at is null then 0 else 1 end),
    'retry_after', v_retry,
    'solve_count', (select count(*) from public.ctf_submissions
                    where challenge_id = v_challenge.id and is_correct),
    'explanation_md', case when v_solved_at is not null or v_status = 'ended'
                           then v_challenge.explanation_md end,
    'hints', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'index', h.ordinality - 1,
        'cost', coalesce((h.value ->> 'cost')::integer, 0),
        'text', case when h.ordinality <= v_revealed then h.value ->> 'text' end
      ) order by h.ordinality), '[]'::jsonb)
      from jsonb_array_elements(v_challenge.hints) with ordinality h
    ),
    'event', app.ctf_event_json()
  );
end;
$$;

-- p_flag_hash is sha256(normalizeFlag(p_value)), computed by the web server so
-- that the normalisation rule lives in exactly one place. A caller who sends a
-- hash that does not match their value only fools themselves.
create or replace function public.ctf_submit(
  p_token text,
  p_slug text,
  p_value text,
  p_flag_hash text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_player public.ctf_players := app.ctf_player(p_token);
  v_challenge public.ctf_challenges;
  v_wrong integer;
  v_last_wrong timestamptz;
  v_correct boolean;
begin
  if v_player.id is null then
    raise exception 'ctf:no_player';
  end if;

  if app.ctf_event_status() <> 'live' then
    return jsonb_build_object('result', 'closed');
  end if;

  select * into v_challenge from public.ctf_challenges where slug = p_slug and is_active;
  if v_challenge.id is null then
    raise exception 'ctf:no_challenge';
  end if;

  if p_value is null or char_length(btrim(p_value)) = 0 or char_length(p_value) > 200 then
    raise exception 'ctf:bad_value';
  end if;

  -- Serialise attempts on one challenge by one player, so five guesses fired in
  -- parallel cannot all slip under the lockout.
  perform pg_advisory_xact_lock(hashtextextended(v_player.id::text || ':' || v_challenge.id::text, 0));

  if exists (select 1 from public.ctf_submissions
             where player_id = v_player.id and challenge_id = v_challenge.id and is_correct) then
    return jsonb_build_object('result', 'already_solved');
  end if;

  select count(*), max(created_at) into v_wrong, v_last_wrong from public.ctf_submissions
  where player_id = v_player.id and challenge_id = v_challenge.id and not is_correct;

  -- Every fifth wrong guess in a row locks the challenge for a minute.
  if v_wrong > 0 and v_wrong % 5 = 0 and v_last_wrong > now() - interval '60 seconds' then
    return jsonb_build_object(
      'result', 'locked',
      'retry_after', ceil(extract(epoch from (v_last_wrong + interval '60 seconds' - now())))::integer
    );
  end if;

  v_correct := lower(coalesce(p_flag_hash, '')) = v_challenge.flag_hash;

  insert into public.ctf_submissions (player_id, challenge_id, submitted_value, is_correct)
  values (v_player.id, v_challenge.id, p_value, v_correct);

  if v_correct then
    return jsonb_build_object(
      'result', 'correct',
      'points', v_challenge.points,
      'first_blood', not exists (
        select 1 from public.ctf_submissions
        where challenge_id = v_challenge.id and is_correct and player_id <> v_player.id
      )
    );
  end if;

  -- Guesses left before the next lockout; zero means this guess triggered it.
  return jsonb_build_object(
    'result', 'incorrect',
    'attempts_left', (5 - (v_wrong + 1) % 5) % 5,
    'retry_after', case when (v_wrong + 1) % 5 = 0 then 60 else 0 end
  );
end;
$$;

create or replace function public.ctf_reveal_hint(p_token text, p_slug text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_player public.ctf_players := app.ctf_player(p_token);
  v_challenge public.ctf_challenges;
  v_next integer;
begin
  if v_player.id is null then
    raise exception 'ctf:no_player';
  end if;
  if app.ctf_event_status() <> 'live' then
    raise exception 'ctf:not_live';
  end if;

  select * into v_challenge from public.ctf_challenges where slug = p_slug and is_active;
  if v_challenge.id is null then
    raise exception 'ctf:no_challenge';
  end if;

  if exists (select 1 from public.ctf_submissions
             where player_id = v_player.id and challenge_id = v_challenge.id and is_correct) then
    raise exception 'ctf:already_solved';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_player.id::text || ':' || v_challenge.id::text, 1));

  select count(*) into v_next from public.ctf_hint_reveals
  where player_id = v_player.id and challenge_id = v_challenge.id;

  if v_next >= jsonb_array_length(v_challenge.hints) then
    raise exception 'ctf:no_more_hints';
  end if;

  insert into public.ctf_hint_reveals (player_id, challenge_id, hint_index)
  values (v_player.id, v_challenge.id, v_next);

  return jsonb_build_object(
    'index', v_next,
    'text', v_challenge.hints -> v_next ->> 'text',
    'cost', coalesce((v_challenge.hints -> v_next ->> 'cost')::integer, 0)
  );
end;
$$;

-- Public, for the projector. Handles and scores only; never guesses.
create or replace function public.ctf_public_scoreboard()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'event', app.ctf_event_json(),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'handle', b.handle,
        'team_name', b.team_name,
        'score', b.score,
        'solves', b.solves,
        'last_solve_at', b.last_solve_at,
        'first_bloods', (select count(*) from public.ctf_first_bloods f where f.player_id = b.player_id)
      ) order by b.score desc, b.last_solve_at asc nulls last, b.created_at asc)
      from (
        select * from public.ctf_scoreboard
        order by score desc, last_solve_at asc nulls last, created_at asc
        limit 200
      ) b
    ), '[]'::jsonb),
    'challenges', case when app.ctf_event_status() in ('live', 'ended') then coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', c.title,
        'category', c.category,
        'points', c.points,
        'solves', (select count(*) from public.ctf_submissions s where s.challenge_id = c.id and s.is_correct),
        'first_blood', (select p.handle from public.ctf_first_bloods f
                        join public.ctf_players p on p.id = f.player_id
                        where f.challenge_id = c.id),
        'first_blood_at', (select f.created_at from public.ctf_first_bloods f where f.challenge_id = c.id)
      ) order by array_position(array['web', 'crypto', 'forensics', 'misc'], c.category), c.sort_order, c.points)
      from public.ctf_challenges c
      where c.is_active
    ), '[]'::jsonb) else '[]'::jsonb end
  );
$$;

-- ------------------------------------------------ the vulnerable challenges --

-- "Robots Don't Lie": the memo behind the path robots.txt disallows. Anyone
-- may read it once the event is open - that is the challenge.
create or replace function public.ctf_intranet_memo()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when app.ctf_event_status() in ('live', 'ended')
    then (select value from public.ctf_site_secrets where key = 'robots-dont-lie') end;
$$;

-- "Sequential Secrets": the notes service. The vulnerability is in the route
-- that calls this - it passes whatever id the URL holds, with no ownership
-- check. Note 7 is always the caller's own.
create or replace function public.ctf_note(p_token text, p_id integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_player public.ctf_players := app.ctf_player(p_token);
begin
  if v_player.id is null then
    raise exception 'ctf:no_player';
  end if;
  if app.ctf_event_status() not in ('live', 'ended') then
    raise exception 'ctf:not_live';
  end if;

  return case p_id
    when 1 then jsonb_build_object('id', 1, 'owner', 'j.tan', 'title', 'Printer on level 2',
      'body', 'Jammed again. Facilities ticket FAC-2291 raised.')
    when 2 then jsonb_build_object('id', 2, 'owner', 'a.wong', 'title', 'Timetable export',
      'body', 'Remember to export the semester 2 timetable before Friday.')
    when 3 then jsonb_build_object('id', 3, 'owner', 'p.raman', 'title', 'Password reset',
      'body', 'IT reset my account after the phishing test. Do not click links in "maintenance" emails.')
    when 4 then jsonb_build_object('id', 4, 'owner', 'k.lim', 'title', 'Budget review',
      'body', 'Finance review moved to Thursday 3pm, room B-204.')
    when 5 then jsonb_build_object('id', 5, 'owner', 's.ong', 'title', 'Lab booking',
      'body', 'Cyber lab booked for the CTF warm-up. Projector cable is in the drawer.')
    when 6 then jsonb_build_object('id', 6, 'owner', 'm.chua', 'title', 'Reminder',
      'body', 'Rotate the backup tapes. Offsite pickup is Monday.')
    when 7 then jsonb_build_object('id', 7, 'owner', v_player.handle, 'title', 'My first note',
      'body', 'Welcome to Northwind Notes. Only you can see this note... right?')
    when 8 then jsonb_build_object('id', 8, 'owner', 'admin', 'title', 'Break-glass credentials',
      'body', 'Do not share. Recovery phrase: ' ||
        coalesce((select value from public.ctf_site_secrets where key = 'sequential-secrets'), '(not seeded)'))
    else null
  end;
end;
$$;

revoke all on function
  public.ctf_event_info(),
  public.ctf_join(text, text, text),
  public.ctf_player_state(text),
  public.ctf_challenge_detail(text, text),
  public.ctf_submit(text, text, text, text),
  public.ctf_reveal_hint(text, text),
  public.ctf_public_scoreboard(),
  public.ctf_intranet_memo(),
  public.ctf_note(text, integer)
  from public;

grant execute on function
  public.ctf_event_info(),
  public.ctf_join(text, text, text),
  public.ctf_player_state(text),
  public.ctf_challenge_detail(text, text),
  public.ctf_submit(text, text, text, text),
  public.ctf_reveal_hint(text, text),
  public.ctf_public_scoreboard(),
  public.ctf_intranet_memo(),
  public.ctf_note(text, integer)
  to anon, authenticated;
