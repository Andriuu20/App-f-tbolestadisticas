// Función de Supabase (Deno): importa football-data.co.uk y recalcula las predicciones.
// {"action": "current"}  -> temporada actual + próximos partidos + predicciones (tarea programada).
// {"action": "history", "seasons": ["2425", "2526"]} -> temporadas pasadas (una vez).
import postgres from 'npm:postgres@3.4.5';
import { parseFootballData } from '../_shared/footballData.ts';
import { computePredictions, importRows, type ImportReport } from '../_shared/importFd.ts';
import type { Sql } from '../_shared/types.ts';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 1 }) as unknown as Sql;
const BASE = 'https://football-data.co.uk';

/** Temporada en curso en el formato de football-data: "2627" para 2026-27. */
function currentSeason(now = new Date()): string {
  const y = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return `${String(y % 100).padStart(2, '0')}${String((y + 1) % 100).padStart(2, '0')}`;
}

async function download(path: string): Promise<string> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`football-data ${path}: HTTP ${res.status}`);
  return await res.text();
}

Deno.serve(async (req) => {
  if (req.headers.get('x-sync-secret') !== Deno.env.get('SYNC_SECRET')) {
    return new Response('No autorizado', { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const leagues = (await sql`select fd_code from leagues where fd_code is not null and active`).map((l) => l.fd_code);
  const files: Record<string, ImportReport> = {};
  try {
    const seasons: string[] = body.action === 'history' ? body.seasons : [currentSeason()];
    for (const s of seasons) {
      for (const code of leagues) {
        files[`${s}/${code}`] = await importRows(sql, parseFootballData(await download(`/mmz4281/${s}/${code}.csv`)));
      }
    }
    if (body.action !== 'history') {
      files['fixtures'] = await importRows(sql, parseFootballData(await download('/fixtures.csv')));
    }
    const predictions = await computePredictions(sql);
    return Response.json({ files, predictions });
  } catch (e) {
    return Response.json({ error: String(e), files }, { status: 500 });
  }
});
