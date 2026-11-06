// Modelo de córners y tarjetas: cuántos fuerza y cuántos concede cada equipo, ajustado al rival
// (como el de goles v2), y la probabilidad de "más de X" con una binomial negativa, porque los córners
// y las tarjetas varían más de lo que supone Poisson.

export interface CountMatch {
  date: string | Date;
  homeId: number;
  awayId: number;
  /** Córners (o tarjetas) de cada equipo; null si no hay dato. */
  home: number | null;
  away: number | null;
}

export interface CountOptions {
  halfLifeDays?: number;
  priorMatches?: number;
  maxAgeDays?: number;
  iterations?: number;
}

export interface ExpectedCounts {
  home: number;
  away: number;
  total: number;
  /** Media de la liga por partido (los dos equipos). */
  leagueTotal: number;
}

const DAY = 86400_000;

/** Córners (o tarjetas) esperados de cada equipo, usando solo partidos anteriores a `date`. */
export function expectedCounts(
  matches: CountMatch[], homeId: number, awayId: number, date: string | Date, opts: CountOptions = {},
): ExpectedCounts {
  const halfLife = opts.halfLifeDays ?? 365;
  const k = opts.priorMatches ?? 5;
  const maxAge = opts.maxAgeDays ?? 730;
  const iterations = opts.iterations ?? 10;
  const t = new Date(date).getTime();

  const rows: { h: number; a: number; w: number; hv: number; av: number }[] = [];
  let wSum = 0, H = 0, A = 0;
  for (const m of matches) {
    if (m.home == null || m.away == null) continue;
    const age = (t - new Date(m.date).getTime()) / DAY;
    if (age <= 0 || age > maxAge) continue;
    const w = Math.pow(0.5, age / halfLife);
    rows.push({ h: m.homeId, a: m.awayId, w, hv: m.home, av: m.away });
    wSum += w; H += w * m.home; A += w * m.away;
  }
  if (wSum === 0) throw new Error('No hay partidos anteriores con este dato');
  H /= wSum; A /= wSum;

  const teams = new Set<number>([homeId, awayId]);
  for (const r of rows) { teams.add(r.h); teams.add(r.a); }
  const att = new Map<number, number>(), def = new Map<number, number>();
  for (const id of teams) { att.set(id, 1); def.set(id, 1); }
  const base = (H + A) / 2;
  for (let it = 0; it < iterations; it++) {
    const nA = new Map<number, number>(), dA = new Map<number, number>();
    const nD = new Map<number, number>(), dD = new Map<number, number>();
    const add = (m: Map<number, number>, id: number, v: number) => m.set(id, (m.get(id) ?? 0) + v);
    for (const r of rows) {
      add(nA, r.h, r.w * r.hv); add(dA, r.h, r.w * H * def.get(r.a)!);
      add(nA, r.a, r.w * r.av); add(dA, r.a, r.w * A * def.get(r.h)!);
      add(nD, r.h, r.w * r.av); add(dD, r.h, r.w * A * att.get(r.a)!);
      add(nD, r.a, r.w * r.hv); add(dD, r.a, r.w * H * att.get(r.h)!);
    }
    for (const id of teams) {
      att.set(id, ((nA.get(id) ?? 0) + k * base) / ((dA.get(id) ?? 0) + k * base));
      def.set(id, ((nD.get(id) ?? 0) + k * base) / ((dD.get(id) ?? 0) + k * base));
    }
  }
  const home = H * att.get(homeId)! * def.get(awayId)!;
  const away = A * att.get(awayId)! * def.get(homeId)!;
  return { home, away, total: home + away, leagueTotal: H + A };
}

/**
 * P(X <= k) de una binomial negativa con media `mean` y dispersión `r`
 * (varianza = media + media² / r). r = Infinity es Poisson.
 */
export function countCdf(k: number, mean: number, r = Infinity): number {
  if (k < 0) return 0;
  let p: number, total = 0;
  if (!isFinite(r)) {
    p = Math.exp(-mean);
    for (let i = 0; i <= k; i++) { total += p; p *= mean / (i + 1); }
  } else {
    const q = r / (r + mean); // probabilidad de "fracaso" en la parametrización habitual
    p = Math.pow(q, r);
    for (let i = 0; i <= k; i++) { total += p; p *= ((i + r) / (i + 1)) * (1 - q); }
  }
  return Math.min(1, total);
}

/** P(más de `line`) para cada línea (8.5 -> más de 8). */
export function overProbabilities(mean: number, lines: number[], r = Infinity): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of lines) out[l] = 1 - countCdf(Math.floor(l), mean, r);
  return out;
}

export const CORNER_LINES = [7.5, 8.5, 9.5, 10.5, 11.5];
export const CARD_LINES = [2.5, 3.5, 4.5, 5.5];
