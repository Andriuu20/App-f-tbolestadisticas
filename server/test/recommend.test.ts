// Pruebas de las 3 apuestas recomendadas.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { candidates, recommend, settle, type OddRow } from '../supabase/functions/_shared/recommend.ts';

const odds = (h: number, d: number, a: number, over: number, under: number): OddRow[] => [
  { bookmaker: 'Bet365', market: 'Match Winner', selection: 'Home', odd: h },
  { bookmaker: 'Bet365', market: 'Match Winner', selection: 'Draw', odd: d },
  { bookmaker: 'Bet365', market: 'Match Winner', selection: 'Away', odd: a },
  { bookmaker: 'Bet365', market: 'Goals Over/Under', selection: 'Over 2.5', odd: over },
  { bookmaker: 'Bet365', market: 'Goals Over/Under', selection: 'Under 2.5', odd: under },
  { bookmaker: 'Media', market: 'Match Winner', selection: 'Home', odd: 9 }, // otra casa: se ignora
];
const info = {
  homeName: 'Arsenal', awayName: 'Hull',
  model: { home: 0.7, draw: 0.2, away: 0.1, over25: 0.55 },
  homeRecent: { over: { '2.5': 0.6 }, wins: 0.7, home: { wins: 0.8, matches: 5 } },
  awayRecent: { over: { '2.5': 0.4 }, wins: 0.2, away: { wins: 0.2, matches: 5 } },
};

test('probabilidad justa de la casa y solo cuotas de Bet365', () => {
  const c = candidates(odds(1.5, 4.2, 6.5, 1.8, 2.0), info);
  assert.equal(c.length, 5);
  const sum = c.filter((x) => x.market === 'Match Winner').reduce((t, x) => t + x.prob, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
  assert.equal(c.find((x) => x.selection === 'Home')!.odd, 1.5);
});

test('una apuesta por nivel según el rango de cuota', () => {
  const r = recommend(odds(1.5, 4.2, 6.5, 1.85, 1.95), info);
  const byTier = Object.fromEntries(r.map((x) => [x.tier, x]));
  assert.equal(byTier.segura.label, 'Gana Arsenal');
  assert.ok(['Más de 2,5 goles', 'Menos de 2,5 goles'].includes(byTier.media.label));
  assert.ok(['Empate', 'Gana Hull'].includes(byTier.arriesgada.label));
  assert.match(byTier.segura.reason, /ha ganado 4 de sus últimos 5 partidos en casa/);
});

test('si no hay cuota en el rango, no se inventa la apuesta', () => {
  // Partido igualado: nada entre 1,30 y 1,60.
  const r = recommend(odds(2.6, 3.2, 2.8, 1.9, 1.9), info);
  assert.equal(r.find((x) => x.tier === 'segura'), undefined);
  assert.ok(r.find((x) => x.tier === 'media'));
});

test('sin cuotas no hay recomendaciones', () => {
  assert.deepEqual(recommend([], info), []);
});

test('comprobar si se ganó', () => {
  assert.equal(settle('Match Winner', 'Home', 2, 1), true);
  assert.equal(settle('Match Winner', 'Draw', 2, 1), false);
  assert.equal(settle('Match Winner', 'Away', 0, 1), true);
  assert.equal(settle('Goals Over/Under', 'Over 2.5', 2, 1), true);
  assert.equal(settle('Goals Over/Under', 'Under 2.5', 2, 1), false);
  assert.equal(settle('Goals Over/Under', 'Over 1.5', 1, 0), false);
  assert.equal(settle('Corners', 'Over 8.5', 1, 0), null);
});
