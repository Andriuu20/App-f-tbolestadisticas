-- Esquema inicial: datos de API-Football guardados una vez y leídos por todos los usuarios.

create table leagues (
  id          integer primary key,          -- id de API-Football (140 = LaLiga)
  name        text not null,
  country     text,
  logo        text,
  active      boolean not null default true -- ligas que el servidor sincroniza
);

create table teams (
  id    integer primary key,
  name  text not null,
  logo  text
);

create table fixtures (
  id            integer primary key,
  league_id     integer not null references leagues(id),
  season        integer not null,
  round         text,
  kickoff       timestamptz not null,
  status        text not null,              -- NS, 1H, HT, FT, PST...
  home_id       integer not null references teams(id),
  away_id       integer not null references teams(id),
  home_goals    integer,
  away_goals    integer,
  home_goals_ht integer,
  away_goals_ht integer,
  referee       text,
  venue         text,
  raw           jsonb not null,
  updated_at    timestamptz not null default now()
);
create index fixtures_kickoff_idx on fixtures (kickoff);
create index fixtures_league_season_idx on fixtures (league_id, season);
create index fixtures_home_idx on fixtures (home_id, kickoff);
create index fixtures_away_idx on fixtures (away_id, kickoff);

-- Estadísticas de cada equipo en un partido (córners, tarjetas, tiros, xG...).
create table fixture_stats (
  fixture_id      integer not null references fixtures(id) on delete cascade,
  team_id         integer not null references teams(id),
  corners         integer,
  yellow_cards    integer,
  red_cards       integer,
  shots           integer,
  shots_on_target integer,
  possession      integer,                   -- en %
  xg              numeric(5,2),
  raw             jsonb not null,
  updated_at      timestamptz not null default now(),
  primary key (fixture_id, team_id)
);

-- Cuotas: una fila por partido, casa, mercado y selección.
create table odds (
  fixture_id  integer not null references fixtures(id) on delete cascade,
  bookmaker   text not null,
  market      text not null,                 -- "Match Winner", "Goals Over/Under"...
  selection   text not null,                 -- "Home", "Over 2.5"...
  odd         numeric(8,3) not null,
  fetched_at  timestamptz not null default now(),
  primary key (fixture_id, bookmaker, market, selection)
);

-- Registro de cada consulta a API-Football, para no pasar del límite diario.
create table api_requests (
  id          bigint generated always as identity primary key,
  endpoint    text not null,
  params      jsonb not null,
  ok          boolean not null,
  error       text,
  results     integer,
  called_at   timestamptz not null default now()
);
create index api_requests_called_at_idx on api_requests (called_at);

-- La app solo lee; escribir solo puede el servidor (rol con permisos de servicio).
alter table leagues       enable row level security;
alter table teams         enable row level security;
alter table fixtures      enable row level security;
alter table fixture_stats enable row level security;
alter table odds          enable row level security;
alter table api_requests  enable row level security;

create policy "lectura publica" on leagues       for select using (true);
create policy "lectura publica" on teams         for select using (true);
create policy "lectura publica" on fixtures      for select using (true);
create policy "lectura publica" on fixture_stats for select using (true);
create policy "lectura publica" on odds          for select using (true);
-- api_requests no tiene política: la app no puede leerla.

insert into leagues (id, name, country) values
  (140, 'La Liga', 'Spain'),
  (39,  'Premier League', 'England'),
  (135, 'Serie A', 'Italy'),
  (78,  'Bundesliga', 'Germany'),
  (61,  'Ligue 1', 'France'),
  (2,   'UEFA Champions League', 'World');
