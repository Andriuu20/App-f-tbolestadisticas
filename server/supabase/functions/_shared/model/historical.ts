// Porcentajes históricos: en cuántos de los últimos partidos de un equipo se cumplió un mercado.
import type { PastMatch } from './strength.ts';

export type Venue = 'all' | 'home' | 'away';

export interface HistoricalRates {
  matches: number;
  over: Record<string, number>; // % de partidos con más de X goles
  btts: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number; // media
  goalsAgainst: number; // media
  /** Forma: últimos resultados del más reciente al más antiguo. */
  form: ('V' | 'E' | 'D')[];
}

export function historicalRates(
  matches: PastMatch[],
  teamId: number,
  before: string | Date,
  opts: { last?: number; venue?: Venue } = {},
): HistoricalRates {
  const last = opts.last ?? 10;
  const venue = opts.venue ?? 'all';
  const t = new Date(before).getTime();
  const mine = matches
    .filter((x) => new Date(x.date).getTime() < t)
    .filter((x) => (venue !== 'away' && x.homeId === teamId) || (venue !== 'home' && x.awayId === teamId))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, last);

  const n = mine.length;
  const rate = (f: (x: PastMatch) => boolean) => (n ? mine.filter(f).length / n : 0);
  const gf = (x: PastMatch) => (x.homeId === teamId ? x.homeGoals : x.awayGoals);
  const ga = (x: PastMatch) => (x.homeId === teamId ? x.awayGoals : x.homeGoals);
  const over: Record<string, number> = {};
  for (const l of [0.5, 1.5, 2.5, 3.5, 4.5]) over[l] = rate((x) => x.homeGoals + x.awayGoals > l);

  return {
    matches: n,
    over,
    btts: rate((x) => x.homeGoals > 0 && x.awayGoals > 0),
    wins: rate((x) => gf(x) > ga(x)),
    draws: rate((x) => gf(x) === ga(x)),
    losses: rate((x) => gf(x) < ga(x)),
    goalsFor: n ? mine.reduce((s, x) => s + gf(x), 0) / n : 0,
    goalsAgainst: n ? mine.reduce((s, x) => s + ga(x), 0) / n : 0,
    form: mine.slice(0, 5).map((x) => (gf(x) > ga(x) ? 'V' : gf(x) === ga(x) ? 'E' : 'D')),
  };
}
