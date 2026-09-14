export const DEFAULT_RULES = {
  uma: { enabled: true, first: 10, second: 6, third: 3, fourth: 0 },
  oka: { enabled: true, points: 20 },
  yakitori: { enabled: true, points: -20 },
  tobiBonus: { enabled: false, points: 10 },
  topBonus: { enabled: false, points: 10 },
  lastPenalty: { enabled: false, points: -10 },
  tobiPenalty: { enabled: false, points: -10 },
  chip: { enabled: false, pointsPerChip: 1 },
  returnPoints: { points: 30000 },
  boxBelow: { enabled: true },
  tie: { enabled: true, method: 'split' },
};

const round1 = (value: number) => Math.round(value * 10) / 10;
const numberOr = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function mergeRules(rules: Record<string, any> = {}) {
  return Object.fromEntries(Object.entries(DEFAULT_RULES).map(([key, defaultValue]) => [
    key,
    { ...(defaultValue as Record<string, any>), ...(rules[key] || {}) },
  ]));
}

function distributeTenths(value: number, players: any[]) {
  const totalTenths = Math.round(value * 10);
  const baseTenths = Math.floor(totalTenths / players.length);
  const remainder = totalTenths - baseTenths * players.length;
  const allocations = new Map<any, number>();
  players.slice().sort((a, b) => String(a.seat).localeCompare(String(b.seat), 'ja')).forEach((player, index) => {
    allocations.set(player, (baseTenths + (index < remainder ? 1 : 0)) / 10);
  });
  return players.map(player => allocations.get(player) || 0);
}

export function calculatePoints(players: any[], inputRules: Record<string, any> = {}) {
  const rules = mergeRules(inputRules);
  const tiedGroups = new Map<string, any[]>();
  players.forEach(player => {
    const key = String(player.score);
    if (!tiedGroups.has(key)) tiedGroups.set(key, []);
    tiedGroups.get(key)!.push(player);
  });
  for (const tied of tiedGroups.values()) {
    const rank = 1 + players.filter(player => Number(player.score) > Number(tied[0].score)).length;
    const rankBonus: Record<number, number> = rules.uma.enabled
      ? { 1: numberOr(rules.uma.first), 2: numberOr(rules.uma.second), 3: numberOr(rules.uma.third), 4: numberOr(rules.uma.fourth) }
      : { 1: 0, 2: 0, 3: 0, 4: 0 };
    const occupiedBonus = tied.reduce((sum, _player, index) => sum + (rankBonus[rank + index] || 0), 0);
    const bonusParts = distributeTenths(occupiedBonus / tied.length, tied);
    tied.forEach((player, index) => {
      const score = numberOr(player.score);
      const base = ((rules.boxBelow.enabled ? score : Math.max(0, score)) - numberOr(rules.returnPoints.points, 30000)) / 1000;
      const isTop = Number(player.rank) === 1;
      const isLast = Number(player.rank) === 4;
      const isTobi = score < 0;
      const breakdown = {
        base: round1(base),
        uma: round1(bonusParts[index]),
        oka: round1(rules.oka.enabled && isTop ? numberOr(rules.oka.points) : 0),
        yakitori: round1(rules.yakitori.enabled && player.yakitori ? numberOr(rules.yakitori.points) : 0),
        tobiBonus: round1(rules.tobiBonus.enabled && isTop && players.some(other => numberOr(other.score) < 0) ? numberOr(rules.tobiBonus.points) : 0),
        topBonus: round1(rules.topBonus.enabled && isTop ? numberOr(rules.topBonus.points) : 0),
        lastPenalty: round1(rules.lastPenalty.enabled && isLast ? numberOr(rules.lastPenalty.points) : 0),
        tobiPenalty: round1(rules.tobiPenalty.enabled && isTobi ? numberOr(rules.tobiPenalty.points) : 0),
        chip: round1(rules.chip.enabled ? numberOr(player.chips) * numberOr(rules.chip.pointsPerChip) : 0),
      };
      player.point_breakdown = breakdown;
      player.point = round1(Object.values(breakdown).reduce((sum, value) => sum + Number(value), 0));
    });
  }
  return players;
}

export function validatePlayers(players: any[]) {
  if (!Array.isArray(players) || players.length !== 4) throw new Error('対局参加者は4人必要です。');
  if (new Set(players.map(player => String(player.player_id))).size !== 4) throw new Error('同じプレイヤーを重複登録できません。');
  if (new Set(players.map(player => Number(player.rank))).size !== 4 || players.some(player => ![1, 2, 3, 4].includes(Number(player.rank)))) throw new Error('順位は1位から4位までを重複なく指定してください。');
  if (new Set(players.map(player => String(player.seat))).size !== 4 || players.some(player => !['東', '南', '西', '北'].includes(String(player.seat)))) throw new Error('席は東・南・西・北を重複なく指定してください。');
  if (players.some(player => !Number.isFinite(Number(player.score)))) throw new Error('持ち点は数値で入力してください。');
  const totalScore = players.reduce((sum, player) => sum + Number(player.score), 0);
  if (totalScore !== 100000) throw new Error(`持ち点の合計は100000点にしてください（現在${totalScore.toLocaleString()}点）。`);
}
