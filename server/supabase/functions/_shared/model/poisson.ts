// Modelo de Poisson con la corrección de Dixon-Coles para marcadores bajos.
// Devuelve la probabilidad de cada marcador: matrix[golesLocal][golesVisitante].

export function poissonPmf(k: number, lambda: number): number {
  if (k < 0) return 0;
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

/**
 * Corrección de Dixon-Coles (1997): Poisson independiente se equivoca en 0-0, 1-0, 0-1 y 1-1.
 * Con rho < 0 sube la probabilidad de 0-0 y 1-1 y baja la de 1-0 y 0-1.
 */
function dixonColesTau(h: number, a: number, lambda: number, mu: number, rho: number): number {
  if (h === 0 && a === 0) return 1 - lambda * mu * rho;
  if (h === 0 && a === 1) return 1 + lambda * rho;
  if (h === 1 && a === 0) return 1 + mu * rho;
  if (h === 1 && a === 1) return 1 - rho;
  return 1;
}

export interface ScoreMatrixOptions {
  /** Máximo de goles por equipo que se calculan (lo que queda fuera es despreciable). */
  maxGoals?: number;
  /** Parámetro de Dixon-Coles; 0 = Poisson puro. Valores típicos entre -0.15 y 0. */
  rho?: number;
}

/** Matriz de probabilidades de marcadores. Siempre suma 1 (se normaliza). */
export function scoreMatrix(lambda: number, mu: number, opts: ScoreMatrixOptions = {}): number[][] {
  const maxGoals = opts.maxGoals ?? 10;
  const rho = opts.rho ?? -0.08;
  if (!(lambda > 0) || !(mu > 0)) throw new Error(`Goles esperados no válidos: ${lambda}, ${mu}`);
  // El rho permitido depende de lambda y mu (las probabilidades no pueden ser negativas).
  const rhoMin = Math.max(-1 / lambda, -1 / mu);
  const rhoMax = Math.min(1 / (lambda * mu), 1);
  const r = Math.min(Math.max(rho, rhoMin), rhoMax);

  const home = Array.from({ length: maxGoals + 1 }, (_, k) => poissonPmf(k, lambda));
  const away = Array.from({ length: maxGoals + 1 }, (_, k) => poissonPmf(k, mu));
  const m = home.map((ph, h) => away.map((pa, a) => ph * pa * dixonColesTau(h, a, lambda, mu, r)));
  const total = m.flat().reduce((s, p) => s + p, 0);
  return m.map((row) => row.map((p) => p / total));
}
