(function (global) {
  'use strict';
  const safeNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  function calculatePlayerStats(records) {
    const stats = { games: 0, rank: [0, 0, 0, 0], points: 0, rankTotal: 0 };
    records.forEach(record => {
      const rank = Math.trunc(safeNumber(record.rank));
      if (rank >= 1 && rank <= 4) { stats.rank[rank - 1] += 1; stats.rankTotal += rank; }
      stats.games += 1; stats.points += safeNumber(record.point);
    });
    stats.avg = stats.games ? stats.rankTotal / stats.games : 0;
    stats.topRate = stats.games ? stats.rank[0] / stats.games * 100 : 0;
    stats.secondRate = stats.games ? (stats.rank[0] + stats.rank[1]) / stats.games * 100 : 0;
    stats.lastRate = stats.games ? stats.rank[3] / stats.games * 100 : 0;
    return stats;
  }
  function calculateRanking(records, members = []) {
    const memberMap = new Map(members.map(member => [member.player_id, member]));
    const grouped = new Map();
    records.forEach(record => { if (!grouped.has(record.player_id)) grouped.set(record.player_id, []); grouped.get(record.player_id).push(record); });
    return [...grouped.entries()].map(([playerId, playerRecords]) => {
      const stats = calculatePlayerStats(playerRecords); const member = memberMap.get(playerId) || {};
      return { id: playerId, name: member.display_name || playerRecords[0].player_name || playerId, ...stats };
    }).sort((a, b) => b.points - a.points || a.avg - b.avg || b.topRate - a.topRate || b.games - a.games);
  }
  function filterByPeriod(records, period, referenceDate = new Date()) {
    const date = new Date(referenceDate); const year = date.getFullYear(); const month = date.getMonth();
    if (period === 'year') return records.filter(record => new Date(record.date).getFullYear() === year);
    if (period === 'month') return records.filter(record => { const d = new Date(record.date); return d.getFullYear() === year && d.getMonth() === month; });
    const monday = new Date(year, month, date.getDate() - ((date.getDay() + 6) % 7)); monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 7);
    return records.filter(record => { const d = new Date(record.date); return d >= monday && d < sunday; });
  }
  function calculateHeadToHead(records, members = []) {
    const ids = members.filter(member => member.active !== false).map(member => member.player_id);
    const matrix = Object.fromEntries(ids.map(id => [id, Object.fromEntries(ids.map(opponent => [opponent, { games: 0, wins: 0, losses: 0, draws: 0 }]))]));
    const games = new Map(); records.forEach(record => { if (!games.has(record.game_id)) games.set(record.game_id, []); games.get(record.game_id).push(record); });
    games.forEach(players => players.forEach(player => players.forEach(opponent => {
      if (player.player_id === opponent.player_id || !matrix[player.player_id]?.[opponent.player_id]) return;
      const result = matrix[player.player_id][opponent.player_id]; result.games += 1;
      const playerRank = safeNumber(player.rank); const opponentRank = safeNumber(opponent.rank);
      if (playerRank < opponentRank) result.wins += 1; else if (playerRank > opponentRank) result.losses += 1; else result.draws += 1;
    })));
    return matrix;
  }
  global.DLeagueStats = { safeNumber, filterByPeriod, calculatePlayerStats, calculateRanking, calculateHeadToHead };
}(window));
