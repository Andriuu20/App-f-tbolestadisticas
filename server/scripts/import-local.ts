// Importa CSV de football-data.co.uk ya descargados a una base de datos local y calcula predicciones.
// Uso: DATABASE_URL=postgres://... node scripts/import-local.ts <carpeta> [fecha "ahora", ISO]
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';
import { parseFootballData } from '../supabase/functions/_shared/footballData.ts';
import { computePredictions, importRows } from '../supabase/functions/_shared/importFd.ts';
import type { Sql } from '../supabase/functions/_shared/types.ts';

const [dir, now] = process.argv.slice(2);
const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} }) as unknown as Sql & { end(): Promise<void> };
const files = readdirSync(dir).filter((f) => f.endsWith('.csv')).sort();
// Primero los históricos y al final los próximos partidos (fixtures.csv).
files.sort((a, b) => Number(a === 'fixtures.csv') - Number(b === 'fixtures.csv'));
for (const f of files) {
  const r = await importRows(sql, parseFootballData(readFileSync(join(dir, f), 'utf8')));
  console.log(f, r);
}
console.log('predicciones:', await computePredictions(sql, now ? new Date(now) : new Date()));
await sql.end();
