// Pruebas del importador de football-data.co.uk. Necesita TEST_DATABASE_URL (base de datos vacía de pruebas).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { after, beforeEach, test } from 'node:test';
import postgres from 'postgres';
import { londonToUtc, parseFootballData } from '../supabase/functions/_shared/footballData.ts';
import { computePredictions, importRows, updateRecommendations } from '../supabase/functions/_shared/importFd.ts';
import type { Sql } from '../supabase/functions/_shared/types.ts';

const sql = postgres(process.env.TEST_DATABASE_URL!, { max: 1, onnotice: () => {} });
const db = sql as unknown as Sql;
const migrations = new URL('../supabase/migrations/', import.meta.url);

beforeEach(async () => {
  await sql.unsafe('drop schema public cascade; create schema public;');
  for (const f of readdirSync(migrations).sort()) await sql.unsafe(readFileSync(new URL(f, migrations), 'utf8'));
});
after(() => sql.end());

const HEADER = 'Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,HTHG,HTAG,HTR,Referee,HS,AS,HST,AST,HC,AC,HY,AY,HR,AR,B365H,B365D,B365A,B365>2.5,B365<2.5';
const csv = (...rows: string[]) => `﻿${HEADER}\n${rows.join('\n')}\n`;

test('hora británica a UTC, en invierno y en verano', () => {
  assert.equal(londonToUtc(2026, 11, 6, 19, 30).toISOString(), '2026-11-06T19:30:00.000Z'); // GMT
  assert.equal(londonToUtc(2026, 8, 15, 20, 0).toISOString(), '2026-08-15T19:00:00.000Z'); // BST = UTC+1
});

test('lee partidos jugados y por jugar', () => {
  const rows = parseFootballData(csv(
    'SP1,15/08/2026,20:00,Sevilla,Alaves,2,1,H,1,0,H,X Ref,14,9,6,3,7,4,2,3,0,1,1.85,3.5,4.5,2.2,1.67',
    'SP1,08/11/2026,16:15,Betis,Sevilla,,,,,,,,,,,,,,,,,,2.1,3.4,3.6,1.9,1.9',
  ));
  assert.equal(rows.length, 2);
  assert.deepEqual([rows[0].homeGoals, rows[0].corners, rows[0].yellows, rows[0].reds], [2, [7, 4], [2, 3], [0, 1]]);
  assert.equal(rows[0].kickoff, '2026-08-15T19:00:00.000Z');
  assert.equal(rows[1].homeGoals, undefined);
  assert.equal(rows[1].odds.home, 2.1);
});

test('importa sin duplicar y calcula predicciones de los próximos partidos', async () => {
  const played: string[] = [];
  const teams = ['Sevilla', 'Alaves', 'Betis', 'Getafe'];
  let day = 1;
  for (let round = 0; round < 3; round++) for (const h of teams) for (const a of teams) {
    if (h === a) continue;
    const d = String(day++).padStart(2, '0');
    played.push(`SP1,${d}/09/2026,20:00,${h},${a},${h === 'Betis' ? 3 : 1},1,H,0,0,D,,10,8,4,3,6,4,2,2,0,0,2,3.3,3.5,2,1.8`);
  }
  const first = await importRows(db, parseFootballData(csv(...played)));
  assert.equal(first.fixtures, 36);
  assert.equal(first.stats, 72);
  // Volver a importar lo mismo no crea partidos nuevos.
  await importRows(db, parseFootballData(csv(...played)));
  const [{ n }] = await sql`select count(*)::int as n from fixtures`;
  assert.equal(n, 36);
  const [{ t }] = await sql`select count(*)::int as t from teams`;
  assert.equal(t, 4);

  await importRows(db, parseFootballData(csv('SP1,08/11/2026,16:15,Betis,Sevilla,,,,,,,,,,,,,,,,,,1.6,3.8,5.5,1.9,1.9')));
  assert.equal(await computePredictions(db, new Date('2026-11-06T12:00:00Z')), 1);
  const [card] = await sql`select * from match_cards where status = 'NS'`;
  assert.equal(card.home_name, 'Betis');
  assert.ok(Number(card.p_home) > Number(card.p_away), 'el Betis golea en casa: debería ser favorito');
  assert.equal(Number(card.odd_home), 1.6);
  assert.equal(Number(card.corners_avg), 10);
  const [pred] = await sql`select home_recent from predictions`;
  assert.equal(pred.home_recent.form.length, 5);

  // Recomendaciones: con cuota local 1,60 hay "segura"; cuando se juega, se comprueba y ya no cambia.
  const recs = await updateRecommendations(db, new Date('2026-11-06T12:00:00Z'));
  assert.ok(recs.saved >= 2);
  const [segura] = await sql`select label, odd, won from recommendations where tier = 'segura'`;
  assert.equal(segura.label, 'Gana Betis');
  assert.equal(segura.won, null);
  await importRows(db, parseFootballData(csv('SP1,08/11/2026,16:15,Betis,Sevilla,2,0,H,1,0,H,,10,8,4,3,6,4,2,2,0,0,1.6,3.8,5.5,1.9,1.9')));
  const after = await updateRecommendations(db, new Date('2026-11-09T12:00:00Z'));
  assert.ok(after.settled >= 2);
  const [done] = await sql`select won, odd from recommendations where tier = 'segura'`;
  assert.equal(done.won, true);
  assert.equal(Number(done.odd), 1.6);
});

