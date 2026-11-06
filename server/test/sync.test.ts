// Pruebas de la sincronización con respuestas reales de API-Football guardadas en test/data.
// No llaman a la API. Necesitan una base de datos PostgreSQL vacía de pruebas:
//   TEST_DATABASE_URL=postgres://postgres:postgres@localhost/futbol_test npm test
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, beforeEach, test } from 'node:test';
import postgres from 'postgres';
import { ApiFootball } from '../supabase/functions/_shared/apiFootball.ts';
import { Sync } from '../supabase/functions/_shared/sync.ts';
import type { Fetch, Sql } from '../supabase/functions/_shared/types.ts';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('Falta TEST_DATABASE_URL');
const sql = postgres(url, { max: 1, onnotice: () => {} });
const schema = readFileSync(new URL('../supabase/migrations/20261106000000_init.sql', import.meta.url), 'utf8');
const data = (name: string) => JSON.parse(readFileSync(new URL(`./data/${name}.json`, import.meta.url), 'utf8'));
const empty = { errors: [], results: 0, response: [] };
const NOW = new Date('2026-11-06T12:00:00Z');

/** API-Football falsa: responde con los datos guardados y apunta las URLs pedidas. */
function fakeApi(overrides: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const fetch: Fetch = async (u) => {
    const { pathname, searchParams } = new URL(u);
    const key = `${pathname}?${searchParams}`;
    calls.push(key);
    let body: unknown = overrides[key] ?? empty;
    if (!(key in overrides)) {
      if (key === '/fixtures?date=2026-11-06') body = data('fixtures-2026-11-06');
      if (key === '/odds?fixture=1570450') body = data('odds-1570450');
      if (key === '/fixtures/statistics?fixture=1492444') body = data('statistics-1492444');
    }
    return { status: 200, json: async () => body };
  };
  return { fetch, calls };
}

function makeSync(fetch: Fetch, dailyBudget = 90) {
  const s = sql as unknown as Sql;
  const api = new ApiFootball({ sql: s, fetch, apiKey: 'test', dailyBudget, minIntervalMs: 0 });
  return { api, sync: new Sync(s, api) };
}

beforeEach(async () => {
  await sql.unsafe('drop schema public cascade; create schema public;');
  await sql.unsafe(schema);
});
after(() => sql.end());

test('auto: guarda los partidos de hoy de las ligas activas y sus cuotas', async () => {
  const { fetch, calls } = fakeApi();
  const { sync } = makeSync(fetch);
  const report = await sync.auto(12, NOW);

  // 3 fechas (hoy, ayer, mañana) + cuotas de los 5 partidos sin empezar.
  assert.deepEqual(calls.slice(0, 3), [
    '/fixtures?date=2026-11-06', '/fixtures?date=2026-11-05', '/fixtures?date=2026-11-07',
  ]);
  assert.equal(report.calls, 8);
  assert.equal(report.fixtures, 5); // el Cruzeiro-Bahia (liga brasileña) no está activa
  assert.equal(report.odds, 5);

  const [sevilla] = await sql`
    select f.status, f.referee, h.name as home, a.name as away from fixtures f
    join teams h on h.id = f.home_id join teams a on a.id = f.away_id where f.id = 1570450`;
  assert.deepEqual({ ...sevilla }, { status: 'NS', referee: 'Luis Bestard Servera', home: 'Sevilla', away: 'Alaves' });

  const markets = await sql`
    select distinct market from odds where fixture_id = 1570450 and bookmaker = 'Bet365' order by 1`;
  const names = markets.map((m) => m.market);
  for (const m of ['Match Winner', 'Goals Over/Under', 'Both Teams Score', 'Corners Over Under', 'Cards Over/Under']) {
    assert.ok(names.includes(m), `falta el mercado ${m}`);
  }
  const [home] = await sql`
    select odd from odds where fixture_id = 1570450 and bookmaker = 'Bet365'
    and market = 'Match Winner' and selection = 'Home'`;
  assert.ok(Number(home.odd) > 1);

  const [{ n }] = await sql`select count(*)::int as n from api_requests where ok`;
  assert.equal(n, 8);
});

test('auto: si los datos son recientes no vuelve a gastar consultas', async () => {
  const first = fakeApi();
  await makeSync(first.fetch).sync.auto(12, NOW);
  const second = fakeApi();
  const report = await makeSync(second.fetch).sync.auto(12, NOW);
  assert.equal(report.calls, 0);
  assert.deepEqual(second.calls, []);
});

test('respeta el tope diario de consultas', async () => {
  const { fetch, calls } = fakeApi();
  const { sync, api } = makeSync(fetch, 2);
  const report = await sync.auto(12, NOW);
  assert.equal(report.stoppedByBudget, true);
  assert.equal(calls.length, 2);
  assert.equal(await api.remainingToday(), 0);
});

test('estadísticas: córners, tarjetas y xG de un partido terminado', async () => {
  const { fetch } = fakeApi();
  const { sync } = makeSync(fetch);
  await sync.saveFixtures(data('fixtures-2026-11-06').response, false);
  await sync.syncStats(1492444);
  const rows = await sql`
    select t.name, s.corners, s.yellow_cards, s.red_cards, s.shots, s.xg::float as xg
    from fixture_stats s join teams t on t.id = s.team_id order by t.name`;
  assert.deepEqual(rows.map((r) => ({ ...r })), [
    { name: 'Bahia', corners: 7, yellow_cards: 2, red_cards: 0, shots: 13, xg: 0.72 },
    { name: 'Cruzeiro', corners: 5, yellow_cards: 3, red_cards: 0, shots: 22, xg: 3.52 },
  ]);
});

test('un error de la API se apunta y se avisa', async () => {
  const suspended = { errors: { access: 'Your account is suspended' }, results: 0, response: [] };
  const { fetch } = fakeApi({ '/fixtures?date=2026-11-06': suspended });
  const { sync } = makeSync(fetch);
  await assert.rejects(sync.auto(12, NOW), /suspended/);
  const [row] = await sql`select ok, error from api_requests`;
  assert.equal(row.ok, false);
  assert.match(row.error, /suspended/);
});
