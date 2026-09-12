-- D-League initial Supabase schema
-- Existing Google Sheets/GAS remains the source of truth until cutover.

create extension if not exists pgcrypto;

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  player_id text not null unique,
  display_name text not null,
  color text,
  icon text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  legacy_game_id text unique,
  played_on date not null,
  game_type text not null default 'hanchan' check (game_type in ('hanchan', 'tonpu')),
  yakuman boolean not null default false,
  comment text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id text not null references public.members(player_id),
  rank smallint not null check (rank between 1 and 4),
  score integer not null,
  seat text not null check (seat in ('東', '南', '西', '北')),
  chips integer not null default 0 check (chips >= 0),
  yakitori boolean not null default false,
  point numeric(8,1) not null default 0,
  point_breakdown jsonb not null default '{}'::jsonb,
  unique (match_id, player_id),
  unique (match_id, rank),
  unique (match_id, seat)
);

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  schedule_date date not null,
  player_id text not null references public.members(player_id),
  status text not null default '' check (status in ('', '可', '未定', '不可')),
  comment text not null default '',
  updated_at timestamptz not null default now(),
  unique (schedule_date, player_id)
);

create table if not exists public.local_rules (
  game_type text primary key check (game_type in ('hanchan', 'tonpu')),
  rules jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.match_photos (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists matches_played_on_idx on public.matches (played_on desc);
create index if not exists match_players_player_idx on public.match_players (player_id);
create index if not exists schedules_date_idx on public.schedules (schedule_date);

insert into public.local_rules (game_type, rules)
values ('hanchan', '{}'::jsonb), ('tonpu', '{}'::jsonb)
on conflict (game_type) do nothing;

alter table public.members enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.schedules enable row level security;
alter table public.local_rules enable row level security;
alter table public.match_photos enable row level security;

-- Public dashboard reads are allowed. Mutations will go through protected Edge Functions.
create policy "public can read members" on public.members for select using (true);
create policy "public can read matches" on public.matches for select using (true);
create policy "public can read match players" on public.match_players for select using (true);
create policy "public can read schedules" on public.schedules for select using (true);
create policy "public can read local rules" on public.local_rules for select using (true);
create policy "public can read match photos" on public.match_photos for select using (true);

insert into storage.buckets (id, name, public)
values ('match-photos', 'match-photos', true)
on conflict (id) do nothing;

create policy "public can view match photo objects"
on storage.objects for select
using (bucket_id = 'match-photos');
