// Backtest: predice cada partido pasado usando solo los anteriores y lo compara con la realidad y con Bet365.
// Uso: node scripts/backtest.ts <carpeta con CSV de football-data.co.uk>
// Ajuste con 2021-22 y 2022-23; prueba con 2023-24 en adelante (datos que el ajuste no ha visto).
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fairProbabilities, predictGoals, type PredictOptions } from '../supabase/functions/_shared/model/index.ts';
import { readFootballData, type FdMatch } from './footballData.ts';

const dir = process.argv[2];
const all = readFootballData(readdirSync(dir).filter((f) => /^[A-Z0-9]+_\d{4}\.csv$/.test(f)).map((f) => join(dir, f)));
const leagues = [...new Set(all.map((m) => m.league))];
const seasonOf = (m: FdMatch) => {
  const d = new Date(m.date);
  return d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
};
const byLeague = new Map(leagues.map((l) => [l, all.filter((m) => m.league === l)]));

type P3 = [number, number, number];
interface Pred { m: FdMatch; x: P3; over: number; btts: number }

function predictAll(opts: PredictOptions, from: number, to: number): Pred[] {
  const out: Pred[] = [];
  for (const lg of leagues) {
    const ms = byLeague.get(lg)!;
    for (const m of ms) {
      const s = seasonOf(m);
      if (s < from || s > to) continue;
      const p = predictGoals(ms, m.homeId, m.awayId, m.date, opts);
      out.push({ m, x: [p.home, p.draw, p.away], over: p.over[2.5], btts: p.btts });
    }
  }
  return out;
}

const result = (m: FdMatch) => (m.homeGoals > m.awayGoals ? 0 : m.homeGoals === m.awayGoals ? 1 : 2);
const isOver = (m: FdMatch) => m.homeGoals + m.awayGoals > 2.5;
const ll = (p: number) => -Math.log(Math.max(p, 1e-9));
const market = (m: FdMatch): { x?: P3; over?: number } => {
  const o = m.odds;
  return {
    x: o.home && o.draw && o.away ? (fairProbabilities([o.home, o.draw, o.away]).probs as P3) : undefined,
    over: o.over25 && o.under25 ? fairProbabilities([o.over25, o.under25]).probs[0] : undefined,
  };
};
/** Mezcla: beta = peso del modelo (1 = solo modelo, 0 = solo Bet365). */
const blend = (p: Pred, beta: number): Pred => {
  const mk = market(p.m);
  return {
    ...p,
    x: mk.x ? (p.x.map((v, i) => beta * v + (1 - beta) * mk.x![i]) as P3) : p.x,
    over: mk.over !== undefined ? beta * p.over + (1 - beta) * mk.over : p.over,
  };
};

/** Pérdida logarítmica media (más baja = mejor), solo en partidos con cuotas para comparar igual. */
function score(preds: Pred[]) {
  let l1 = 0, lo = 0, n = 0;
  for (const p of preds) {
    if (!market(p.m).x || market(p.m).over === undefined) continue;
    l1 += ll(p.x[result(p.m)]);
    lo += ll(isOver(p.m) ? p.over : 1 - p.over);
    n++;
  }
  return { l1x2: l1 / n, lou: lo / n, n };
}
const bookAsPred = (preds: Pred[]): Pred[] => preds.map((p) => blend(p, 0));
const fmt = (x: number) => x.toFixed(4);

