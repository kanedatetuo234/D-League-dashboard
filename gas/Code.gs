/**
 * D-League 戦績表 Google Apps Script API
 *
 * 必須シート:
 * - results: game_id, date, player_id, player_name, score, rank, seat_order, yakitori, point
 * - members: player_id, display_name, active, color, icon
 */
const CONFIG = {
  RESULTS_SHEET: 'results',
  MEMBERS_SHEET: 'members',
  TIME_ZONE: 'Asia/Tokyo',
  RANK_BONUS: { 1: 10, 2: 6, 3: 3, 4: 0 },
  OMA: 20,
  YAKITORI_PENALTY: 20,
};

function doGet() {
  try {
    const payload = buildPayload_();
    return jsonResponse_(payload);
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return jsonResponse_({
      updatedAt: new Date().toISOString(),
      members: [],
      results: [],
      warnings: [],
      error: '戦績データを取得できませんでした。',
    });
  }
}

function doPost(e) {
  try {
    const input = JSON.parse(e.postData.contents || '{}');
    if (input.action === 'addMember') return addMember_(input);
    if (input.action === 'saveSchedule') return saveSchedule_(input);
    if (input.action === 'updateMember') return updateMember_(input);
    if (input.action === 'updateGame') return updateGame_(input);
    const rows = createResultRows_(input);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.RESULTS_SHEET);
    if (!sheet) throw new Error(`Sheet not found: ${CONFIG.RESULTS_SHEET}`);
    ensureResultHeaders_(sheet);
    const photos = uploadPhotos_(input.photos || []);
    rows.forEach(row => sheet.appendRow([row.game_id, row.date, row.player_id, row.player_name, row.score, row.rank, row.seat_order, row.yakitori, row.point, row.yakuman, row.comment, JSON.stringify(photos.urls), JSON.stringify(photos.fileIds)]));
    return jsonResponse_({ ok: true, game_id: rows[0].game_id, results: rows });
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return jsonResponse_({ ok: false, error: error.message || '対局を登録できませんでした。' });
  }
}

function addMember_(input) {
  const name = String(input.display_name || '').trim();
  if (!name) throw new Error('表示名を入力してください。');
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(CONFIG.MEMBERS_SHEET);
  if (!sheet) throw new Error(`Sheet not found: ${CONFIG.MEMBERS_SHEET}`);
  const members = readSheet_(spreadsheet, CONFIG.MEMBERS_SHEET);
  if (members.some(member => String(member.display_name || '').trim() === name)) throw new Error('同じ表示名のメンバーが既に存在します。');
  const id = `P${String(new Date().getTime()).slice(-6)}`;
  sheet.appendRow([id, name, true, String(input.color || '').trim(), String(input.icon || '').trim()]);
  return jsonResponse_({ ok: true, member: { player_id: id, display_name: name, active: true } });
}

function updateMember_(input) {
  const id = String(input.player_id || '').trim();
  const name = String(input.display_name || '').trim();
  if (!id || !name) throw new Error('メンバーIDと表示名を確認してください。');
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(CONFIG.MEMBERS_SHEET);
  if (!sheet) throw new Error(`Sheet not found: ${CONFIG.MEMBERS_SHEET}`);
  const values = sheet.getDataRange().getValues();
  const rowIndex = values.slice(1).findIndex(row => String(row[0]).trim() === id);
  if (rowIndex < 0) throw new Error('対象メンバーが見つかりません。');
  if (values.slice(1).some((row, index) => index !== rowIndex && String(row[1]).trim() === name)) throw new Error('同じ表示名のメンバーが既に存在します。');
  const rowNumber = rowIndex + 2;
  sheet.getRange(rowNumber, 2, 1, 4).setValues([[name, parseBoolean_(input.active), String(input.color || '').trim(), String(input.icon || '').trim()]]);
  return jsonResponse_({ ok: true, member: { player_id: id, display_name: name, active: parseBoolean_(input.active), color: String(input.color || '').trim(), icon: String(input.icon || '').trim() } });
}

