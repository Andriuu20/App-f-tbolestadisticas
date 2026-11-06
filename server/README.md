# Servidor (Supabase)

Descarga los datos de API-Football **una vez**, los guarda en la base de datos y la app los lee de ahí
(README principal, sección 6). La app nunca llama a API-Football ni ve sus claves.

## Qué hay
- `supabase/migrations/`: tablas (ligas, equipos, partidos, estadísticas, cuotas y registro de consultas).
  La app solo puede leer; escribir solo puede el servidor.
- `supabase/functions/sync/`: función que sincroniza. Acciones (cuerpo JSON):
  - `{"action": "auto"}`: partidos de ayer/hoy/mañana, estadísticas de los terminados y cuotas de los
    próximos. Solo pide lo que falta o está viejo.
  - `{"action": "season", "league": 140, "season": 2024}`: temporada completa (1 consulta).
  - `{"action": "backfill-stats", "season": 2024}`: estadísticas atrasadas, unas pocas cada vez.
- `supabase/functions/_shared/`: la lógica (sin nada propio de Supabase, para poder probarla aquí).
- `supabase/programar-sync.sql`: tarea programada cada 30 minutos.

## Límites de la API
Cada consulta se apunta en `api_requests`. La función se para al llegar a `API_DAILY_BUDGET`
(90 por defecto, el plan gratis permite 100) y espera 6,5 s entre consultas (máx. 10 por minuto).

## Pruebas
Usan respuestas reales guardadas en `test/data/`; no llaman a la API.
```
npm install
TEST_DATABASE_URL=postgres://postgres:postgres@localhost/futbol_test npm test
```

## Secretos de la función (en Supabase → Edge Functions → Secrets)
- `API_FOOTBALL_KEY`: clave de API-Football.
- `SYNC_SECRET`: una contraseña larga inventada; la misma que se guarda en Vault como `sync_secret`.
- `API_DAILY_BUDGET` (opcional).