// ---------- 1) Ajuste ----------
const t0 = Date.now();
const FROM_TRAIN = 2021, TO_TRAIN = 2022, FROM_TEST = 2023, TO_TEST = 2026;
const v1: PredictOptions = { version: 'v1', halfLifeDays: 365, priorMatches: 8, rho: 0 };
console.log('== Ajuste del modelo v2 (2021-22 y 2022-23) ==');
let best: PredictOptions = {}, bestScore = Infinity;
for (const halfLifeDays of [180, 365, 540])
  for (const priorMatches of [2, 5])
    for (const promotedStrength of [1, 0.8, 0.65])
      for (const goalsWeight of [1, 0.5, 0.25]) {
        const o: PredictOptions = { version: 'v2', halfLifeDays, priorMatches, promotedStrength, goalsWeight, rho: 0 };
        const s = score(predictAll(o, FROM_TRAIN, TO_TRAIN));
        if (s.l1x2 + s.lou < bestScore) { bestScore = s.l1x2 + s.lou; best = o; }
      }
for (const rho of [-0.05, -0.1]) {
  const o = { ...best, rho };
  const s = score(predictAll(o, FROM_TRAIN, TO_TRAIN));
  if (s.l1x2 + s.lou < bestScore) { bestScore = s.l1x2 + s.lou; best = o; }
}
console.log('  Elegido:', best, `(${((Date.now() - t0) / 1000).toFixed(0)} s)`);

// Peso del modelo en la mezcla con Bet365, elegido también con 2021-22 y 2022-23.
const trainV2 = predictAll(best, FROM_TRAIN, TO_TRAIN);
let beta = 0, betaScore = Infinity;
for (let b = 0; b <= 1.0001; b += 0.1) {
  const s = score(trainV2.map((p) => blend(p, b)));
  if (s.l1x2 + s.lou < betaScore) { betaScore = s.l1x2 + s.lou; beta = Math.round(b * 10) / 10; }
}
console.log(`  Mezcla con Bet365: ${Math.round(beta * 100)} % modelo, ${Math.round((1 - beta) * 100)} % Bet365`);

// ---------- 2) Prueba ----------
const testV1 = predictAll(v1, FROM_TEST, TO_TEST);
const testV2 = predictAll(best, FROM_TEST, TO_TEST);
const testMix = testV2.map((p) => blend(p, beta));
const sBook = score(bookAsPred(testV2));
console.log(`\n== Prueba (2023-24 a 2026-27, 5 ligas): ${score(testV2).n} partidos con cuotas ==`);
console.log('Pérdida logarítmica (más baja = mejor; azar: 1X2 = 1,0986, +2,5 = 0,6931)');
for (const [name, preds] of [['Modelo v1', testV1], ['Modelo v2', testV2], [`Mezcla ${Math.round(beta * 100)}/${Math.round((1 - beta) * 100)}`, testMix]] as const) {
  const s = score(preds as Pred[]);
  console.log(`  ${name.padEnd(14)} 1X2 ${fmt(s.l1x2)}   +2,5 ${fmt(s.lou)}`);
}
console.log(`  ${'Bet365'.padEnd(14)} 1X2 ${fmt(sBook.l1x2)}   +2,5 ${fmt(sBook.lou)}`);

function calibration(name: string, items: { p: number; hit: boolean }[]) {
  console.log(`\nCalibración v2 — ${name}   (modelo dice → pasó de verdad, nº partidos)`);
  const parts: string[] = [];
  for (let lo = 0; lo < 1; lo += 0.1) {
    const b = items.filter((x) => x.p >= lo && x.p < lo + 0.1);
    if (b.length < 30) continue;
    const avg = b.reduce((t, x) => t + x.p, 0) / b.length;
    const real = b.filter((x) => x.hit).length / b.length;
    parts.push(`${(avg * 100).toFixed(0)}→${(real * 100).toFixed(0)} % (${b.length})`);
  }
  console.log('  ' + parts.join('  '));
}
calibration('gana el local', testV2.map((p) => ({ p: p.x[0], hit: result(p.m) === 0 })));
calibration('más de 2,5', testV2.map((p) => ({ p: p.over, hit: isOver(p.m) })));
calibration('ambos marcan', testV2.map((p) => ({ p: p.btts, hit: p.m.homeGoals > 0 && p.m.awayGoals > 0 })));

