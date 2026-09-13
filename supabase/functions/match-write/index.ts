import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { calculatePoints, DEFAULT_RULES, validatePlayers } from '../_shared/points.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

function normalizePlayers(input: any[]) {
  return input.map((player, index) => ({
    rank: Number(player.rank || index + 1),
    player_id: String(player.player_id || '').trim(),
    score: Number(player.score),
    seat: String(player.seat || player.seat_order || '').trim(),
    chips: Number(player.chips || 0),
    yakitori: player.yakitori === true || String(player.yakitori).toLowerCase() === 'true',
  }));
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const changedBy = request.headers.get('x-operator')?.trim() || 'public-url';

  try {
    const input = await request.json();
    const action = input.action === 'updateGame' ? 'update' : input.action === 'deleteGame' ? 'delete' : 'create';
    const gameId = String(input.game_id || '').trim();

    if (input.action === 'saveSchedule') {
      const schedule = { schedule_date: input.date, player_id: String(input.player_id || '').trim(), status: String(input.status || ''), comment: String(input.comment || '').trim() };
      if (!schedule.schedule_date || !schedule.player_id) throw new Error('予定日とメンバーが必要です。');
      const saved = await admin.from('schedules').upsert(schedule, { onConflict: 'schedule_date,player_id' }).select('schedule_date,player_id,status,comment').single();
      if (saved.error) throw saved.error;
      return json({ ok: true, schedule: [saved.data.schedule_date, saved.data.player_id, saved.data.status, saved.data.comment] });
    }

    if (input.action === 'addMember' || input.action === 'updateMember') {
      const member = { player_id: String(input.player_id || crypto.randomUUID()).trim(), display_name: String(input.display_name || '').trim(), color: String(input.color || '').trim(), icon: String(input.icon || '').trim(), active: input.active !== false };
      if (!member.display_name) throw new Error('メンバー名が必要です。');
      const saved = await admin.from('members').upsert(member, { onConflict: 'player_id' }).select('player_id,display_name,color,icon,active').single();
      if (saved.error) throw saved.error;
      return json({ ok: true, member: saved.data });
    }

    if (input.action === 'saveSettings') {
      const settings = input.settings && typeof input.settings === 'object' ? input.settings : {};
      for (const gameType of ['hanchan', 'tonpu']) {
        if (!settings[gameType]) continue;
        const saved = await admin.from('local_rules').upsert({ game_type: gameType, rules: settings[gameType] }, { onConflict: 'game_type' });
        if (saved.error) throw saved.error;
      }
      return json({ ok: true, settings });
    }

    if (action === 'delete') {
      if (!gameId) throw new Error('削除対象の対局IDがありません。');
      const resolved = await resolveMatchId(admin, gameId);
      const { data: before, error: beforeError } = await admin.from('matches').select('*, match_players(*)').eq('id', resolved).single();
      if (beforeError) throw beforeError;
      const { error: deleteError } = await admin.from('matches').delete().eq('id', resolved);
      if (deleteError) throw deleteError;
      await admin.from('match_change_logs').insert({ match_id: null, action: 'delete', changed_by: changedBy, before_data: before, after_data: null });
      return json({ ok: true, game_id: resolved });
    }

    const players = normalizePlayers(input.players || []);
    validatePlayers(players);
    const gameType = input.game_type === 'tonpu' ? 'tonpu' : 'hanchan';
    const { data: ruleRow } = await admin.from('local_rules').select('rules').eq('game_type', gameType).maybeSingle();
    const rules = { ...DEFAULT_RULES, ...(ruleRow?.rules || {}) };
    const calculated = calculatePoints(players, rules);
    const legacyGameId = String(input.legacy_game_id || input.game_id || crypto.randomUUID());
    const matchPayload = { legacy_game_id: legacyGameId, played_on: input.date, game_type: gameType, yakuman: input.yakuman === true, comment: String(input.comment || '').trim() };

    let matchId = action === 'update' ? await resolveMatchId(admin, gameId) : gameId;
    let before = null;
    if (action === 'update') {
      if (!matchId) throw new Error('修正対象の対局IDがありません。');
      const existing = await admin.from('matches').select('*, match_players(*)').eq('id', matchId).single();
      if (existing.error) throw existing.error;
      before = existing.data;
      const updated = await admin.from('matches').update(matchPayload).eq('id', matchId).select('id').single();
      if (updated.error) throw updated.error;
      const removed = await admin.from('match_players').delete().eq('match_id', matchId);
      if (removed.error) throw removed.error;
    } else {
      const created = await admin.from('matches').insert(matchPayload).select('id').single();
      if (created.error) throw created.error;
      matchId = created.data.id;
    }

    const { error: playersError } = await admin.from('match_players').insert(calculated.map(player => ({ match_id: matchId, player_id: player.player_id, rank: player.rank, score: player.score, seat: player.seat, chips: player.chips, yakitori: player.yakitori, point: player.point, point_breakdown: player.point_breakdown })));
    if (playersError) throw playersError;
    const { error: snapshotError } = await admin.from('match_rule_snapshots').upsert({ match_id: matchId, game_type: gameType, rules }, { onConflict: 'match_id' });
    if (snapshotError) throw snapshotError;
    await syncPhotos(admin, matchId, input.keep_photo_file_ids);
    await appendPhotos(admin, matchId, input.photos);
    const after = { ...matchPayload, match_id: matchId, match_players: calculated };
    const { error: logError } = await admin.from('match_change_logs').insert({ match_id: matchId, action, changed_by: changedBy, before_data: before, after_data: after });
    if (logError) throw logError;
    return json({ ok: true, game_id: matchId, results: calculated });
  } catch (error) {
    console.error(error);
    return json({ ok: false, error: error instanceof Error ? error.message : '対局を保存できませんでした。' }, 400);
  }
});

