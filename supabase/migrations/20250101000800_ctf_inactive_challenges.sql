-- A challenge the organiser switches off (say, because it turned out to be
-- broken mid-round) stops counting: its solves, hint costs and first blood
-- drop out of the scoreboard. Switching it back on restores them - nothing is
-- deleted.

create or replace view public.ctf_scoreboard
with (security_invoker = true) as
with solves as (
  select s.player_id, count(*) as solves, sum(c.points) as points, max(s.created_at) as last_solve_at
  from public.ctf_submissions s
  join public.ctf_challenges c on c.id = s.challenge_id
  where s.is_correct and c.is_active
  group by s.player_id
),
hint_costs as (
  select r.player_id, sum(coalesce((c.hints -> r.hint_index ->> 'cost')::integer, 0)) as cost
  from public.ctf_hint_reveals r
  join public.ctf_challenges c on c.id = r.challenge_id
  where c.is_active
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

create or replace view public.ctf_first_bloods
with (security_invoker = true) as
select distinct on (s.challenge_id)
  s.challenge_id,
  s.player_id,
  s.created_at
from public.ctf_submissions s
join public.ctf_challenges c on c.id = s.challenge_id
where s.is_correct and c.is_active
order by s.challenge_id, s.created_at, s.id;

revoke all on public.ctf_scoreboard, public.ctf_first_bloods from anon, authenticated;