// Recién ascendidos: ¿siguen saliendo demasiado fuertes?
const newTeam = (p: Pred) => {
  const prev = (byLeague.get(p.m.league) ?? []).filter((x) => seasonOf(x) === seasonOf(p.m) - 1);
  return !prev.some((x) => x.homeId === p.m.homeId || x.awayId === p.m.homeId);
};
for (const [name, preds] of [['v1', testV1], ['v2', testV2]] as const) {
  const sel = (preds as Pred[]).filter(newTeam);
  const avgP = sel.reduce((t, p) => t + p.x[0], 0) / sel.length;
  const real = sel.filter((p) => result(p.m) === 0).length / sel.length;
  console.log(`\nRecién ascendido jugando en casa (${sel.length} partidos), modelo ${name}: dice que gana ${(avgP * 100).toFixed(0)} %, ganó ${(real * 100).toFixed(0)} %`);
}

// ---------- 3) Simulación de apuestas de 1 € con las cuotas de Bet365 ----------
interface Bet { p: number; odd: number; hit: boolean }
function bets(preds: Pred[]): Bet[] {
  const out: Bet[] = [];
  for (const p of preds) {
    const o = p.m.odds, r = result(p.m);
    if (o.home) out.push({ p: p.x[0], odd: o.home, hit: r === 0 });
    if (o.draw) out.push({ p: p.x[1], odd: o.draw, hit: r === 1 });
    if (o.away) out.push({ p: p.x[2], odd: o.away, hit: r === 2 });
    if (o.over25) out.push({ p: p.over, odd: o.over25, hit: isOver(p.m) });
    if (o.under25) out.push({ p: 1 - p.over, odd: o.under25, hit: !isOver(p.m) });
  }
  return out;
}
function sim(all: Bet[], name: string, f: (b: Bet) => boolean) {
  const sel = all.filter(f);
  if (!sel.length) return console.log(`  ${name}: ninguna`);
  const won = sel.filter((b) => b.hit).length;
  const profit = sel.filter((b) => b.hit).reduce((t, b) => t + b.odd, 0) - sel.length;
  const avgP = sel.reduce((t, b) => t + b.p, 0) / sel.length;
  console.log(`  ${name.padEnd(38)} ${String(sel.length).padStart(5)} apuestas · esperaba ${(avgP * 100).toFixed(0)} % · ` +
    `acertó ${(won / sel.length * 100).toFixed(1)} % · beneficio ${(profit / sel.length * 100).toFixed(1)} %`);
}
for (const [name, preds] of [['MODELO v2', testV2], [`MEZCLA ${Math.round(beta * 100)}/${Math.round((1 - beta) * 100)}`, testMix]] as const) {
  const b = bets(preds as Pred[]);
  console.log(`\nSimulación ${name} (1 € por apuesta, cuotas de Bet365, 1X2 y más/menos 2,5)`);
  sim(b, 'Todas (referencia)', () => true);
  sim(b, 'Con valor > 5 %', (x) => x.p * x.odd - 1 > 0.05);
  sim(b, 'Segura: cuota 1,30-1,60, valor > 0 %', (x) => x.odd >= 1.3 && x.odd <= 1.6 && x.p * x.odd > 1);
  sim(b, 'Segura: cuota 1,30-1,60, valor > 3 %', (x) => x.odd >= 1.3 && x.odd <= 1.6 && x.p * x.odd - 1 > 0.03);
  sim(b, 'Media: cuota 1,80-2,50, valor > 3 %', (x) => x.odd >= 1.8 && x.odd <= 2.5 && x.p * x.odd - 1 > 0.03);
  sim(b, 'Arriesgada: cuota 4-10, valor > 5 %', (x) => x.odd >= 4 && x.odd <= 10 && x.p * x.odd - 1 > 0.05);
}
console.log(`\nTiempo total: ${((Date.now() - t0) / 1000).toFixed(0)} s`);
