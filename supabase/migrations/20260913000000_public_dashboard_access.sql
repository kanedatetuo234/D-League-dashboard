-- Public dashboard access for the no-login company recreation deployment.
-- Reads are exposed to anon; writes remain behind the match-write function so
-- validation, point calculation, snapshots, and audit logs are not bypassed.

grant select on table
  public.members,
  public.matches,
  public.match_players,
  public.schedules,
  public.local_rules,
  public.match_photos,
  public.match_rule_snapshots
to anon, authenticated;

drop policy if exists "public can read members" on public.members;
create policy "public can read members"
  on public.members for select to anon, authenticated using (true);

drop policy if exists "public can read matches" on public.matches;
create policy "public can read matches"
  on public.matches for select to anon, authenticated using (true);

drop policy if exists "public can read match players" on public.match_players;
create policy "public can read match players"
  on public.match_players for select to anon, authenticated using (true);

drop policy if exists "public can read schedules" on public.schedules;
create policy "public can read schedules"
  on public.schedules for select to anon, authenticated using (true);

drop policy if exists "public can read local rules" on public.local_rules;
create policy "public can read local rules"
  on public.local_rules for select to anon, authenticated using (true);

drop policy if exists "public can read match photos" on public.match_photos;
create policy "public can read match photos"
  on public.match_photos for select to anon, authenticated using (true);

drop policy if exists "public can read match rule snapshots" on public.match_rule_snapshots;
create policy "public can read match rule snapshots"
  on public.match_rule_snapshots for select to anon, authenticated using (true);

grant select on table storage.objects to anon, authenticated;
drop policy if exists "public can view match photo objects" on storage.objects;
create policy "public can view match photo objects"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'match-photos');

-- The project currently does not grant the server role automatically.
-- Edge Functions use this role for validated writes and audit logging.
grant select, insert, update, delete on table
  public.members,
  public.matches,
  public.match_players,
  public.schedules,
  public.local_rules,
  public.match_photos,
  public.match_rule_snapshots,
  public.match_change_logs
to service_role;
grant select, insert, update, delete on table storage.objects to service_role;
