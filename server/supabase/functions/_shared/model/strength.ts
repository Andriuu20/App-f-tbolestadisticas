// Goles esperados de un partido según la fuerza en ataque y defensa de cada equipo,
// como local y como visitante por separado. Los partidos recientes pesan más.

export interface PastMatch {
  date: string | Date;
  homeId: number;
  awayId: number;
  homeGoals: number;
  awayGoals: number;
}

export interface StrengthOptions {
  /** En cuántos días un partido pasa a pesar la mitad. */
  halfLifeDays?: number;
  /**
   * Partidos "imaginarios" de equipo medio que se suman a cada equipo. Evita que con pocos
   * partidos salgan fuerzas exageradas (un equipo que ganó 4-0 su único partido no es 4 veces mejor).
   */
  priorMatches?: number;
  /** Partidos más antiguos que esto no cuentan. */
  maxAgeDays?: number;
}

export interface ExpectedGoals {
  lambdaHome: number;
  lambdaAway: number;
  leagueHomeAvg: number;
  leagueAwayAvg: number;
  /** Partidos usados de cada equipo (como local el de casa, como visitante el de fuera). */
  homeSample: number;
  awaySample: number;
}

const DAY = 86400_000;

/**
 * Calcula los goles esperados de `homeId` contra `awayId` en la fecha `date`,
 * usando solo partidos anteriores a esa fecha (para no hacer trampa al probar con el pasado).
 */
export function expectedGoals(
  matches: PastMatch[],
  homeId: number,
  awayId: number,
  date: string | Date,
  opts: StrengthOptions = {},
): ExpectedGoals {
  const halfLife = opts.halfLifeDays ?? 180;
  const k = opts.priorMatches ?? 4;
  const maxAge = opts.maxAgeDays ?? 730;
  const t = new Date(date).getTime();

  let wSum = 0, homeGoalsSum = 0, awayGoalsSum = 0;
  // Sumas ponderadas por equipo: [peso, goles a favor, goles en contra]
  const atHome = new Map<number, [number, number, number]>();
  const atAway = new Map<number, [number, number, number]>();
  const add = (m: Map<number, [number, number, number]>, id: number, w: number, gf: number, ga: number) => {
    const v = m.get(id) ?? [0, 0, 0];
    v[0] += w; v[1] += w * gf; v[2] += w * ga;
    m.set(id, v);
  };

  for (const x of matches) {
    const age = (t - new Date(x.date).getTime()) / DAY;
    if (age <= 0 || age > maxAge) continue;
    const w = Math.pow(0.5, age / halfLife);
    wSum += w;
    homeGoalsSum += w * x.homeGoals;
    awayGoalsSum += w * x.awayGoals;
    add(atHome, x.homeId, w, x.homeGoals, x.awayGoals);
    add(atAway, x.awayId, w, x.awayGoals, x.homeGoals);
  }
  if (wSum === 0) throw new Error('No hay partidos anteriores para calcular la fuerza de los equipos');

  const leagueHomeAvg = homeGoalsSum / wSum;
  const leagueAwayAvg = awayGoalsSum / wSum;
  // Fuerza = media propia / media de la liga, mezclada con k partidos de equipo medio (fuerza 1).
  const ratio = (sum: number, w: number, avg: number) => (sum + k * avg) / ((w + k) * avg);

  const [hw, hgf, hga] = atHome.get(homeId) ?? [0, 0, 0];
  const [aw, agf, aga] = atAway.get(awayId) ?? [0, 0, 0];
  const homeAttack = ratio(hgf, hw, leagueHomeAvg);
  const homeDefense = ratio(hga, hw, leagueAwayAvg); // >1 = encaja más que la media
  const awayAttack = ratio(agf, aw, leagueAwayAvg);
  const awayDefense = ratio(aga, aw, leagueHomeAvg);

  return {
    lambdaHome: leagueHomeAvg * homeAttack * awayDefense,
    lambdaAway: leagueAwayAvg * awayAttack * homeDefense,
    leagueHomeAvg,
    leagueAwayAvg,
    homeSample: atHome.get(homeId) ? countSample(matches, homeId, 'home', t, maxAge) : 0,
    awaySample: atAway.get(awayId) ? countSample(matches, awayId, 'away', t, maxAge) : 0,
  };
}

function countSample(matches: PastMatch[], id: number, side: 'home' | 'away', t: number, maxAge: number) {
  return matches.filter((x) => {
    const age = (t - new Date(x.date).getTime()) / DAY;
    return age > 0 && age <= maxAge && (side === 'home' ? x.homeId : x.awayId) === id;
  }).length;
}
