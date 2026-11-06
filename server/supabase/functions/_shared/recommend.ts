// Las 3 apuestas recomendadas de un partido (segura, media y arriesgada) y su comprobación.
// La probabilidad es la de Bet365 sin margen (el backtest muestra que es la más fiable);
// la del modelo se guarda al lado como segunda opinión. Ver docs/modelo.md.
import { fairProbabilities } from './model/value.ts';

export type Tier = 'segura' | 'media' | 'arriesgada';
export const TIERS: Record<Tier, { min: number; max: number }> = {
  segura: { min: 1.3, max: 1.6 },
  media: { min: 1.8, max: 2.5 },
  arriesgada: { min: 4, max: 10 },
};

export interface OddRow { bookmaker: string; market: string; selection: string; odd: number }
export interface MatchInfo {
  homeName: string;
  awayName: string;
  /** Probabilidades del modelo. */
  model: { home: number; draw: number; away: number; over25: number };
  /** Porcentajes de los últimos partidos (de predictions.home_recent / away_recent). */
  homeRecent?: { over: Record<string, number>; wins: number; home?: { wins: number; matches: number } };
  awayRecent?: { over: Record<string, number>; wins: number; away?: { wins: number; matches: number } };
}

export interface Candidate {
  market: string;
  selection: string;
  label: string;
  odd: number;
  /** Probabilidad justa según la casa (sin margen). */
  prob: number;
  modelProb: number;
  /** Lo que devuelve de media cada euro apostado según la casa (siempre < 1 por el margen). */
  fairReturn: number;
}

export interface Recommendation extends Candidate { tier: Tier; reason: string }

const pct = (p: number) => `${Math.round(p * 100)} %`;

/** Selecciones con cuota de Bet365 y su probabilidad justa. */
export function candidates(odds: OddRow[], info: MatchInfo): Candidate[] {
  const get = (market: string, selection: string) =>
    odds.find((o) => o.bookmaker === 'Bet365' && o.market === market && o.selection === selection)?.odd;
  const out: Candidate[] = [];
  const x = [get('Match Winner', 'Home'), get('Match Winner', 'Draw'), get('Match Winner', 'Away')];
  if (x.every((o) => o && o > 1)) {
    const fair = fairProbabilities(x as number[]).probs;
    const labels = [`Gana ${info.homeName}`, 'Empate', `Gana ${info.awayName}`];
    const sel = ['Home', 'Draw', 'Away'];
    const model = [info.model.home, info.model.draw, info.model.away];
    sel.forEach((s, i) => out.push({
      market: 'Match Winner', selection: s, label: labels[i], odd: x[i]!, prob: fair[i],
      modelProb: model[i], fairReturn: fair[i] * x[i]!,
    }));
  }
  const ou = [get('Goals Over/Under', 'Over 2.5'), get('Goals Over/Under', 'Under 2.5')];
  if (ou.every((o) => o && o > 1)) {
    const fair = fairProbabilities(ou as number[]).probs;
    out.push({ market: 'Goals Over/Under', selection: 'Over 2.5', label: 'Más de 2,5 goles', odd: ou[0]!,
      prob: fair[0], modelProb: info.model.over25, fairReturn: fair[0] * ou[0]! });
    out.push({ market: 'Goals Over/Under', selection: 'Under 2.5', label: 'Menos de 2,5 goles', odd: ou[1]!,
      prob: fair[1], modelProb: 1 - info.model.over25, fairReturn: fair[1] * ou[1]! });
  }
  return out;
}

/** Explicación en lenguaje sencillo, con datos del partido. */
function reason(c: Candidate, info: MatchInfo): string {
  const parts = [`La casa le da un ${pct(c.prob)} (quitando su margen) y el modelo un ${pct(c.modelProb)}.`];
  const diff = c.modelProb - c.prob;
  parts.push(Math.abs(diff) < 0.04 ? 'Los dos coinciden.'
    : diff > 0 ? 'El modelo la ve algo más probable que la casa.' : 'Ojo: el modelo la ve menos probable que la casa.');
  const h = info.homeRecent, a = info.awayRecent;
  if (c.selection === 'Home' && h?.home?.matches) {
    parts.push(`${info.homeName} ha ganado ${Math.round(h.home.wins * h.home.matches)} de sus últimos ${h.home.matches} partidos en casa.`);
  } else if (c.selection === 'Away' && a?.away?.matches) {
    parts.push(`${info.awayName} ha ganado ${Math.round(a.away.wins * a.away.matches)} de sus últimos ${a.away.matches} partidos fuera.`);
  } else if ((c.selection === 'Over 2.5' || c.selection === 'Under 2.5') && h && a) {
    const word = c.selection === 'Over 2.5' ? 'más' : 'menos';
    const hp = c.selection === 'Over 2.5' ? h.over['2.5'] : 1 - h.over['2.5'];
    const ap = c.selection === 'Over 2.5' ? a.over['2.5'] : 1 - a.over['2.5'];
    parts.push(`Hubo ${word} de 2,5 goles en el ${pct(hp)} de los últimos partidos de ${info.homeName} y en el ${pct(ap)} de los de ${info.awayName}.`);
  }
  return parts.join(' ');
}

/**
 * Elige una apuesta por nivel: dentro del rango de cuotas, la que menos margen deja a la casa
 * (más devuelve de media por euro); si empatan, la que el modelo ve más probable.
 */
export function recommend(odds: OddRow[], info: MatchInfo): Recommendation[] {
  const all = candidates(odds, info);
  const out: Recommendation[] = [];
  for (const tier of Object.keys(TIERS) as Tier[]) {
    const { min, max } = TIERS[tier];
    const best = all.filter((c) => c.odd >= min && c.odd <= max)
      .sort((x, y) => y.fairReturn - x.fairReturn || y.modelProb - x.modelProb)[0];
    if (best) out.push({ ...best, tier, reason: reason(best, info) });
  }
  return out;
}

/** ¿Se ganó la apuesta? (null si el mercado no se sabe comprobar). */
export function settle(market: string, selection: string, homeGoals: number, awayGoals: number): boolean | null {
  if (market === 'Match Winner') {
    if (selection === 'Home') return homeGoals > awayGoals;
    if (selection === 'Draw') return homeGoals === awayGoals;
    if (selection === 'Away') return homeGoals < awayGoals;
  }
  if (market === 'Goals Over/Under') {
    const m = selection.match(/^(Over|Under) (\d+(?:\.\d+)?)$/);
    if (m) return m[1] === 'Over' ? homeGoals + awayGoals > Number(m[2]) : homeGoals + awayGoals < Number(m[2]);
  }
  return null;
}
