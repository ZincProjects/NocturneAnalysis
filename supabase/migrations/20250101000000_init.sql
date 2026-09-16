-- NocturneAnalysis core schema.
--
-- Design notes that matter downstream:
--   * Everything is scoped by org_id. A school's data never touches another's.
--   * session_events is append-only and hash-chained; see the integrity
--     migration for the enforcement.
--   * Personal data is kept minimal on purpose. `handle` is a pseudonym and is
--     the only identifier allowed on any shared view (leaderboards, reports),
--     because a meaningful share of users will be minors.

create extension if not exists "pgcrypto" with schema extensions;

-- ---------------------------------------------------------------- enums ----

create type org_kind as enum ('school', 'polytechnic', 'demo');
create type user_role as enum ('student', 'instructor', 'admin');
create type scenario_category as enum ('phishing', 'network', 'web', 'ransomware', 'insider');
create type scenario_difficulty as enum ('beginner', 'intermediate', 'advanced');
create type session_status as enum ('in_progress', 'submitted', 'graded');
create type finding_kind as enum ('ioc', 'technique', 'root_cause');
create type report_format as enum ('pdf', 'markdown');

create type phase_key as enum (
  'triage',
  'investigation',
  'containment',
  'eradication',
  'recovery',
  'lessons_learned'
);

create type asset_type as enum (
  'email',
  'firewall_log',
  'edr_alert',
  'auth_log',
  'dns_log',
  'proxy_log',
  'file_share_log',
  'http_access_log',
  'ransom_note',
  'ticket'
);

-- Mirrors src/lib/events/types.ts. Adding a member means updating that file
-- and the append-event Edge Function in the same change.
create type event_type as enum (
  'SESSION_START',
  'SESSION_PAUSE',
  'SESSION_RESUME',
  'SESSION_COMPLETE',
  'VIEW_ALERT',
  'RUN_QUERY',
  'VIEW_LOG_ENTRY',
  'TAG_IOC',
  'UNTAG_IOC',
  'ADD_NOTE',
  'SUBMIT_DECISION',
  'REQUEST_HINT',
  'PHASE_TRANSITION',
  'CONTAIN_HOST',
  'ISOLATE_ACCOUNT',
  'BLOCK_INDICATOR',
  'ESCALATE',
  'DOWNLOAD_ARTIFACT',
  'SUBMIT_REPORT',
  'INSTRUCTOR_COMMENT',
  'GRADE_ASSIGNED'
);

-- --------------------------------------------------------------- tables ----

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind org_kind not null default 'school',
  -- Schools that do not want competition can switch the leaderboard off.
  -- Default is off: the private option should never require an opt-out.
  leaderboard_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  org_id uuid not null references organizations on delete cascade,
  role user_role not null default 'student',
  -- Visible only to the student's own org staff.
  display_name text not null,
  -- Pseudonym. The only name allowed on leaderboards and generated reports.
  handle text not null,
  cohort text,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint profiles_handle_unique_per_org unique (org_id, handle),
  constraint profiles_handle_format check (handle ~ '^[A-Za-z0-9_.-]{3,32}$')
);

create index profiles_org_idx on profiles (org_id);

