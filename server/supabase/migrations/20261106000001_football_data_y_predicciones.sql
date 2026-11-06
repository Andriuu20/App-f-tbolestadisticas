-- Datos de football-data.co.uk (gratis) y predicciones del modelo.

-- football-data no trae ids: les damos ids propios en un rango que API-Football no usa.
create sequence fd_team_ids start 1900000000;
create sequence fd_fixture_ids start 2000000000;

alter table fixtures add column source text not null default 'api-football';
alter table fixtures add column external_key text unique; -- fd:<liga>:<fecha>:<local>:<visitante>
alter table fixtures alter column id set default nextval('fd_fixture_ids');
alter table fixtures alter column raw set default '{}'::jsonb;
alter table fixture_stats alter column raw set default '{}'::jsonb;

-- Nombre del equipo en cada fuente -> equipo.
create table team_aliases (
  source  text not null,
  name    text not null,
  team_id integer not null references teams(id),
  primary key (source, name)
);

-- Código de liga en football-data.co.uk.
alter table leagues add column fd_code text unique;
update leagues set fd_code = 'SP1' where id = 140;
update leagues set fd_code = 'E0'  where id = 39;
update leagues set fd_code = 'I1'  where id = 135;
update leagues set fd_code = 'D1'  where id = 78;
update leagues set fd_code = 'F1'  where id = 61;

-- Predicción del modelo para cada partido próximo (la recalcula el servidor).
create table predictions (
  fixture_id    integer primary key references fixtures(id) on delete cascade,
  model         text not null,             -- versión del modelo, p. ej. "goles-v1"
  computed_at   timestamptz not null default now(),
  lambda_home   numeric(5,2) not null,     -- goles esperados
  lambda_away   numeric(5,2) not null,
  p_home        numeric(5,4) not null,
  p_draw        numeric(5,4) not null,
  p_away        numeric(5,4) not null,
  p_over25      numeric(5,4) not null,
  p_btts        numeric(5,4) not null,
  corners_avg   numeric(4,1),              -- media de córners en los partidos de ambos equipos
  cards_avg     numeric(4,1),              -- media de amarillas
  markets       jsonb not null,            -- todos los mercados de goles (ver model/markets.ts)
  home_recent   jsonb not null,            -- forma y porcentajes de los últimos partidos
  away_recent   jsonb not null
);
alter table predictions enable row level security;
alter table team_aliases enable row level security;
create policy "lectura publica" on predictions for select using (true);

-- Lo que necesita cada tarjeta de la pantalla "Partidos". security_invoker: respeta los permisos.
create view match_cards with (security_invoker = true) as
select
  f.id, f.kickoff, f.status, f.league_id, l.name as league_name, f.round, f.referee,
  f.home_id, h.name as home_name, h.logo as home_logo, f.home_goals,
  f.away_id, a.name as away_name, a.logo as away_logo, f.away_goals,
  p.model, p.lambda_home, p.lambda_away, p.p_home, p.p_draw, p.p_away, p.p_over25, p.p_btts,
  p.corners_avg, p.cards_avg,
  (select o.odd from odds o where o.fixture_id = f.id and o.bookmaker = 'Bet365'
     and o.market = 'Match Winner' and o.selection = 'Home') as odd_home,
  (select o.odd from odds o where o.fixture_id = f.id and o.bookmaker = 'Bet365'
     and o.market = 'Match Winner' and o.selection = 'Draw') as odd_draw,
  (select o.odd from odds o where o.fixture_id = f.id and o.bookmaker = 'Bet365'
     and o.market = 'Match Winner' and o.selection = 'Away') as odd_away
from fixtures f
join leagues l on l.id = f.league_id
join teams h on h.id = f.home_id
join teams a on a.id = f.away_id
left join predictions p on p.fixture_id = f.id;
