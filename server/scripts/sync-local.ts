// Ejecuta la sincronización contra una base de datos local, para probar sin desplegar.
// Uso: DATABASE_URL=postgres://... API_FOOTBALL_KEY=... node scripts/sync-local.ts auto 6
//      node scripts/sync-local.ts season 140 2024
//      node scripts/sync-local.ts backfill-stats 5 2024
import postgres from 'postgres';
import { ApiFootball } from '../supabase/functions/_shared/apiFootball.ts';
import { Sync } from '../supabase/functions/_shared/sync.ts';
import type { Sql } from '../supabase/functions/_shared/types.ts';

const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
const api = new ApiFootball({
  sql: sql as unknown as Sql,
  fetch,
  apiKey: process.env.API_FOOTBALL_KEY!,
  dailyBudget: Number(process.env.API_DAILY_BUDGET ?? 90),
  minIntervalMs: 6500,
});
const sync = new Sync(sql as unknown as Sql, api);
const [action = 'auto', a, b] = process.argv.slice(2);

if (action === 'auto') await sync.auto(Number(a ?? 6));
else if (action === 'season') await sync.syncSeason(Number(a), Number(b));
else if (action === 'backfill-stats') await sync.backfillStats(Number(a ?? 5), b ? Number(b) : undefined);
else throw new Error(`Acción desconocida: ${action}`);

console.log(JSON.stringify({ ...sync.report, remainingToday: await api.remainingToday() }, null, 2));
await sql.end();
