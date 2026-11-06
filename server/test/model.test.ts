// Pruebas del modelo de probabilidades con valores que se pueden comprobar a mano.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checkValue, expectedGoals, fairProbabilities, goalMarkets, historicalRates,
  parlayProbability, poissonPmf, predictGoals, scoreMatrix, type PastMatch,
} from '../supabase/functions/_shared/model/index.ts';

const close = (a: number, b: number, tol = 1e-3) =>
  assert.ok(Math.abs(a - b) < tol, `${a} no se parece a ${b}`);

test('Poisson: probabilidades conocidas', () => {
  close(poissonPmf(0, 1.5), Math.exp(-1.5));
  close(poissonPmf(2, 2.5), 0.2565);
  close([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].reduce((s, k) => s + poissonPmf(k, 2.7), 0), 1);
});

test('Poisson puro (rho = 0): 1,5 contra 1,0 goles esperados', () => {
  const g = goalMarkets(scoreMatrix(1.5, 1.0, { rho: 0 }), 1.5, 1.0);
  close(g.home + g.draw + g.away, 1);
  // Total ~ Poisson(2,5): P(<=2) = e^-2,5 · (1 + 2,5 + 3,125) = 0,5438
  close(g.over[2.5], 1 - 0.5438);
  close(g.over[0.5], 1 - Math.exp(-2.5));
  // Ambos marcan = (1 - e^-1,5)(1 - e^-1)
  close(g.btts, (1 - Math.exp(-1.5)) * (1 - Math.exp(-1)));
  close(g.homeOver[0.5], 1 - Math.exp(-1.5));
  close(g.homeOrDraw, g.home + g.draw);
  assert.ok(g.home > g.away);
  assert.deepEqual([g.topScores[0].home, g.topScores[0].away], [1, 0]);
});

test('Dixon-Coles: más 0-0 y 1-1, menos 1-0 y 0-1, y sigue sumando 1', () => {
  const p = scoreMatrix(1.4, 1.1, { rho: 0 });
  const dc = scoreMatrix(1.4, 1.1, { rho: -0.1 });
  close(dc.flat().reduce((s, x) => s + x, 0), 1);
  assert.ok(dc[0][0] > p[0][0] && dc[1][1] > p[1][1]);
  assert.ok(dc[1][0] < p[1][0] && dc[0][1] < p[0][1]);
});

test('Equipos iguales: misma probabilidad de ganar local y visitante', () => {
  const g = goalMarkets(scoreMatrix(1.3, 1.3), 1.3, 1.3);
  close(g.home, g.away, 1e-9);
});

// Liga inventada: A golea, B es media, C es floja. Partidos durante un año.
function fakeLeague(): PastMatch[] {
  const teams = [1, 2, 3, 4];
  const goals: Record<number, number> = { 1: 3, 2: 1, 3: 0, 4: 1 }; // goles que marca cada uno
  const out: PastMatch[] = [];
  let day = 0;
  for (let round = 0; round < 6; round++) {
    for (const h of teams) for (const a of teams) {
      if (h === a) continue;
      out.push({
        date: new Date(Date.UTC(2024, 0, 1) + day++ * 86400_000).toISOString(),
        homeId: h, awayId: a, homeGoals: goals[h], awayGoals: goals[a],
      });
    }
  }
  return out;
}

test('Fuerza: el equipo goleador tiene más goles esperados', () => {
  const league = fakeLeague();
  const xg = expectedGoals(league, 1, 3, '2025-01-01');
  assert.ok(xg.lambdaHome > 2, `A debería esperar más de 2 goles, sale ${xg.lambdaHome}`);
  assert.ok(xg.lambdaAway < 0.6, `C debería esperar pocos goles, sale ${xg.lambdaAway}`);
  const p = predictGoals(league, 1, 3, '2025-01-01');
  assert.ok(p.home > 0.7);
  assert.equal(p.homeSample, 18);
});

test('Fuerza: no usa partidos posteriores a la fecha (sin trampas al mirar el pasado)', () => {
  const league = fakeLeague();
  const before = expectedGoals(league, 2, 4, '2024-01-20');
  const later = league.map((m) => ({ ...m, date: '2030-01-01' })); // todos "en el futuro"
  assert.throws(() => expectedGoals(later, 2, 4, '2024-01-20'), /No hay partidos/);
  assert.ok(before.lambdaHome > 0);
});

test('Fuerza: con pocos partidos se acerca a la media de la liga', () => {
  const league = fakeLeague();
  // Equipo 9: un solo partido ganado 5-0 en casa.
  league.push({ date: '2024-12-30', homeId: 9, awayId: 2, homeGoals: 5, awayGoals: 0 });
  const xg = expectedGoals(league, 9, 2, '2025-01-01');
  assert.ok(xg.lambdaHome < 3, `con un partido no debería esperar 5 goles, sale ${xg.lambdaHome}`);
});

test('Porcentajes históricos y forma', () => {
  const m: PastMatch[] = [
    { date: '2024-05-01', homeId: 1, awayId: 2, homeGoals: 2, awayGoals: 1 },
    { date: '2024-05-08', homeId: 3, awayId: 1, homeGoals: 0, awayGoals: 0 },
    { date: '2024-05-15', homeId: 1, awayId: 4, homeGoals: 1, awayGoals: 3 },
    { date: '2024-05-22', homeId: 5, awayId: 1, homeGoals: 2, awayGoals: 2 },
  ];
  const r = historicalRates(m, 1, '2024-06-01');
  assert.equal(r.matches, 4);
  assert.equal(r.over[2.5], 0.75);
  assert.equal(r.btts, 0.75);
  assert.deepEqual(r.form, ['E', 'D', 'E', 'V']);
  close(r.goalsFor, 5 / 4);
  assert.equal(historicalRates(m, 1, '2024-06-01', { venue: 'home' }).matches, 2);
});

