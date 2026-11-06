// Modelo v2: fuerza de ataque y defensa ajustada al rival (tipo Maher / Dixon-Coles), con todos
// los partidos de cada equipo, ventaja de campo de la liga, recién ascendidos y tiros a puerta.
import type { ExpectedGoals, PastMatch } from './strength.ts';

export interface RatingsOptions {
  /** En cuántos días un partido pasa a pesar la mitad. */
  halfLifeDays?: number;
  /** Partidos "imaginarios" con la fuerza de partida que se suman a cada equipo. */
  priorMatches?: number;
  maxAgeDays?: number;
  /**
   * Fuerza de partida de un equipo nuevo en la liga (recién ascendido). 1 = equipo medio.
   * Ataque = promotedStrength, defensa = 1 / promotedStrength.
   */
  promotedStrength?: number;
  /** Peso de los goles frente a los tiros a puerta (1 = solo goles, 0 = solo tiros a puerta). */
  goalsWeight?: number;
  /** Vueltas del ajuste (con 10-15 ya no cambia). */
  iterations?: number;
}

const DAY = 86400_000;

interface Row { h: number; a: number; w: number; hg: number; ag: number }

/**
 * Goles esperados de `homeId` contra `awayId` el día `date`, usando solo partidos anteriores.
 * Devuelve lo mismo que el modelo v1 (`expectedGoals`) para que se puedan intercambiar.
 */
export function expectedGoalsV2(
  matches: PastMatch[],
  homeId: number,
  awayId: number,
  date: string | Date,
  opts: RatingsOptions = {},
): ExpectedGoals {
  const halfLife = opts.halfLifeDays ?? 365;
  const k = opts.priorMatches ?? 4;
  const maxAge = opts.maxAgeDays ?? 730;
  const promoted = opts.promotedStrength ?? 1;
  const alpha = opts.goalsWeight ?? 1;
  const iterations = opts.iterations ?? 12;
  const t = new Date(date).getTime();

  // 1) Partidos válidos, con peso y "goles efectivos" (mezcla de goles y tiros a puerta).
  const raw: { m: PastMatch; w: number; age: number }[] = [];
  let goals = 0, sot = 0;
  for (const m of matches) {
    const age = (t - new Date(m.date).getTime()) / DAY;
    if (age <= 0 || age > maxAge) continue;
    raw.push({ m, w: Math.pow(0.5, age / halfLife), age });
    if (m.homeShotsOnTarget != null && m.awayShotsOnTarget != null) {
      goals += m.homeGoals + m.awayGoals;
      sot += m.homeShotsOnTarget + m.awayShotsOnTarget;
    }
  }
  if (raw.length === 0) throw new Error('No hay partidos anteriores para calcular la fuerza de los equipos');
  const conversion = sot > 0 ? goals / sot : 0; // goles por tiro a puerta en la liga
  const eff = (g: number, s: number | null | undefined) =>
    alpha >= 1 || s == null || conversion === 0 ? g : alpha * g + (1 - alpha) * conversion * s;

  const rows: Row[] = [];
  const oldest = new Map<number, number>(); // partido más antiguo de cada equipo (días)
  let wSum = 0, H = 0, A = 0;
  for (const { m, w, age } of raw) {
    const hg = eff(m.homeGoals, m.homeShotsOnTarget), ag = eff(m.awayGoals, m.awayShotsOnTarget);
    rows.push({ h: m.homeId, a: m.awayId, w, hg, ag });
    wSum += w; H += w * hg; A += w * ag;
    for (const id of [m.homeId, m.awayId]) oldest.set(id, Math.max(oldest.get(id) ?? 0, age));
  }
  H /= wSum; A /= wSum;

  // 2) Fuerza de partida: equipo medio, o flojo si es nuevo en la liga (sin partidos de hace más de
  //    200 días cuando la liga sí los tiene).
  const leagueHasHistory = Math.max(...oldest.values()) > 200;
  const isNew = (id: number) => leagueHasHistory && (oldest.get(id) ?? 0) <= 200;
  const teams = new Set<number>([...oldest.keys(), homeId, awayId]);
  const priorAtt = new Map<number, number>(), priorDef = new Map<number, number>();
  for (const id of teams) {
    priorAtt.set(id, isNew(id) ? promoted : 1);
    priorDef.set(id, isNew(id) ? 1 / promoted : 1);
  }

  // 3) Ajuste iterativo: ataque = goles marcados / goles que marcaría un equipo medio contra esos rivales.
  const att = new Map<number, number>(priorAtt), def = new Map<number, number>(priorDef);
  const base = (H + A) / 2;
  for (let it = 0; it < iterations; it++) {
    const numA = new Map<number, number>(), denA = new Map<number, number>();
    const numD = new Map<number, number>(), denD = new Map<number, number>();
    const add = (m: Map<number, number>, id: number, v: number) => m.set(id, (m.get(id) ?? 0) + v);
    for (const r of rows) {
      add(numA, r.h, r.w * r.hg); add(denA, r.h, r.w * H * def.get(r.a)!);
      add(numA, r.a, r.w * r.ag); add(denA, r.a, r.w * A * def.get(r.h)!);
      add(numD, r.h, r.w * r.ag); add(denD, r.h, r.w * A * att.get(r.a)!);
      add(numD, r.a, r.w * r.hg); add(denD, r.a, r.w * H * att.get(r.h)!);
    }
    for (const id of teams) {
      att.set(id, ((numA.get(id) ?? 0) + k * base * priorAtt.get(id)!) / ((denA.get(id) ?? 0) + k * base));
      def.set(id, ((numD.get(id) ?? 0) + k * base * priorDef.get(id)!) / ((denD.get(id) ?? 0) + k * base));
    }
  }

  const count = (id: number, side: 'h' | 'a') => rows.filter((r) => r[side] === id).length;
  return {
    lambdaHome: H * att.get(homeId)! * def.get(awayId)!,
    lambdaAway: A * att.get(awayId)! * def.get(homeId)!,
    leagueHomeAvg: H,
    leagueAwayAvg: A,
    homeSample: count(homeId, 'h') + count(homeId, 'a'),
    awaySample: count(awayId, 'h') + count(awayId, 'a'),
  };
}
