(function (global) {
  'use strict';
  const CONFIG = {
    // Google Apps ScriptをウェブアプリとしてデプロイしたURLを設定します。
    GAS_URL: 'https://script.google.com/macros/s/AKfycbycroeNJuDlI-RFGmHkmlU7Hip3RhEgk_30NaBbe452MlFQLZ0roofkt3ml9LFMx1Ci/exec',
    URL: location.hostname.endsWith('.workers.dev') ? '/api' : 'https://script.google.com/macros/s/AKfycbycroeNJuDlI-RFGmHkmlU7Hip3RhEgk_30NaBbe452MlFQLZ0roofkt3ml9LFMx1Ci/exec',
    TIMEOUT_MS: 10000,
  };
  function normalizeMember(member) {
    return { player_id: String(member.player_id || '').trim(), display_name: String(member.display_name || member.player_name || member.player_id || '').trim(), active: member.active !== false, color: member.color || '', icon: member.icon || '' };
  }
  function normalizeResult(result) {
    return { game_id: String(result.game_id || '').trim(), date: result.date || '', game_type: result.game_type === 'tonpu' || result.game_type === '東風' ? 'tonpu' : 'hanchan', player_id: String(result.player_id || '').trim(), player_name: String(result.player_name || '').trim(), score: Number(result.score) || 0, rank: Number(result.rank) || 0, seat_order: Number(result.seat_order) || 0, yakitori: result.yakitori === true || String(result.yakitori).toLowerCase() === 'true', chips: Number(result.chips) || 0, point: Number(result.point) || 0, yakuman: result.yakuman === true || String(result.yakuman).toLowerCase() === 'true', comment: String(result.comment || '').trim(), breakdown: result.breakdown && typeof result.breakdown === 'object' ? result.breakdown : {}, photo_urls: Array.isArray(result.photo_urls) ? result.photo_urls : [], photo_file_ids: Array.isArray(result.photo_file_ids) ? result.photo_file_ids : [] };
  }
  async function fetchData(url = CONFIG.URL) {
    if (!url) throw new Error('API URL is not configured.');
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);
    try {
      const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error(`API request failed: ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload.members) || !Array.isArray(payload.results)) throw new Error('API response format is invalid.');
      return { updatedAt: payload.updatedAt || '', warnings: Array.isArray(payload.warnings) ? payload.warnings : [], settings: payload.settings || null, members: payload.members.map(normalizeMember), results: payload.results.map(normalizeResult), schedule: Array.isArray(payload.schedule) ? payload.schedule : [] };
    } finally { clearTimeout(timer); }
  }
  async function loadData(fallback) { return CONFIG.URL ? fetchData() : fallback; }
  async function postResult(payload) {
    if (!CONFIG.URL) throw new Error('API URL is not configured.');
    const response = await fetch(CONFIG.URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error(`API request failed: ${response.status}`);
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || '対局を登録できませんでした。');
    return result;
  }
  global.DLeagueApi = { CONFIG, fetchData, loadData, postResult };
}(window));