create table scenarios (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category scenario_category not null,
  difficulty scenario_difficulty not null,
  estimated_minutes integer not null check (estimated_minutes > 0),
  summary text not null,
  briefing_md text not null,
  learning_objectives text[] not null default '{}',
  organization_name text not null,
  root_cause text not null,
  model_recommendations text[] not null default '{}',
  continues_from text,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create table scenario_phases (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references scenarios on delete cascade,
  phase_key phase_key not null,
  order_index integer not null,
  title text not null,
  instructions_md text not null,
  objectives text[] not null default '{}',
  -- The authored spec for this phase: decisions, actions, hints and the gate.
  spec jsonb not null,
  success_criteria jsonb not null,
  unique (scenario_id, phase_key)
);

create table scenario_assets (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references scenarios on delete cascade,
  external_id text not null,
  asset_type asset_type not null,
  content jsonb not null,
  is_decoy boolean not null default false,
  reveal_phase phase_key not null default 'triage',
  unique (scenario_id, external_id)
);

create index scenario_assets_scenario_idx on scenario_assets (scenario_id);

create table mitre_techniques (
  id uuid primary key default gen_random_uuid(),
  technique_id text not null unique,
  tactic text not null,
  tactic_id text not null,
  name text not null,
  description text not null default '',
  url text not null,
  is_subtechnique boolean not null default false,
  parent_id text
);

create table owasp_categories (
  code text primary key,
  name text not null,
  short_name text not null,
  description text not null,
  plain_language text not null,
  url text not null
);

create table scenario_technique_map (
  scenario_id uuid not null references scenarios on delete cascade,
  technique_id text not null,
  primary key (scenario_id, technique_id)
);

create table scenario_owasp_map (
  scenario_id uuid not null references scenarios on delete cascade,
  owasp_code text not null references owasp_categories on delete cascade,
  primary key (scenario_id, owasp_code)
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references scenarios on delete restrict,
  user_id uuid not null references profiles on delete cascade,
  org_id uuid not null references organizations on delete cascade,
  status session_status not null default 'in_progress',
  current_phase phase_key not null default 'triage',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  score integer,
  max_score integer,
  -- Set by an instructor override; null means the machine score stands.
  adjusted_score integer,
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);

create index sessions_user_idx on sessions (user_id, started_at desc);
create index sessions_org_idx on sessions (org_id, started_at desc);
create index sessions_sample_idx on sessions (is_sample) where is_sample;

create table session_events (
  id uuid primary key default gen_random_uuid(),
  -- Strict total order within a session. created_at alone can tie.
  seq bigint generated always as identity,
  session_id uuid not null references sessions on delete cascade,
  user_id uuid references profiles on delete set null,
  event_type event_type not null,
  phase phase_key,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  prev_hash text not null default '',
  hash text not null,
  client_meta jsonb,
  constraint session_events_hash_format check (hash ~ '^[0-9a-f]{64}$'),
  constraint session_events_prev_hash_format check (prev_hash = '' or prev_hash ~ '^[0-9a-f]{64}$')
);

create index session_events_session_idx on session_events (session_id, seq);
create unique index session_events_session_hash_idx on session_events (session_id, hash);

create table findings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions on delete cascade,
  kind finding_kind not null,
  value text not null,
  phase phase_key not null,
  is_correct boolean,
  created_at timestamptz not null default now(),
  unique (session_id, kind, value)
);

create table session_decisions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions on delete cascade,
  phase phase_key not null,
  decision_key text not null,
  decision_value jsonb not null,
  is_correct boolean,
  rationale_md text,
  created_at timestamptz not null default now(),
  unique (session_id, decision_key)
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions on delete cascade,
  format report_format not null,
  storage_path text,
  -- Markdown is stored inline; the PDF lives in Storage.
  body_md text,
  summary jsonb not null default '{}'::jsonb,
  -- Head of the event hash chain at generation time: the report's seal.
  chain_head_hash text,
  generated_at timestamptz not null default now(),
  unique (session_id, format)
);

create table badges (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text not null,
  criteria jsonb not null default '{}'::jsonb
);

create table session_badges (
  session_id uuid not null references sessions on delete cascade,
  badge_id uuid not null references badges on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (session_id, badge_id)
);

-- Instructors annotate a session by adding rows here and an INSTRUCTOR_COMMENT
-- event. History is never edited.
create table instructor_comments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions on delete cascade,
  instructor_id uuid not null references profiles on delete cascade,
  phase phase_key,
  comment text not null,
  created_at timestamptz not null default now()
);

create table assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  scenario_id uuid not null references scenarios on delete cascade,
  cohort text,
  assigned_by uuid not null references profiles on delete cascade,
  due_at timestamptz,
  created_at timestamptz not null default now()
);

create index assignments_org_idx on assignments (org_id, cohort);

-- Result of the SOC 101 comprehension check. Not a gate, just a signal.
create table onboarding_results (
  user_id uuid primary key references profiles on delete cascade,
  score integer not null,
  max_score integer not null,
  answers jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now()
);
