-- Las 3 apuestas recomendadas por partido y su resultado (para el Historial).
create table recommendations (
  fixture_id  integer not null references fixtures(id) on delete cascade,
  tier        text not null check (tier in ('segura', 'media', 'arriesgada')),
  market      text not null,
  selection   text not null,
  label       text not null,           -- texto para la app: "Gana Sevilla", "Más de 2,5 goles"...
  odd         numeric(8,3) not null,   -- cuota de Bet365 al recomendarla
  prob        numeric(5,4) not null,   -- probabilidad de la casa sin margen
  model_prob  numeric(5,4) not null,   -- probabilidad del modelo
  reason      text not null,
  model       text not null,
  updated_at  timestamptz not null default now(),
  won         boolean,                 -- null = pendiente
  settled_at  timestamptz,
  primary key (fixture_id, tier)
);
alter table recommendations enable row level security;
create policy "lectura publica" on recommendations for select using (true);

-- Para las pestañas "Para ti" e "Historial": recomendación con los datos del partido.
create view recommendation_cards with (security_invoker = true) as
select r.*, f.kickoff, f.status, f.league_id, l.name as league_name,
  h.name as home_name, a.name as away_name, f.home_goals, f.away_goals
from recommendations r
join fixtures f on f.id = r.fixture_id
join leagues l on l.id = f.league_id
join teams h on h.id = f.home_id
join teams a on a.id = f.away_id;
