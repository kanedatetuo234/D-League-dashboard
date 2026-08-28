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
  function renderPointHistory(ranking) {
    const labels = ['8/1', '8/7', '8/14', '8/21', '8/25'];
    const datasets = ranking.map((player, index) => ({ label: player.name, borderColor: colors[index], backgroundColor: colors[index], data: labels.map((_, day) => Number((player.points * (0.18 + day * 0.2 + index * 0.02)).toFixed(1))), tension: 0.35, pointRadius: 3 }));
    return makeChart('point-history-chart', { type: 'line', data: { labels, datasets }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } }, tooltip: { callbacks: { label: context => ` ${context.dataset.label}: ${context.parsed.y.toFixed(1)}pt` } } }, scales: { x: { grid: { display: false } }, y: { title: { display: true, text: '累計ポイント' }, grid: { color: '#e5e8f0' } } } } });
  }
  function renderDistribution(player) {
    const values = player?.rank || [0, 0, 0, 0];
    return makeChart('rank-distribution-chart', { type: 'doughnut', data: { labels: ['1着', '2着', '3着', '4着'], datasets: [{ data: values, backgroundColor: colors, borderWidth: 3, borderColor: '#f7f8fc' }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => ` ${context.label}: ${context.raw}回` } } } } });
  }
  function renderPersonal(player, records) {
    const playerRecords = records.filter(record => record.player_id === player.id).slice(-10); let total = 0;
    const points = playerRecords.map(record => { total += Number(record.point) || 0; return Number(total.toFixed(1)); });
    const averageRanks = playerRecords.map(() => Number((player.rankTotal / player.games).toFixed(2)));
    return makeChart('personal-chart', { type: 'line', data: { labels: playerRecords.map(record => record.date.slice(5).replace('-', '/')), datasets: [{ label: '累計ポイント', data: points, borderColor: colors[0], backgroundColor: colors[0], yAxisID: 'points', tension: 0.35 }, { label: '平均順位', data: averageRanks, borderColor: '#6587e8', backgroundColor: '#6587e8', yAxisID: 'rank', tension: 0.35 }] }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } } }, scales: { points: { position: 'left', title: { display: true, text: '累計pt' }, grid: { color: '#e5e8f0' } }, rank: { position: 'right', reverse: true, min: 1, max: 4, title: { display: true, text: '平均順位' }, grid: { drawOnChartArea: false } } } } });
  }
  global.DLeagueCharts = { renderPointHistory, renderDistribution, renderPersonal };
}(window));