function createResultRows_(input) {
  if (!input || !Array.isArray(input.players) || input.players.length !== 4) throw new Error('4人分のプレイヤー情報を入力してください。');
  const players = input.players.map(player => ({
    player_id: String(player.player_id || '').trim(),
    player_name: String(player.player_name || '').trim(),
    score: toNumber_(player.score),
    seat_order: toNumber_(player.seat_order),
    yakitori: parseBoolean_(player.yakitori),
    yakuman: parseBoolean_(input.yakuman),
    comment: String(input.comment || '').trim(),
  }));
  if (players.some(player => !player.player_id || !isFinite(player.score))) throw new Error('プレイヤー、持ち点を確認してください。');
  if (new Set(players.map(player => player.player_id)).size !== 4) throw new Error('プレイヤーは4人とも別々にしてください。');
  if (new Set(players.map(player => player.seat_order)).size !== 4 || players.some(player => player.seat_order < 1 || player.seat_order > 4)) throw new Error('座順は1〜4を重複なく入力してください。');
  const sortedScores = players.map(player => player.score).sort((a, b) => b - a);
  players.forEach(player => { player.rank = 1 + sortedScores.filter(score => score > player.score).length; });
  const date = input.date ? formatDate_(input.date) : Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, 'yyyy-MM-dd');
  const gameId = String(input.game_id || '').trim() || `G${Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, 'yyyyMMddHHmmss')}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  players.forEach(player => { player.game_id = gameId; player.date = date; });
  calculatePoints_(players);
  return players;
}

function updateGame_(input) {
  const gameId = String(input.game_id || '').trim();
  if (!gameId) throw new Error('修正対象の対局IDがありません。');
  const rows = createResultRows_(input);
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(CONFIG.RESULTS_SHEET);
  if (!sheet) throw new Error(`Sheet not found: ${CONFIG.RESULTS_SHEET}`);
  const values = sheet.getDataRange().getValues();
  const targetRows = [];
  values.slice(1).forEach((row, index) => { if (String(row[0]).trim() === gameId) targetRows.push(index + 2); });
  if (targetRows.length !== 4) throw new Error('修正対象の対局データが4人分見つかりません。');
  ensureResultHeaders_(sheet);
  const photos = uploadPhotos_(input.photos || []);
  const oldUrls = parseJsonArray_(values[targetRows[0] - 1][11]); const oldIds = parseJsonArray_(values[targetRows[0] - 1][12]);
  const keptIds = Array.isArray(input.keep_photo_file_ids) ? input.keep_photo_file_ids.map(String) : oldIds;
  const kept = keptIds.map(id => { const index = oldIds.indexOf(id); return index >= 0 ? { id, url: oldUrls[index] } : null; }).filter(Boolean);
  const allUrls = kept.map(photo => photo.url).concat(photos.urls); const allIds = kept.map(photo => photo.id).concat(photos.fileIds);
  targetRows.sort((a, b) => a - b).forEach((rowNumber, index) => sheet.getRange(rowNumber, 1, 1, 13).setValues([[rows[index].game_id, rows[index].date, rows[index].player_id, rows[index].player_name, rows[index].score, rows[index].rank, rows[index].seat_order, rows[index].yakitori, rows[index].point, rows[index].yakuman, rows[index].comment, JSON.stringify(allUrls), JSON.stringify(allIds)]]));
  return jsonResponse_({ ok: true, game_id: gameId, results: rows });
}

function buildPayload_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const members = readSheet_(spreadsheet, CONFIG.MEMBERS_SHEET).map(normalizeMember_);
  const rawResults = readSheet_(spreadsheet, CONFIG.RESULTS_SHEET).map(normalizeResult_);
  const validation = validateResults_(rawResults);
  const results = calculatePoints_(rawResults);
  return {
    updatedAt: Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, "yyyy-MM-dd'T'HH:mm:ssXXX"),
    members: members.filter(member => member.player_id),
    results,
    schedule: readSchedule_(),
    warnings: validation.warnings,
  };
}

function saveSchedule_(input) {
  const date = formatDate_(input.date);
  const playerId = String(input.player_id || '').trim();
  if (!date || !playerId) throw new Error('メンバーと日付を確認してください。');
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName('schedule') || spreadsheet.insertSheet('schedule');
  ensureHeaders_(sheet, ['date', 'player_id', 'status', 'comment', 'updated_at']);
  const values = sheet.getDataRange().getValues();
  const rowIndex = values.slice(1).findIndex(row => String(row[0]).trim() === date && String(row[1]).trim() === playerId);
  const status = ['可', '未定', '不可'].includes(String(input.status)) ? String(input.status) : '';
  const row = [date, playerId, status, String(input.comment || '').trim(), new Date()];
  if (rowIndex >= 0) sheet.getRange(rowIndex + 2, 1, 1, row.length).setValues([row]); else sheet.appendRow(row);
  return jsonResponse_({ ok: true, schedule: row });
}

function readSchedule_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('schedule');
  if (!sheet || sheet.getLastRow() < 2) return [];
  return readSheet_(SpreadsheetApp.getActiveSpreadsheet(), 'schedule').map(row => { const raw = String(row.status || '').trim(); const status = raw === '○' ? '可' : raw === '△' ? '未定' : raw === '×' ? '不可' : raw || (parseBoolean_(row.available) ? '可' : ''); return { date: formatDate_(row.date), player_id: String(row.player_id || '').trim(), status, available: status === '可', comment: String(row.comment || '').trim() }; });
}

function ensureHeaders_(sheet, headers) {
  const current = sheet.getLastColumn() ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(value => String(value).trim()) : [];
  headers.forEach(header => { if (!current.includes(header)) { sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header); current.push(header); } });
}

function readSheet_(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw new Error(`Sheet not found: ${sheetName}`);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(value => String(value).trim());
  return values.slice(1).filter(row => row.some(value => value !== '')).map(row => {
    return headers.reduce((record, header, index) => { record[header] = row[index]; return record; }, {});
  });
}

function normalizeMember_(row) {
  return {
    player_id: String(row.player_id || '').trim(),
    display_name: String(row.display_name || row.player_name || '').trim(),
    active: parseBoolean_(row.active),
    color: String(row.color || '').trim(),
    icon: String(row.icon || '').trim(),
  };
}

function normalizeResult_(row) {
  return {
    game_id: String(row.game_id || '').trim(),
    date: formatDate_(row.date),
    player_id: String(row.player_id || '').trim(),
    player_name: String(row.player_name || '').trim(),
    score: toNumber_(row.score),
    rank: toNumber_(row.rank),
    seat_order: toNumber_(row.seat_order),
    yakitori: parseBoolean_(row.yakitori),
    point: null,
    yakuman: parseBoolean_(row.yakuman),
    comment: String(row.comment || '').trim(),
    photo_urls: parseJsonArray_(row.photo_urls),
    photo_file_ids: parseJsonArray_(row.photo_file_ids),
  };
}

function parseJsonArray_(value) { try { const parsed = JSON.parse(String(value || '[]')); return Array.isArray(parsed) ? parsed : []; } catch (error) { return []; } }

function uploadPhotos_(photos) {
  const urls = []; const fileIds = []; if (!Array.isArray(photos) || !photos.length) return { urls, fileIds };
  const folder = getPhotoFolder_();
  photos.slice(0, 8).forEach(photo => { const match = String(photo.data || '').match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i); if (!match) return; const blob = Utilities.newBlob(Utilities.base64Decode(match[2]), match[1], String(photo.name || 'winning-tile.jpg')); const file = folder.createFile(blob); file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); urls.push(`https://drive.google.com/thumbnail?id=${file.getId()}&sz=w1000`); fileIds.push(file.getId()); });
  return { urls, fileIds };
}