async function resolveMatchId(admin: ReturnType<typeof createClient>, value: string) {
  const byId = await admin.from('matches').select('id').eq('id', value).maybeSingle();
  if (byId.data?.id) return byId.data.id;
  const byLegacyId = await admin.from('matches').select('id').eq('legacy_game_id', value).single();
  if (byLegacyId.error || !byLegacyId.data?.id) throw new Error('対象の対局が見つかりません。');
  return byLegacyId.data.id;
}

async function appendPhotos(admin: ReturnType<typeof createClient>, matchId: string, photos: unknown) {
  if (!Array.isArray(photos)) return;
  for (const photo of photos) {
    const data = String((photo as any)?.data || '');
    const match = data.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
    if (!match) continue;
    const bytes = Uint8Array.from(atob(match[2]), char => char.charCodeAt(0));
    const storagePath = `${matchId}/${crypto.randomUUID()}.jpg`;
    const uploaded = await admin.storage.from('match-photos').upload(storagePath, bytes, { contentType: match[1], upsert: false });
    if (uploaded.error) throw uploaded.error;
    const saved = await admin.from('match_photos').insert({ match_id: matchId, storage_path: storagePath, original_name: String((photo as any)?.name || 'photo.jpg') });
    if (saved.error) throw saved.error;
  }
}

async function syncPhotos(admin: ReturnType<typeof createClient>, matchId: string, keepPhotoFileIds: unknown) {
  if (!Array.isArray(keepPhotoFileIds)) return;
  const keepIds = new Set(keepPhotoFileIds.map(value => String(value)).filter(Boolean));
  const existing = await admin.from('match_photos').select('id,storage_path').eq('match_id', matchId);
  if (existing.error) throw existing.error;
  const removed = (existing.data || []).filter(photo => !keepIds.has(String(photo.id)));
  if (!removed.length) return;
  const paths = removed.map(photo => String(photo.storage_path || '')).filter(Boolean);
  if (paths.length) {
    const deleted = await admin.storage.from('match-photos').remove(paths);
    if (deleted.error) throw deleted.error;
  }
  const deletedRows = await admin.from('match_photos').delete().in('id', removed.map(photo => photo.id));
  if (deletedRows.error) throw deletedRows.error;
}
