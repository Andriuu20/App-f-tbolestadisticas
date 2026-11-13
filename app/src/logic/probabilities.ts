// Probabilidades por equipo de córners y amarillas a partir de las medias que calcula el servidor.
// Comprobadas con 5.707 partidos (docs/backtest-por-equipo.txt).

/** P(X <= k) de una binomial negativa (media `mean`, dispersión `r`; r = Infinity es Poisson). */
export function countCdf(k: number, mean: number, r = Infinity): number {
  if (k < 0) return 0;
  let p: number, total = 0;
  if (!isFinite(r)) {
    p = Math.exp(-mean);
    for (let i = 0; i <= k; i++) { total += p; p *= mean / (i + 1); }
  } else {
    const q = r / (r + mean);
    p = Math.pow(q, r);
    for (let i = 0; i <= k; i++) { total += p; p *= ((i + r) / (i + 1)) * (1 - q); }
  }
  return Math.min(1, total);
}

/** Dispersión que mejor encaja con los datos: córners de un equipo varían más; amarillas, como Poisson. */
export const TEAM_DISPERSION = { corners: 10, yellows: Infinity } as const;
export const TEAM_LINES = { corners: [2.5, 3.5, 4.5, 5.5, 6.5], yellows: [0.5, 1.5, 2.5] } as const;

/** P(más de cada línea) para un equipo. */
export function teamOver(mean: number, kind: 'corners' | 'yellows'): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of TEAM_LINES[kind]) out[l] = 1 - countCdf(Math.floor(l), mean, TEAM_DISPERSION[kind]);
  return out;
}

/**
 * "Los dos equipos reciben al menos 1 amarilla". Multiplicar las dos probabilidades se queda corto
 * (en partidos tensos las reciben los dos), así que se corrige con lo observado: 58 % → 65 % real, etc.
 */
export function bothTeamsCarded(homeMean: number, awayMean: number): number {
  const independent = (1 - countCdf(0, homeMean)) * (1 - countCdf(0, awayMean));
  return 1 - (1 - independent) * 0.85;
}
