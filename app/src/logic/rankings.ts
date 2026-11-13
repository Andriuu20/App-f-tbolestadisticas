// Rankings de equipos de una liga en la temporada actual. Sin nada de diseño.

export interface PlayedMatch {
  homeId: number; homeName: string; awayId: number; awayName: string;
  homeGoals: number; awayGoals: number;
  homeCorners: number | null; awayCorners: number | null;
  homeYellows: number | null; awayYellows: number | null;
}

export type RankingMarket = 'over25' | 'btts' | 'goalsFor' | 'goalsAgainst' | 'corners' | 'cornersFor' | 'cards';

export const RANKING_MARKETS: { key: RankingMarket; label: string; percent: boolean; help: string }[] = [
  { key: 'over25', label: 'Más de 2,5', percent: true, help: '% de sus partidos con más de 2,5 goles' },
  { key: 'btts', label: 'Ambos marcan', percent: true, help: '% de sus partidos en que marcaron los dos' },
  { key: 'goalsFor', label: 'Goles a favor', percent: false, help: 'Goles que marca por partido' },
  { key: 'goalsAgainst', label: 'Goles en contra', percent: false, help: 'Goles que encaja por partido' },
  { key: 'corners', label: 'Córners', percent: false, help: 'Córners totales (los dos equipos) por partido' },
  { key: 'cornersFor', label: 'Córners a favor', percent: false, help: 'Córners que saca por partido' },
  { key: 'cards', label: 'Tarjetas', percent: false, help: 'Amarillas totales (los dos equipos) por partido' },
];

export interface TeamRow { teamId: number; name: string; played: number; value: number }

export function rankTeams(matches: PlayedMatch[], market: RankingMarket): TeamRow[] {
  const teams = new Map<number, { name: string; vals: number[] }>();
  const push = (id: number, name: string, v: number | null) => {
    if (v === null || Number.isNaN(v)) return;
    const t = teams.get(id) ?? { name, vals: [] };
    t.vals.push(v);
    teams.set(id, t);
  };
  for (const m of matches) {
    for (const side of ['home', 'away'] as const) {
      const id = side === 'home' ? m.homeId : m.awayId;
      const name = side === 'home' ? m.homeName : m.awayName;
      const gf = side === 'home' ? m.homeGoals : m.awayGoals;
      const ga = side === 'home' ? m.awayGoals : m.homeGoals;
      const cf = side === 'home' ? m.homeCorners : m.awayCorners;
      const sum = (a: number | null, b: number | null) => (a === null || b === null ? null : a + b);
      const v = market === 'over25' ? Number(m.homeGoals + m.awayGoals > 2.5)
        : market === 'btts' ? Number(m.homeGoals > 0 && m.awayGoals > 0)
        : market === 'goalsFor' ? gf
        : market === 'goalsAgainst' ? ga
        : market === 'corners' ? sum(m.homeCorners, m.awayCorners)
        : market === 'cornersFor' ? cf
        : sum(m.homeYellows, m.awayYellows);
      push(id, name, v);
    }
  }
  return [...teams.entries()]
    .map(([teamId, t]) => ({ teamId, name: t.name, played: t.vals.length, value: t.vals.reduce((s, x) => s + x, 0) / t.vals.length }))
    .filter((t) => t.played > 0)
    .sort((a, b) => b.value - a.value || b.played - a.played || a.name.localeCompare(b.name));
}

/** Inicio de la temporada actual (1 de julio). */
export function seasonStart(now = new Date()): Date {
  const y = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(Date.UTC(y, 6, 1));
}
