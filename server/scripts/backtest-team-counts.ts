// ¿Se cumplen las probabilidades POR EQUIPO de córners y amarillas? (football-data, 2023-24 a 2026-27)
// Uso: node scripts/backtest-team-counts.ts <carpeta CSV football-data>
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { countCdf, expectedCounts, type CountMatch } from '../supabase/functions/_shared/model/index.ts';
import { readFootballData, type FdMatch } from './footballData.ts';

const dir = process.argv[2];
const all = readFootballData(readdirSync(dir).filter((f) => /^[A-Z0-9]+_\d{4}\.csv$/.test(f)).map((f) => join(dir, f)));
const seasonOf = (d: string | Date) => { const x = new Date(d); return x.getUTCMonth() >= 6 ? x.getUTCFullYear() : x.getUTCFullYear() - 1; };
const OPTS = { halfLifeDays: 180, priorMatches: 10 };
const ll = (p: number) => -Math.log(Math.min(Math.max(p, 1e-9), 1 - 1e-9));

for (const [kind, lines] of [['corners', [3.5, 4.5, 5.5]], ['yellows', [0.5, 1.5, 2.5]]] as const) {
  const preds: { mean: number; actual: number }[] = [];
  for (const lg of new Set(all.map((m) => m.league))) {
    const ms = all.filter((m) => m.league === lg);
    const counts: CountMatch[] = ms.map((m: FdMatch) => ({ date: m.date, homeId: m.homeId, awayId: m.awayId,
      home: m[kind]?.[0] ?? null, away: m[kind]?.[1] ?? null }));
    ms.forEach((m, i) => {
      if (seasonOf(m.date) < 2023 || counts[i].home == null) return;
      try {
        const e = expectedCounts(counts, m.homeId, m.awayId, m.date, OPTS);
        preds.push({ mean: e.home, actual: counts[i].home! }, { mean: e.away, actual: counts[i].away! });
      } catch { /* sin historial */ }
    });
  }
  console.log(`\n== ${kind === 'corners' ? 'CÓRNERS' : 'AMARILLAS'} DE CADA EQUIPO (${preds.length} equipos-partido) ==`);
  // Dispersión: probar varias y quedarse con la mejor (ojo: elegida con estos mismos datos).
  let best = Infinity, bestR = Infinity;
  for (const r of [Infinity, 40, 20, 10, 6]) {
    let s = 0, n = 0;
    for (const p of preds) for (const l of lines) { const over = 1 - countCdf(Math.floor(l), p.mean, r); s += ll(p.actual > l ? over : 1 - over); n++; }
    if (s / n < best) { best = s / n; bestR = r; }
  }
  console.log(`  Mejor dispersión: ${bestR}`);
  for (const l of lines) {
    const parts: string[] = [];
    for (let lo = 0; lo < 1; lo += 0.1) {
      const b = preds.map((p) => ({ p: 1 - countCdf(Math.floor(l), p.mean, bestR), hit: p.actual > l })).filter((x) => x.p >= lo && x.p < lo + 0.1);
      if (b.length < 80) continue;
      parts.push(`${(b.reduce((t, x) => t + x.p, 0) / b.length * 100).toFixed(0)}→${(b.filter((x) => x.hit).length / b.length * 100).toFixed(0)} %`);
    }
    console.log(`  Más de ${String(l).replace('.', ',')} (dice → pasó): ${parts.join('  ')}`);
  }
}

// "Los dos equipos reciben al menos 1 amarilla" = P(local >= 1) × P(visitante >= 1)
{
  const items: { p: number; hit: boolean }[] = [];
  for (const lg of new Set(all.map((m) => m.league))) {
    const ms = all.filter((m) => m.league === lg);
    const counts: CountMatch[] = ms.map((m) => ({ date: m.date, homeId: m.homeId, awayId: m.awayId,
      home: m.yellows?.[0] ?? null, away: m.yellows?.[1] ?? null }));
    ms.forEach((m, i) => {
      if (seasonOf(m.date) < 2023 || counts[i].home == null) return;
      try {
        const e = expectedCounts(counts, m.homeId, m.awayId, m.date, OPTS);
        items.push({ p: (1 - countCdf(0, e.home)) * (1 - countCdf(0, e.away)), hit: counts[i].home! > 0 && counts[i].away! > 0 });
      } catch { /* sin historial */ }
    });
  }
  const parts: string[] = [];
  for (let lo = 0; lo < 1; lo += 0.1) {
    const b = items.filter((x) => x.p >= lo && x.p < lo + 0.1);
    if (b.length < 80) continue;
    parts.push(`${(b.reduce((t, x) => t + x.p, 0) / b.length * 100).toFixed(0)}→${(b.filter((x) => x.hit).length / b.length * 100).toFixed(0)} %`);
  }
  console.log(`\n== LOS DOS EQUIPOS RECIBEN AMARILLA (${items.length} partidos) ==\n  (dice → pasó): ${parts.join('  ')}`);
}
