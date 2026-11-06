// Punto de entrada del modelo: goles esperados -> marcadores -> mercados.
import { goalMarkets, type GoalMarkets } from './markets.ts';
import { scoreMatrix, type ScoreMatrixOptions } from './poisson.ts';
import { expectedGoals, type PastMatch, type StrengthOptions } from './strength.ts';

export * from './historical.ts';
export * from './markets.ts';
export * from './poisson.ts';
export * from './strength.ts';
export * from './value.ts';

export interface PredictOptions extends StrengthOptions, ScoreMatrixOptions {}

/** Predicción de los mercados de goles de un partido a partir de los partidos anteriores de la liga. */
export function predictGoals(
  matches: PastMatch[],
  homeId: number,
  awayId: number,
  date: string | Date,
  opts: PredictOptions = {},
): GoalMarkets & { homeSample: number; awaySample: number } {
  const xg = expectedGoals(matches, homeId, awayId, date, opts);
  const m = scoreMatrix(xg.lambdaHome, xg.lambdaAway, opts);
  return { ...goalMarkets(m, xg.lambdaHome, xg.lambdaAway), homeSample: xg.homeSample, awaySample: xg.awaySample };
}
