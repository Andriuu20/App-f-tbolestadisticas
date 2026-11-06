// Función de Supabase (Deno) que descarga datos de API-Football y los guarda.
// Se llama desde la tarea programada (pg_cron) cada 30 minutos con {"action": "auto"}.
import postgres from 'npm:postgres@3.4.5';
import { ApiFootball } from '../_shared/apiFootball.ts';
import { Sync } from '../_shared/sync.ts';
import type { Sql } from '../_shared/types.ts';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 1 });

Deno.serve(async (req) => {
  // Solo el servidor puede lanzarla: así nadie gasta las consultas de la API desde fuera.
  if (req.headers.get('x-sync-secret') !== Deno.env.get('SYNC_SECRET')) {
    return new Response('No autorizado', { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const api = new ApiFootball({
    sql: sql as unknown as Sql,
    fetch,
    apiKey: Deno.env.get('API_FOOTBALL_KEY')!,
    dailyBudget: Number(Deno.env.get('API_DAILY_BUDGET') ?? 90),
    minIntervalMs: 6500,
  });
  const sync = new Sync(sql as unknown as Sql, api);
  const maxCalls = Math.min(Number(body.maxCalls ?? 12), 18); // ~6,5 s por consulta: cabe en el tiempo máximo

  try {
    switch (body.action ?? 'auto') {
      case 'auto':
        await sync.auto(maxCalls);
        break;
      case 'season':
        await sync.syncSeason(Number(body.league), Number(body.season));
        break;
      case 'backfill-stats':
        await sync.backfillStats(maxCalls, body.season ? Number(body.season) : undefined);
        break;
      default:
        return Response.json({ error: `Acción desconocida: ${body.action}` }, { status: 400 });
    }
    return Response.json({ ...sync.report, remainingToday: await api.remainingToday() });
  } catch (e) {
    return Response.json({ error: String(e), ...sync.report }, { status: 500 });
  }
});
