-- Add immutable rule snapshots and match audit history.
-- Safe to run after the initial schema migration.

create table if not exists public.match_rule_snapshots (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.matches(id) on delete cascade,
  game_type text not null check (game_type in ('hanchan', 'tonpu')),
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.match_change_logs (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches(id) on delete set null,
  action text not null check (action in ('create', 'update', 'delete')),
  changed_by text,
  before_data jsonb,
  after_data jsonb,
  changed_at timestamptz not null default now()
);

create index if not exists match_change_logs_match_idx
  on public.match_change_logs (match_id, changed_at desc);
create index if not exists match_change_logs_changed_at_idx
  on public.match_change_logs (changed_at desc);

alter table public.match_rule_snapshots enable row level security;
alter table public.match_change_logs enable row level security;

drop policy if exists "public can read match rule snapshots"
  on public.match_rule_snapshots;
create policy "public can read match rule snapshots"
  on public.match_rule_snapshots for select using (true);

-- Change logs have no public read policy; they remain admin/server-side data.
