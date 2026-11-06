// ¿Cuánto acertaron y cuánto habrían ganado las 3 apuestas recomendadas en partidos pasados?
// Uso: node scripts/backtest-recomendaciones.ts <carpeta con CSV de football-data.co.uk>
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { recommend, settle, type OddRow, type Tier } from '../supabase/functions/_shared/recommend.ts';
import { readFootballData } from './footballData.ts';

const dir = process.argv[2];
const all = readFootballData(readdirSync(dir).filter((f) => /^[A-Z0-9]+_\d{4}\.csv$/.test(f)).map((f) => join(dir, f)));
const stats: Record<Tier, { n: number; won: number; profit: number; prob: number; odd: number }> = {
  segura: { n: 0, won: 0, profit: 0, prob: 0, odd: 0 },
  media: { n: 0, won: 0, profit: 0, prob: 0, odd: 0 },
  arriesgada: { n: 0, won: 0, profit: 0, prob: 0, odd: 0 },
};
let matches = 0;
for (const m of all) {
  const o = m.odds;
  if (!o.home || !o.draw || !o.away || !o.over25 || !o.under25) continue;
  matches++;
  const odds: OddRow[] = [
    ['Match Winner', 'Home', o.home], ['Match Winner', 'Draw', o.draw], ['Match Winner', 'Away', o.away],
    ['Goals Over/Under', 'Over 2.5', o.over25], ['Goals Over/Under', 'Under 2.5', o.under25],
  ].map(([market, selection, odd]) => ({ bookmaker: 'Bet365', market: market as string, selection: selection as string, odd: odd as number }));
  // Para elegir solo cuentan las cuotas; el modelo aquí no influye.
  const recs = recommend(odds, { homeName: m.home, awayName: m.away, model: { home: 0, draw: 0, away: 0, over25: 0 } });
  for (const r of recs) {
    const won = settle(r.market, r.selection, m.homeGoals, m.awayGoals)!;
    const s = stats[r.tier];
    s.n++; s.prob += r.prob; s.odd += r.odd;
    if (won) { s.won++; s.profit += r.odd - 1; } else s.profit -= 1;
  }
}
console.log(`${matches} partidos con cuotas (2019-2026, 5 ligas). Apuesta de 1 € en cada recomendación:\n`);
for (const [tier, s] of Object.entries(stats)) {
  console.log(`${tier.toUpperCase().padEnd(11)} en ${(s.n / matches * 100).toFixed(0)} % de los partidos · ` +
    `cuota media ${(s.odd / s.n).toFixed(2)} · la casa decía ${(s.prob / s.n * 100).toFixed(1)} % · ` +
    `acertó ${(s.won / s.n * 100).toFixed(1)} % · beneficio ${(s.profit / s.n * 100).toFixed(1)} % (${s.n} apuestas)`);
}
