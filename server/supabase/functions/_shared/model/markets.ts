// Probabilidades de los mercados de goles a partir de la matriz de marcadores.

export interface GoalMarkets {
  lambdaHome: number;
  lambdaAway: number;
  home: number; // 1
  draw: number; // X
  away: number; // 2
  homeOrDraw: number; // 1X
  homeOrAway: number; // 12
  drawOrAway: number; // X2
  btts: number; // ambos marcan
  /** Más de X goles en total: clave = línea (0.5, 1.5...). Menos de X = 1 - over. */
  over: Record<string, number>;
  homeOver: Record<string, number>;
  awayOver: Record<string, number>;
  /** Marcadores más probables. */
  topScores: { home: number; away: number; p: number }[];
}

export const GOAL_LINES = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5];

export function goalMarkets(matrix: number[][], lambdaHome: number, lambdaAway: number): GoalMarkets {
  let home = 0, draw = 0, away = 0, btts = 0;
  const over: Record<string, number> = {};
  const homeOver: Record<string, number> = {};
  const awayOver: Record<string, number> = {};
  for (const l of GOAL_LINES) over[l] = homeOver[l] = awayOver[l] = 0;
  const scores: { home: number; away: number; p: number }[] = [];

  matrix.forEach((row, h) =>
    row.forEach((p, a) => {
      if (h > a) home += p;
      else if (h === a) draw += p;
      else away += p;
      if (h > 0 && a > 0) btts += p;
      for (const l of GOAL_LINES) {
        if (h + a > l) over[l] += p;
        if (h > l) homeOver[l] += p;
        if (a > l) awayOver[l] += p;
      }
      scores.push({ home: h, away: a, p });
    })
  );
  scores.sort((x, y) => y.p - x.p);
  return {
    lambdaHome, lambdaAway, home, draw, away,
    homeOrDraw: home + draw, homeOrAway: home + away, drawOrAway: draw + away,
    btts, over, homeOver, awayOver, topScores: scores.slice(0, 5),
  };
}
