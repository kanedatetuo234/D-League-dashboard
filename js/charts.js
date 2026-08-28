(function (global) {
  'use strict';
  const instances = {};
  const colors = ['#ff4f91', '#6587e8', '#43bf91', '#e2b348'];
  function makeChart(id, config) {
    const canvas = document.getElementById(id);
    if (!canvas || typeof global.Chart === 'undefined') return null;
    if (instances[id]) instances[id].destroy();
    instances[id] = new global.Chart(canvas, config);
    return instances[id];
  }
  function renderPointHistory(records, members = [], period = 'year') {
    const memberMap = new Map(members.map(member => [member.player_id, member]));
    const games = new Map();
    records.forEach((record, index) => {
      const key = record.game_id || `${record.date}-${index}`;
      if (!games.has(key)) games.set(key, { date: record.date, index, rows: [] });
      games.get(key).rows.push(record);
    });
    const orderedGames = [...games.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.index - b.index);
    const buckets = period === 'year' ? [...new Map(orderedGames.map(game => [String(game.date).slice(0, 7), game])).keys()] : orderedGames.map((_, index) => String(index));
    const labels = period === 'year' ? buckets.map(value => value.slice(5).replace('-', '/')) : orderedGames.map(game => {
      const date = String(game.date || '').slice(5).replace('-', '/');
      return date || `対局${game.index + 1}`;
    });
    const ids = [...new Set(records.map(record => record.player_id))];
    const datasets = ids.map((id, index) => {
      const member = memberMap.get(id) || {};
      let total = 0;
      const data = period === 'year' ? buckets.map(bucket => {
        orderedGames.filter(game => String(game.date).slice(0, 7) === bucket).forEach(game => { const row = game.rows.find(item => item.player_id === id); if (row) total += Number(row.point) || 0; });
        return Number(total.toFixed(1));
      }) : orderedGames.map(game => {
        const row = game.rows.find(item => item.player_id === id);
        if (row) total += Number(row.point) || 0;
        return Number(total.toFixed(1));
      });
      return { label: member.display_name || records.find(record => record.player_id === id)?.player_name || id, borderColor: member.color || colors[index % colors.length], backgroundColor: member.color || colors[index % colors.length], data, tension: 0.35, pointRadius: 3, spanGaps: true };
    });
    return makeChart('point-history-chart', { type: 'line', data: { labels, datasets }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } }, tooltip: { callbacks: { label: context => ` ${context.dataset.label}: ${context.parsed.y.toFixed(1)}pt` } } }, scales: { x: { grid: { display: false } }, y: { title: { display: true, text: '累計ポイント' }, grid: { color: '#e5e8f0' } } } } });
  }
  function renderDistribution(player) {
    const values = player?.rank || [0, 0, 0, 0];
    return makeChart('rank-distribution-chart', { type: 'doughnut', data: { labels: ['1着', '2着', '3着', '4着'], datasets: [{ data: values, backgroundColor: colors, borderWidth: 3, borderColor: '#f7f8fc' }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => ` ${context.label}: ${context.raw}回` } } } } });
  }
  function renderPersonal(player, records) {
    const playerRecords = records.filter(record => record.player_id === player.id).slice(-10); let total = 0;
    const points = playerRecords.map(record => { total += Number(record.point) || 0; return Number(total.toFixed(1)); });
    let rankTotal = 0;
    const averageRanks = playerRecords.map(record => Number(((rankTotal += Number(record.rank) || 0) / (playerRecords.indexOf(record) + 1)).toFixed(2)));
    return makeChart('personal-chart', { type: 'line', data: { labels: playerRecords.map(record => record.date.slice(5).replace('-', '/')), datasets: [{ label: '累計ポイント', data: points, borderColor: colors[0], backgroundColor: colors[0], yAxisID: 'points', tension: 0.35 }, { label: '平均順位', data: averageRanks, borderColor: '#6587e8', backgroundColor: '#6587e8', yAxisID: 'rank', tension: 0.35 }] }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } } }, scales: { points: { position: 'left', title: { display: true, text: '累計pt' }, grid: { color: '#e5e8f0' } }, rank: { position: 'right', reverse: true, min: 1, max: 4, title: { display: true, text: '平均順位' }, grid: { drawOnChartArea: false } } } } });
  }
  global.DLeagueCharts = { renderPointHistory, renderDistribution, renderPersonal };
}(window));
