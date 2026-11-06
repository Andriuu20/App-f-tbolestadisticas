-- Tarea programada: llama a la función `sync` cada 30 minutos.
-- Ejecutar UNA vez en el editor SQL de Supabase, después de desplegar la función y de guardar
-- en Vault los secretos `project_url` (https://<ref>.supabase.co) y `sync_secret`.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'sync-futbol',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sync_secret')
    ),
    body := '{"action": "auto"}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);

-- Importación de football-data.co.uk (gratis) y predicciones: cada 6 horas.
select cron.schedule(
  'import-football-data',
  '17 */6 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/import-fd',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sync_secret')
    ),
    body := '{"action": "current"}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);
