// Backtest del modelo de córners y tarjetas.
// A) football-data.co.uk (5 ligas, sin cuotas de córners): ¿se cumplen los porcentajes?
// B) FootyStats, clave de ejemplo (Premier 2018-19 y 2019-20, con cuotas de córners): ¿gana a la casa?
// Uso: node scripts/backtest-corners.ts <carpeta CSV football-data> <carpeta JSON FootyStats>
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expectedCounts, fairProbabilities, overProbabilities, type CountMatch } from '../supabase/functions/_shared/model/index.ts';
import { readFootballData, type FdMatch } from './footballData.ts';

const [fdDir, fsDir] = process.argv.slice(2);
const ll = (p: number) => -Math.log(Math.min(Math.max(p, 1e-9), 1 - 1e-9));
const seasonOf = (d: string | Date) => { const x = new Date(d); return x.getUTCMonth() >= 6 ? x.getUTCFullYear() : x.getUTCFullYear() - 1; };

// ---------------- A) football-data ----------------
const all = readFootballData(readdirSync(fdDir).filter((f) => /^[A-Z0-9]+_\d{4}\.csv$/.test(f)).map((f) => join(fdDir, f)));
const leagues = [...new Set(all.map((m) => m.league))];
type Kind = 'corners' | 'yellows';
const toCount = (m: FdMatch, kind: Kind): CountMatch => ({
  date: m.date, homeId: m.homeId, awayId: m.awayId, home: m[kind]?.[0] ?? null, away: m[kind]?.[1] ?? null,
});
const LINES: Record<Kind, number[]> = { corners: [8.5, 9.5, 10.5], yellows: [3.5, 4.5] };
const R_GRID = [Infinity, 40, 20, 12, 8];

/** Medias esperadas de cada partido de unas temporadas (modelo y media de la liga). */
function means(kind: Kind, from: number, to: number, halfLifeDays: number, priorMatches: number) {
  const out: { total: number; league: number; actual: number }[] = [];
  for (const lg of leagues) {
    const ms = all.filter((m) => m.league === lg).map((m) => ({ m, c: toCount(m, kind) }));
    const counts = ms.map((x) => x.c);
    for (const { m, c } of ms) {
      const s = seasonOf(m.date);
      if (s < from || s > to || c.home == null || c.away == null) continue;
      try {
        const e = expectedCounts(counts, m.homeId, m.awayId, m.date, { halfLifeDays, priorMatches });
        out.push({ total: e.total, league: e.leagueTotal, actual: c.home + c.away });
      } catch { /* sin historial */ }
    }
  }
  return out;
}
function logLoss(rows: { total: number; actual: number }[], lines: number[], r: number) {
  let s = 0, n = 0;
  for (const x of rows) {
    const p = overProbabilities(x.total, lines, r);
    for (const l of lines) { s += ll(x.actual > l ? p[l] : 1 - p[l]); n++; }
  }
  return s / n;
}

const chosen: Record<Kind, { halfLifeDays: number; priorMatches: number; r: number }> = {} as never;
for (const kind of ['corners', 'yellows'] as Kind[]) {
  const name = kind === 'corners' ? 'CÓRNERS' : 'TARJETAS AMARILLAS';
  let best = { halfLifeDays: 365, priorMatches: 5, r: Infinity }, bestS = Infinity;
  for (const halfLifeDays of [180, 365, 730]) for (const priorMatches of [3, 10]) {
    const rows = means(kind, 2021, 2022, halfLifeDays, priorMatches);
    for (const r of R_GRID) {
      const s = logLoss(rows, LINES[kind], r);
      if (s < bestS) { bestS = s; best = { halfLifeDays, priorMatches, r }; }
    }
  }
  chosen[kind] = best;
  const test = means(kind, 2023, 2026, best.halfLifeDays, best.priorMatches);
  const base = test.map((x) => ({ total: x.league, actual: x.actual }));
  console.log(`\n== A) ${name} — football-data, prueba 2023-24 a 2026-27 (${test.length} partidos) ==`);
  console.log(`  Ajustes: semivida ${best.halfLifeDays} d, prior ${best.priorMatches}, dispersión ${best.r}`);
  console.log(`  Pérdida logarítmica (líneas ${LINES[kind].join(', ')}): modelo ${logLoss(test, LINES[kind], best.r).toFixed(4)} | ` +
    `solo media de la liga ${logLoss(base, LINES[kind], best.r).toFixed(4)} | Poisson ${logLoss(test, LINES[kind], Infinity).toFixed(4)}`);
  const line = LINES[kind][1];
  const parts: string[] = [];
  for (let lo = 0; lo < 1; lo += 0.1) {
    const b = test.map((x) => ({ p: overProbabilities(x.total, [line], best.r)[line], hit: x.actual > line }))
      .filter((x) => x.p >= lo && x.p < lo + 0.1);
    if (b.length < 40) continue;
    parts.push(`${(b.reduce((t, x) => t + x.p, 0) / b.length * 100).toFixed(0)}→${(b.filter((x) => x.hit).length / b.length * 100).toFixed(0)} % (${b.length})`);
  }
  console.log(`  Calibración más de ${String(line).replace('.', ',')} (modelo dice → pasó): ${parts.join('  ')}`);
}