function getPhotoFolder_() { const properties = PropertiesService.getScriptProperties(); const id = properties.getProperty('PHOTO_FOLDER_ID'); if (id) return DriveApp.getFolderById(id); const folder = DriveApp.createFolder('D-League 上がり牌写真'); properties.setProperty('PHOTO_FOLDER_ID', folder.getId()); return folder; }

function ensureResultHeaders_(sheet) {
  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].map(value => String(value).trim());
  ['yakuman', 'comment', 'photo_urls', 'photo_file_ids'].forEach(header => { if (!headers.includes(header)) { sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header); } });
}

function validateResults_(results) {
  const warnings = [];
  const games = {};
  results.forEach((result, index) => {
    if (!result.game_id) warnings.push(`行${index + 2}: game_idが未入力です。`);
    if (!result.player_id) warnings.push(`行${index + 2}: player_idが未入力です。`);
    if (!isFinite(result.score)) warnings.push(`行${index + 2}: scoreが数値ではありません。`);
    if (result.rank < 1 || result.rank > 4) warnings.push(`行${index + 2}: rankは1〜4で入力してください。`);
    if (result.seat_order < 1 || result.seat_order > 4) warnings.push(`行${index + 2}: seat_orderは1〜4で入力してください。`);
    if (!games[result.game_id]) games[result.game_id] = [];
    games[result.game_id].push(result);
  });
  Object.keys(games).forEach(gameId => {
    const game = games[gameId];
    if (game.length !== 4) warnings.push(`${gameId}: 4人分のデータがありません（${game.length}行）。`);
    const seats = game.map(row => row.seat_order).filter(Boolean);
    if (new Set(seats).size !== seats.length) warnings.push(`${gameId}: seat_orderが重複しています。`);
    const byScore = {};
    game.forEach(row => { const key = String(row.score); if (!byScore[key]) byScore[key] = []; byScore[key].push(row); });
    const ranks = game.map(row => row.rank).filter(Boolean);
    if (Object.keys(byScore).every(key => byScore[key].length === 1) && new Set(ranks).size !== ranks.length) warnings.push(`${gameId}: 同点でない対局のrankが重複しています。`);
    if (game.length === 4 && game.reduce((sum, row) => sum + row.score, 0) !== 100000) warnings.push(`${gameId}: 最終持ち点合計が100,000点ではありません。`);
  });
  return { warnings };
}

