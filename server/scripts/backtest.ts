// Backtest: predice cada partido pasado usando solo los anteriores y lo compara con la realidad y con Bet365.
// Uso: node scripts/backtest.ts <carpeta con CSV de football-data.co.uk>
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fairProbabilities, predictGoals, type PredictOptions } from '../supabase/functions/_shared/model/index.ts';
import { readFootballData, type FdMatch } from './footballData.ts';

const dir = process.argv[2];
const all = readFootballData(readdirSync(dir).filter((f) => f.endsWith('.csv')).map((f) => join(dir, f)));
const leagues = [...new Set(all.map((m) => m.league))];
const seasonOf = (m: FdMatch) => {
  const d = new Date(m.date);
  return d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1; // temporada = año de inicio
};

interface Pred { m: FdMatch; p: ReturnType<typeof predictGoals> }

function predictAll(opts: PredictOptions, from: number, to: number): Pred[] {
  const out: Pred[] = [];
  for (const lg of leagues) {
    const ms = all.filter((m) => m.league === lg);
    for (const m of ms) {
      const s = seasonOf(m);
      if (s < from || s > to) continue;
      out.push({ m, p: predictGoals(ms, m.homeId, m.awayId, m.date, opts) });
    }
  }
  return out;
}

const result = (m: FdMatch) => (m.homeGoals > m.awayGoals ? 0 : m.homeGoals === m.awayGoals ? 1 : 2);
const over25 = (m: FdMatch) => m.homeGoals + m.awayGoals > 2.5;
const btts = (m: FdMatch) => m.homeGoals > 0 && m.awayGoals > 0;
const ll = (p: number) => -Math.log(Math.max(p, 1e-9));

/** Pérdida logarítmica (más baja = mejor) del 1X2 y de más de 2,5. */
function score(preds: Pred[]) {
  let l1x2 = 0, lou = 0, n = 0;
  for (const { m, p } of preds) {
    l1x2 += ll([p.home, p.draw, p.away][result(m)]);
    lou += ll(over25(m) ? p.over[2.5] : 1 - p.over[2.5]);
    n++;
  }
  return { l1x2: l1x2 / n, lou: lou / n, n };
}

// 1) Elegir ajustes con 2021-22 y 2022-23 (los datos desde 2019 sirven de historial).
const grid: PredictOptions[] = [];
for (const halfLifeDays of [90, 180, 365]) for (const priorMatches of [2, 4, 8]) for (const rho of [0, -0.08])
  grid.push({ halfLifeDays, priorMatches, rho });
let best = grid[0], bestScore = Infinity;
console.log('== Ajuste (temporadas 2021-22 y 2022-23) ==');
for (const g of grid) {
  const s = score(predictAll(g, 2021, 2022));
  const total = s.l1x2 + s.lou;
  console.log(`  semivida ${g.halfLifeDays} d, prior ${g.priorMatches}, rho ${g.rho}: 1X2 ${s.l1x2.toFixed(4)}  +2,5 ${s.lou.toFixed(4)}`);
  if (total < bestScore) { bestScore = total; best = g; }
}
console.log('  Elegido:', best);

// 2) Evaluar en 2023-24 a 2026-27 (datos que el ajuste no ha visto).
const test = predictAll(best, 2023, 2026);
const s = score(test);
console.log(`\n== Prueba (2023-24 a 2026-27): ${s.n} partidos ==`);

// Comparación con Bet365 (sin margen): ¿quién acierta mejor las probabilidades?
let bookL = 0, bookCloseL = 0, bookOuL = 0, nb = 0, nbc = 0, nbo = 0;
for (const { m } of test) {
  const o = m.odds;
  if (o.home && o.draw && o.away) { bookL += ll(fairProbabilities([o.home, o.draw, o.away]).probs[result(m)]); nb++; }
  if (o.homeClose && o.drawClose && o.awayClose) {
    bookCloseL += ll(fairProbabilities([o.homeClose, o.drawClose, o.awayClose]).probs[result(m)]); nbc++;
  }
  if (o.over25 && o.under25) {
    const [po] = fairProbabilities([o.over25, o.under25]).probs;
    bookOuL += ll(over25(m) ? po : 1 - po); nbo++;
  }
}
console.log('Pérdida logarítmica (más baja = mejor; adivinar al azar 1X2 = 1,0986):');
console.log(`  1X2:  modelo ${s.l1x2.toFixed(4)} | Bet365 ${(bookL / nb).toFixed(4)} | Bet365 cierre ${(bookCloseL / nbc).toFixed(4)}`);
console.log(`  +2,5: modelo ${s.lou.toFixed(4)} | Bet365 ${(bookOuL / nbo).toFixed(4)}  (azar = 0,6931)`);