// ---------------- B) FootyStats con cuotas de córners ----------------
interface FsMatch { date_unix: number; status: string; home_name: string; away_name: string; team_a_corners: number; team_b_corners: number; [k: string]: unknown }
const fsMatches: FsMatch[] = readdirSync(fsDir).filter((f) => /^m_\d+\.json$/.test(f))
  .flatMap((f) => (JSON.parse(readFileSync(join(fsDir, f), 'utf8')).data as FsMatch[]))
  .filter((m) => m.status === 'complete' && m.team_a_corners >= 0 && m.team_b_corners >= 0)
  .sort((a, b) => a.date_unix - b.date_unix);
const ids = new Map<string, number>();
const id = (n: string) => { if (!ids.has(n)) ids.set(n, ids.size + 1); return ids.get(n)!; };
const counts: CountMatch[] = fsMatches.map((m) => ({
  date: new Date(m.date_unix * 1000), homeId: id(m.home_name), awayId: id(m.away_name), home: m.team_a_corners, away: m.team_b_corners,
}));
const FS_LINES = ['75', '85', '95', '105', '115'];
const c = chosen.corners;
interface Row { line: number; model: number; market: number; overOdd: number; underOdd: number; hit: boolean }
const rows: Row[] = [];
fsMatches.forEach((m, i) => {
  if (seasonOf(new Date(m.date_unix * 1000)) !== 2019) return; // probamos 2019-20; 2018-19 es historial
  const e = expectedCounts(counts, counts[i].homeId, counts[i].awayId, counts[i].date, c);
  const total = m.team_a_corners + m.team_b_corners;
  for (const l of FS_LINES) {
    const o = Number(m[`odds_corners_over_${l}`]), u = Number(m[`odds_corners_under_${l}`]);
    if (!(o > 1 && u > 1)) continue;
    const line = Number(l) / 10;
    rows.push({ line, model: overProbabilities(e.total, [line], c.r)[line], market: fairProbabilities([o, u]).probs[0], overOdd: o, underOdd: u, hit: total > line });
  }
});
const lossOf = (f: (r: Row) => number) => rows.reduce((t, r) => t + ll(r.hit ? f(r) : 1 - f(r)), 0) / rows.length;
console.log(`\n== B) CÓRNERS frente a la casa — FootyStats, Premier 2019-20 (${rows.length} cuotas de ${new Set(rows.map((r) => r.line)).size} líneas) ==`);
console.log(`  Pérdida logarítmica: modelo ${lossOf((r) => r.model).toFixed(4)} | casa sin margen ${lossOf((r) => r.market).toFixed(4)}`);
let bestB = 0, bestBS = Infinity;
for (let b = 0; b <= 1.0001; b += 0.1) { const s = lossOf((r) => b * r.model + (1 - b) * r.market); if (s < bestBS) { bestBS = s; bestB = Math.round(b * 10) / 10; } }
console.log(`  Mejor mezcla: ${Math.round(bestB * 100)} % modelo / ${Math.round((1 - bestB) * 100)} % casa (pérdida ${bestBS.toFixed(4)}) — ojo: elegida con los mismos partidos`);
const margin = rows.reduce((t, r) => t + 1 / r.overOdd + 1 / r.underOdd - 1, 0) / rows.length;
console.log(`  Margen medio de la casa en córners: ${(margin * 100).toFixed(1)} %`);
for (const edge of [0.03, 0.08, 0.15]) {
  let n = 0, won = 0, profit = 0;
  for (const r of rows) {
    for (const [p, odd, hit] of [[r.model, r.overOdd, r.hit], [1 - r.model, r.underOdd, !r.hit]] as [number, number, boolean][]) {
      if (p * odd - 1 > edge) { n++; if (hit) { won++; profit += odd - 1; } else profit -= 1; }
    }
  }
  console.log(`  Apostar cuando el modelo ve valor > ${edge * 100} %: ${n} apuestas, acierto ${n ? (won / n * 100).toFixed(1) : '–'} %, beneficio ${n ? (profit / n * 100).toFixed(1) : '–'} %`);
}
