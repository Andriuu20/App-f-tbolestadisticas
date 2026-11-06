// Comparar el modelo con la cuota (misma lógica que server/.../model/value.ts).

/** Probabilidades justas de un mercado completo quitando el margen de la casa. */
export function fairProbabilities(odds: number[]): { probs: number[]; margin: number } {
  const implied = odds.map((o) => 1 / o);
  const total = implied.reduce((s, p) => s + p, 0);
  return { probs: implied.map((p) => p / total), margin: total - 1 };
}

/** Beneficio esperado por euro según el modelo (0,05 = +5 %). */
export const expectedValue = (modelProb: number, odd: number) => modelProb * odd - 1;

/** Liga activa -> nombre corto para el selector. */
export const LEAGUES = [
  { id: 140, short: 'LaLiga' },
  { id: 39, short: 'Premier' },
  { id: 135, short: 'Serie A' },
  { id: 78, short: 'Bundesliga' },
  { id: 61, short: 'Ligue 1' },
];
export const leagueShort = (id: number, fallback: string) => LEAGUES.find((l) => l.id === id)?.short ?? fallback;