test('Valor: quitar el margen de la casa (cuotas reales del Sevilla-Alavés en Bet365)', () => {
  const { probs, margin } = fairProbabilities([1.85, 3.6, 4.33]);
  close(probs.reduce((s, p) => s + p, 0), 1);
  close(margin, 1 / 1.85 + 1 / 3.6 + 1 / 4.33 - 1);
  assert.ok(margin > 0.04 && margin < 0.06); // ~5 % de margen
  close(probs[0], (1 / 1.85) / (1 + margin));
});

test('Valor: apuesta con y sin valor; combinadas', () => {
  const yes = checkValue(0.75, 1.45);
  close(yes.expectedValue, 0.0875);
  assert.equal(yes.hasValue, true);
  close(yes.minOdd, 1.3333);
  assert.equal(checkValue(0.6, 1.45).hasValue, false);
  // README: 4 apuestas del 70 % = 24 %
  close(parlayProbability([0.7, 0.7, 0.7, 0.7]), 0.2401);
});

test('Modelo v2: equipos iguales son simétricos y el goleador sale favorito', async () => {
  const { expectedGoalsV2 } = await import('../supabase/functions/_shared/model/index.ts');
  const league = fakeLeague();
  const strong = expectedGoalsV2(league, 1, 3, '2025-01-01');
  assert.ok(strong.lambdaHome > 2 && strong.lambdaAway < 0.6, JSON.stringify(strong));
  // 2 y 4 marcan lo mismo: sus goles esperados deben ser iguales en cada campo.
  const a = expectedGoalsV2(league, 2, 4, '2025-01-01');
  const b = expectedGoalsV2(league, 4, 2, '2025-01-01');
  close(a.lambdaHome, b.lambdaHome, 0.01); // casi iguales: sus partidos caen en fechas algo distintas
  close(a.lambdaAway, b.lambdaAway, 0.01);
});

test('Modelo v2: un recién ascendido empieza más flojo que un equipo medio', async () => {
  const { expectedGoalsV2 } = await import('../supabase/functions/_shared/model/index.ts');
  const league = fakeLeague(); // un año de partidos (enero-diciembre 2024 aprox.)
  // Equipo 9 aparece hace 20 días con un empate 1-1.
  league.push({ date: '2025-06-10', homeId: 9, awayId: 2, homeGoals: 1, awayGoals: 1 });
  const neutral = expectedGoalsV2(league, 9, 2, '2025-07-01', { promotedStrength: 1 });
  const promoted = expectedGoalsV2(league, 9, 2, '2025-07-01', { promotedStrength: 0.8 });
  assert.ok(promoted.lambdaHome < neutral.lambdaHome);
  assert.ok(promoted.lambdaAway > neutral.lambdaAway);
});

test('Modelo v2: los tiros a puerta cuentan si se les da peso', async () => {
  const { expectedGoalsV2 } = await import('../supabase/functions/_shared/model/index.ts');
  // El equipo 1 marca poco pero tira mucho a puerta.
  const league = fakeLeague().map((m) => ({
    ...m,
    homeShotsOnTarget: m.homeId === 2 ? 9 : 4, awayShotsOnTarget: m.awayId === 2 ? 9 : 4,
  }));
  const onlyGoals = expectedGoalsV2(league, 2, 4, '2025-01-01', { goalsWeight: 1 });
  const withShots = expectedGoalsV2(league, 2, 4, '2025-01-01', { goalsWeight: 0.5 });
  assert.ok(withShots.lambdaHome > onlyGoals.lambdaHome);
});

test('Córners: binomial negativa con dispersión enorme = Poisson, y suma 1', async () => {
  const { countCdf, overProbabilities } = await import('../supabase/functions/_shared/model/index.ts');
  close(countCdf(9, 10.5, Infinity), countCdf(9, 10.5, 1e9), 1e-6);
  close(countCdf(200, 10.5, 20), 1, 1e-9);
  // Con más dispersión, los extremos son más probables.
  const poisson = overProbabilities(10, [13.5], Infinity)[13.5];
  const nb = overProbabilities(10, [13.5], 8)[13.5];
  assert.ok(nb > poisson);
  // Media 10: P(más de 9,5) cerca del 54 % con Poisson.
  close(overProbabilities(10, [9.5], Infinity)[9.5], 1 - countCdf(9, 10), 1e-12);
});

test('Córners: el equipo que fuerza más córners tiene más esperados', async () => {
  const { expectedCounts } = await import('../supabase/functions/_shared/model/index.ts');
  const m = fakeLeague().map((x) => ({ date: x.date, homeId: x.homeId, awayId: x.awayId,
    home: x.homeId === 1 ? 9 : 4, away: x.awayId === 1 ? 8 : 4 }));
  const e = expectedCounts(m, 1, 3, '2025-01-01');
  const f = expectedCounts(m, 2, 3, '2025-01-01');
  assert.ok(e.home > f.home + 2, JSON.stringify({ e, f }));
  close(e.total, e.home + e.away, 1e-9);
});