// Calibración: cuando el modelo dice X %, ¿pasa X % de las veces?
function calibration(name: string, items: { p: number; hit: boolean }[]) {
  console.log(`\nCalibración — ${name}`);
  console.log('  modelo dice   partidos   pasó de verdad');
  for (let lo = 0; lo < 1; lo += 0.1) {
    const b = items.filter((x) => x.p >= lo && x.p < lo + 0.1);
    if (b.length < 20) continue;
    const real = b.filter((x) => x.hit).length / b.length;
    const avg = b.reduce((t, x) => t + x.p, 0) / b.length;
    console.log(`  ${(avg * 100).toFixed(0).padStart(5)} %     ${String(b.length).padStart(6)}      ${(real * 100).toFixed(1).padStart(5)} %`);
  }
}
calibration('gana el local', test.map(({ m, p }) => ({ p: p.home, hit: result(m) === 0 })));
calibration('más de 2,5 goles', test.map(({ m, p }) => ({ p: p.over[2.5], hit: over25(m) })));
calibration('ambos marcan', test.map(({ m, p }) => ({ p: p.btts, hit: btts(m) })));

// Simulación de apuestas de 1 € con las cuotas de Bet365.
interface Bet { p: number; odd: number; hit: boolean }
const bets: Bet[] = [];
for (const { m, p } of test) {
  const o = m.odds, r = result(m);
  if (o.home) bets.push({ p: p.home, odd: o.home, hit: r === 0 });
  if (o.draw) bets.push({ p: p.draw, odd: o.draw, hit: r === 1 });
  if (o.away) bets.push({ p: p.away, odd: o.away, hit: r === 2 });
  if (o.over25) bets.push({ p: p.over[2.5], odd: o.over25, hit: over25(m) });
  if (o.under25) bets.push({ p: 1 - p.over[2.5], odd: o.under25, hit: !over25(m) });
}
function sim(name: string, f: (b: Bet) => boolean) {
  const sel = bets.filter(f);
  if (!sel.length) return console.log(`  ${name}: ninguna`);
  const won = sel.filter((b) => b.hit);
  const profit = won.reduce((t, b) => t + b.odd, 0) - sel.length;
  const avgP = sel.reduce((t, b) => t + b.p, 0) / sel.length;
  const avgOdd = sel.reduce((t, b) => t + b.odd, 0) / sel.length;
  console.log(`  ${name}: ${sel.length} apuestas, cuota media ${avgOdd.toFixed(2)}, ` +
    `modelo esperaba ${(avgP * 100).toFixed(1)} %, acertó ${(won.length / sel.length * 100).toFixed(1)} %, ` +
    `beneficio ${profit >= 0 ? '+' : ''}${profit.toFixed(1)} € (${(profit / sel.length * 100).toFixed(1)} %)`);
}
console.log('\nSimulación: 1 € por apuesta con cuotas de Bet365 (1X2 y más/menos 2,5)');
sim('Todas (referencia)', () => true);
sim('Con valor > 5 %', (b) => b.p * b.odd - 1 > 0.05);
sim('Con valor > 10 %', (b) => b.p * b.odd - 1 > 0.1);
sim('"Segura": cuota 1,30-1,60 con valor > 0 %', (b) => b.odd >= 1.3 && b.odd <= 1.6 && b.p * b.odd > 1);
sim('"Segura": cuota 1,30-1,60 con valor > 5 %', (b) => b.odd >= 1.3 && b.odd <= 1.6 && b.p * b.odd - 1 > 0.05);
sim('"Media": cuota 1,80-2,50 con valor > 5 %', (b) => b.odd >= 1.8 && b.odd <= 2.5 && b.p * b.odd - 1 > 0.05);
sim('"Arriesgada": cuota 4-10 con valor > 5 %', (b) => b.odd >= 4 && b.odd <= 10 && b.p * b.odd - 1 > 0.05);
