const url = process.argv[2];
if (!url) throw new Error('GAS API URLを指定してください。');
const quote = value => String(value ?? '').replaceAll("'", "''");
const data = await fetch(url).then(response => response.json());
const values = (data.schedule || []).map(row => `('${quote(row.date)}','${quote(row.player_id)}','${quote(row.status || '')}','${quote(row.comment || '')}')`).join(',');
console.log(`begin;\ninsert into public.schedules(schedule_date, player_id, status, comment) values ${values} on conflict(schedule_date, player_id) do update set status=excluded.status, comment=excluded.comment, updated_at=now();\ncommit;`);