function calculatePoints_(results) {
  const games = {};
  results.forEach(result => { if (!games[result.game_id]) games[result.game_id] = []; games[result.game_id].push(result); });
  Object.keys(games).forEach(gameId => {
    const game = games[gameId];
    const tiedGroups = {};
    game.forEach(result => { const key = String(result.score); if (!tiedGroups[key]) tiedGroups[key] = []; tiedGroups[key].push(result); });
    Object.keys(tiedGroups).forEach(scoreKey => {
      const tied = tiedGroups[scoreKey];
      const rank = 1 + game.filter(result => result.score > Number(scoreKey)).length;
      const occupiedBonus = tied.reduce((sum, result, index) => sum + (CONFIG.RANK_BONUS[rank + index] || 0), 0);
      const bonusParts = distributeTenths_(occupiedBonus / tied.length, tied);
      tied.forEach((result, index) => {
        const base = (result.score - 30000) / 1000;
        const oma = result.rank === 1 ? CONFIG.OMA : 0;
        const yakitori = result.yakitori ? CONFIG.YAKITORI_PENALTY : 0;
        result.point = round1_(base + bonusParts[index] + oma - yakitori);
      });
    });
  });
  return results;
}

function distributeTenths_(value, players) {
  const totalTenths = Math.round(value * 10);
  const baseTenths = Math.floor(totalTenths / players.length);
  let remainder = totalTenths - baseTenths * players.length;
  const allocations = new Map();
  players.slice().sort((a, b) => a.seat_order - b.seat_order).forEach((player, index) => {
    allocations.set(player, (baseTenths + (index < remainder ? 1 : 0)) / 10);
  });
  return players.map(player => allocations.get(player));
}

function toNumber_(value) { const number = Number(value); return isNaN(number) ? NaN : number; }
function round1_(value) { return Math.round((value + Number.EPSILON) * 10) / 10; }
function parseBoolean_(value) { return value === true || String(value).trim().toLowerCase() === 'true' || String(value).trim() === '1' || String(value).trim() === 'はい'; }
function formatDate_(value) { if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) return Utilities.formatDate(value, CONFIG.TIME_ZONE, 'yyyy-MM-dd'); const date = new Date(value); return isNaN(date) ? String(value || '') : Utilities.formatDate(date, CONFIG.TIME_ZONE, 'yyyy-MM-dd'); }
function jsonResponse_(payload) { return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON); }
