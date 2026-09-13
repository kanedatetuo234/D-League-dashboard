const url = process.argv[2];
if (!url) throw new Error('GAS API URLを指定してください。');
const quote = value => String(value ?? '').replaceAll("'", "''");
const json = value => quote(JSON.stringify(value ?? {}));
const data = await fetch(url).then(response => {
  if (!response.ok) throw new Error(`GAS API: ${response.status}`);
  return response.json();
});
const games = new Map();
for (const row of data.results || []) {
  if (!games.has(row.game_id)) games.set(row.game_id, []);
  games.get(row.game_id).push(row);
}
const sql = ['begin;'];
sql.push(`insert into public.members(player_id, display_name, active, color, icon) values ${data.members.map(row => `('${quote(row.player_id)}','${quote(row.display_name)}',${row.active === false ? 'false' : 'true'},'${quote(row.color)}','${quote(row.icon)}')`).join(',')} on conflict(player_id) do update set display_name=excluded.display_name, active=excluded.active, color=excluded.color, icon=excluded.icon;`);
sql.push(`insert into public.local_rules(game_type, rules) values ${Object.entries(data.settings || {}).map(([gameType, rules]) => `('${gameType}','${json(rules)}'::jsonb)`).join(',')} on conflict(game_type) do update set rules=excluded.rules;`);
for (const [gameId, rows] of games) {
  const first = rows[0];
  sql.push(`insert into public.matches(legacy_game_id, played_on, game_type, yakuman, comment) values ('${quote(gameId)}','${quote(first.date)}','${first.game_type === 'tonpu' ? 'tonpu' : 'hanchan'}',${first.yakuman === true ? 'true' : 'false'},'${quote(first.comment)}') on conflict(legacy_game_id) do update set played_on=excluded.played_on, game_type=excluded.game_type, yakuman=excluded.yakuman, comment=excluded.comment;`);
  const values = rows.map(row => `('${quote(row.player_id)}',${Number(row.rank) || 0},${Number(row.score) || 0},'${quote(row.seat_order)}',${Number(row.chips) || 0},${row.yakitori === true ? 'true' : 'false'},${Number(row.point) || 0},'${json(row.breakdown)}'::jsonb)`).join(',');
  sql.push(`insert into public.match_players(match_id, player_id, rank, score, seat, chips, yakitori, point, point_breakdown) select m.id,v.player_id,v.rank,v.score,v.seat,v.chips,v.yakitori,v.point,v.breakdown from public.matches m cross join (values ${values}) as v(player_id,rank,score,seat,chips,yakitori,point,breakdown) where m.legacy_game_id='${quote(gameId)}' on conflict(match_id,player_id) do update set rank=excluded.rank, score=excluded.score, seat=excluded.seat, chips=excluded.chips, yakitori=excluded.yakitori, point=excluded.point, point_breakdown=excluded.point_breakdown;`);
  sql.push(`insert into public.match_rule_snapshots(match_id, game_type, rules) select id, game_type, coalesce((select rules from public.local_rules where game_type=public.matches.game_type),'{}'::jsonb) from public.matches where legacy_game_id='${quote(gameId)}' on conflict(match_id) do update set game_type=excluded.game_type, rules=excluded.rules;`);
}
sql.push('commit;');
console.log(sql.join('\n'));
