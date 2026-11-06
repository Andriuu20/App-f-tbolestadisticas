import { ApiFootball, BudgetExceededError } from './apiFootball.ts';
import type { Sql } from './types.ts';

// --- Formas de las respuestas de API-Football (solo los campos que usamos) ---
interface ApiTeam { id: number; name: string; logo: string }
interface ApiFixture {
  fixture: {
    id: number; date: string; referee: string | null;
    status: { short: string }; venue: { name: string | null };
  };
  league: { id: number; name: string; country: string; logo: string; season: number; round: string };
  teams: { home: ApiTeam; away: ApiTeam };
  goals: { home: number | null; away: number | null };
  score: { halftime: { home: number | null; away: number | null } };
}
interface ApiTeamStats {
  team: { id: number };
  statistics: { type: string; value: number | string | null }[];
}
interface ApiOdds {
  bookmakers: { name: string; bets: { name: string; values: { value: string; odd: string }[] }[] }[];
}

const FINISHED = ['FT', 'AET', 'PEN'];

/** Mercados de cuotas que guardamos (el resto no los usa la app). */
export const ODDS_MARKETS = new Set([
  'Match Winner', 'Double Chance', 'Both Teams Score', 'Goals Over/Under',
  'Goals Over/Under First Half', 'Asian Handicap', 'Corners Over Under',
  'Cards Over/Under', 'Home Team Total Goals', 'Away Team Total Goals',
]);

export interface SyncReport {
  calls: number;
  fixtures: number;
  stats: number;
  odds: number;
  stoppedByBudget: boolean;
  notes: string[];
}

export class Sync {
  readonly report: SyncReport = { calls: 0, fixtures: 0, stats: 0, odds: 0, stoppedByBudget: false, notes: [] };
  private readonly sql: Sql;
  private readonly api: ApiFootball;
  constructor(sql: Sql, api: ApiFootball) {
    this.sql = sql;
    this.api = api;
  }

  private async call<T>(endpoint: string, params: Record<string, string | number>): Promise<T> {
    this.report.calls++;
    return await this.api.get<T>(endpoint, params);
  }

  private async activeLeagueIds(): Promise<Set<number>> {
    const rows = await this.sql`select id from leagues where active`;
    return new Set(rows.map((r) => r.id as number));
  }

  /** Guarda partidos (y sus equipos). Devuelve cuántos se guardaron. */
  async saveFixtures(items: ApiFixture[], onlyActive = true): Promise<number> {
    const active = onlyActive ? await this.activeLeagueIds() : null;
    let n = 0;
    for (const f of items) {
      if (active && !active.has(f.league.id)) continue;
      // Una liga nueva se añade inactiva: así no entra en la sincronización diaria.
      await this.sql`
        insert into leagues (id, name, country, logo, active)
        values (${f.league.id}, ${f.league.name}, ${f.league.country}, ${f.league.logo}, false)
        on conflict (id) do update set
          name = excluded.name, country = excluded.country, logo = excluded.logo`;
      for (const t of [f.teams.home, f.teams.away]) {
        await this.sql`
          insert into teams (id, name, logo) values (${t.id}, ${t.name}, ${t.logo})
          on conflict (id) do update set name = excluded.name, logo = excluded.logo`;
      }
      await this.sql`
        insert into fixtures (id, league_id, season, round, kickoff, status, home_id, away_id,
          home_goals, away_goals, home_goals_ht, away_goals_ht, referee, venue, raw, updated_at)
        values (${f.fixture.id}, ${f.league.id}, ${f.league.season}, ${f.league.round},
          ${f.fixture.date}, ${f.fixture.status.short}, ${f.teams.home.id}, ${f.teams.away.id},
          ${f.goals.home}, ${f.goals.away}, ${f.score.halftime.home}, ${f.score.halftime.away},
          ${f.fixture.referee}, ${f.fixture.venue.name}, ${JSON.stringify(f)}::text::jsonb, now())
        on conflict (id) do update set
          season = excluded.season, round = excluded.round, kickoff = excluded.kickoff,
          status = excluded.status, home_goals = excluded.home_goals, away_goals = excluded.away_goals,
          home_goals_ht = excluded.home_goals_ht, away_goals_ht = excluded.away_goals_ht,
          referee = excluded.referee, venue = excluded.venue, raw = excluded.raw, updated_at = now()`;
      n++;
    }
    this.report.fixtures += n;
    return n;
  }

  /** Partidos de un día (plan gratis: solo ayer, hoy y mañana). 1 consulta. */
  async syncDate(date: string): Promise<number> {
    const items = await this.call<ApiFixture[]>('/fixtures', { date });
    return await this.saveFixtures(items);
  }

  /** Temporada completa de una liga (plan gratis: 2022-2024). 1 consulta. */
  async syncSeason(league: number, season: number): Promise<number> {
    const items = await this.call<ApiFixture[]>('/fixtures', { league, season });
    return await this.saveFixtures(items, false);
  }

  /** Estadísticas de un partido terminado (córners, tarjetas...). 1 consulta. */
  async syncStats(fixtureId: number): Promise<void> {
    const items = await this.call<ApiTeamStats[]>('/fixtures/statistics', { fixture: fixtureId });
    if (items.length === 0) {
      // Sin datos (pasa en algunos partidos): guardamos filas vacías para no volver a pedirlas.
      this.report.notes.push(`Partido ${fixtureId} sin estadísticas`);
    }
    const [fx] = await this.sql`select home_id, away_id from fixtures where id = ${fixtureId}`;
    const teams = items.length ? items : [fx.home_id, fx.away_id].map((id) => ({ team: { id }, statistics: [] }));
    for (const t of teams) {
      const s = new Map(t.statistics.map((x) => [x.type, x.value]));
      const int = (k: string) => {
        const v = s.get(k);
        if (v === null || v === undefined) return k === 'Red Cards' || k === 'Yellow Cards' ? (items.length ? 0 : null) : null;
        return typeof v === 'number' ? v : parseInt(String(v), 10);
      };
      const xg = s.get('expected_goals');
      await this.sql`
        insert into fixture_stats (fixture_id, team_id, corners, yellow_cards, red_cards, shots,
          shots_on_target, possession, xg, raw, updated_at)
        values (${fixtureId}, ${t.team.id}, ${int('Corner Kicks')}, ${int('Yellow Cards')},
          ${int('Red Cards')}, ${int('Total Shots')}, ${int('Shots on Goal')}, ${int('Ball Possession')},
          ${xg === null || xg === undefined ? null : Number(xg)}, ${JSON.stringify(t)}::text::jsonb, now())
        on conflict (fixture_id, team_id) do update set
          corners = excluded.corners, yellow_cards = excluded.yellow_cards, red_cards = excluded.red_cards,
          shots = excluded.shots, shots_on_target = excluded.shots_on_target,
          possession = excluded.possession, xg = excluded.xg, raw = excluded.raw, updated_at = now()`;
    }
    this.report.stats++;
  }

  /** Cuotas de un partido. 1 consulta. */
  async syncOdds(fixtureId: number): Promise<void> {
    const items = await this.call<ApiOdds[]>('/odds', { fixture: fixtureId });
    let rows = 0;
    for (const book of items[0]?.bookmakers ?? []) {
      for (const bet of book.bets) {
        if (!ODDS_MARKETS.has(bet.name)) continue;
        for (const v of bet.values) {
          await this.sql`
            insert into odds (fixture_id, bookmaker, market, selection, odd, fetched_at)
            values (${fixtureId}, ${book.name}, ${bet.name}, ${v.value}, ${Number(v.odd)}, now())
            on conflict (fixture_id, bookmaker, market, selection) do update set
              odd = excluded.odd, fetched_at = now()`;
          rows++;
        }
      }
    }
    if (rows === 0) {
      // Marca para no repetir la consulta enseguida si aún no hay cuotas.
      await this.sql`
        insert into odds (fixture_id, bookmaker, market, selection, odd, fetched_at)
        values (${fixtureId}, '-', '-', 'sin cuotas', 0, now())
        on conflict (fixture_id, bookmaker, market, selection) do update set fetched_at = now()`;
      this.report.notes.push(`Partido ${fixtureId} sin cuotas todavía`);
    }
    this.report.odds++;
  }

  /** ¿Hace falta volver a pedir los partidos de esta fecha? */
  private async dateIsStale(date: string, maxAgeHours: number): Promise<boolean> {
    const [row] = await this.sql`
      select max(called_at) as last from api_requests
      where endpoint = '/fixtures' and ok and params->>'date' = ${date}`;
    return !row.last || Date.now() - new Date(row.last).getTime() > maxAgeHours * 3600_000;
  }

  /**
   * Sincronización automática (pensada para ejecutarse cada 30 min):
   * 1. Partidos de ayer, hoy y mañana si los datos están viejos.
   * 2. Estadísticas de partidos terminados que aún no las tienen (los más recientes primero).
   * 3. Cuotas de los partidos de las próximas 36 h que no se han actualizado en 6 h.
   */
  async auto(maxCalls: number, now = new Date()): Promise<SyncReport> {
    const day = (offset: number) => new Date(now.getTime() + offset * 86400_000).toISOString().slice(0, 10);
    const left = () => maxCalls - this.report.calls;
    try {
      for (const [date, maxAge] of [[day(0), 2], [day(-1), 6], [day(1), 6]] as const) {
        if (left() <= 0) break;
        if (await this.dateIsStale(date, maxAge)) await this.syncDate(date);
      }
      const needStats = await this.sql`
        select f.id from fixtures f join leagues l on l.id = f.league_id and l.active
        where f.status in ${this.sqlList(FINISHED)}
          and not exists (select 1 from fixture_stats s where s.fixture_id = f.id)
        order by f.kickoff desc limit ${Math.max(0, Math.ceil(left() / 2))}`;
      for (const r of needStats) {
        if (left() <= 0) break;
        await this.syncStats(r.id);
      }
      const needOdds = await this.sql`
        select f.id from fixtures f join leagues l on l.id = f.league_id and l.active
        where f.status = 'NS' and f.kickoff between ${now.toISOString()} and ${new Date(now.getTime() + 36 * 3600_000).toISOString()}
          and coalesce((select max(o.fetched_at) from odds o where o.fixture_id = f.id), 'epoch') < now() - interval '6 hours'
        order by f.kickoff limit ${Math.max(0, left())}`;
      for (const r of needOdds) {
        if (left() <= 0) break;
        await this.syncOdds(r.id);
      }
    } catch (e) {
      if (!(e instanceof BudgetExceededError)) throw e;
      this.report.stoppedByBudget = true;
    }
    return this.report;
  }

  /** Estadísticas atrasadas de temporadas antiguas (para probar el modelo). */
  async backfillStats(maxCalls: number, season?: number): Promise<SyncReport> {
    try {
      const rows = await this.sql`
        select f.id from fixtures f
        where f.status in ${this.sqlList(FINISHED)}
          and (${season ?? null}::int is null or f.season = ${season ?? null}::int)
          and not exists (select 1 from fixture_stats s where s.fixture_id = f.id)
        order by f.kickoff desc limit ${maxCalls}`;
      for (const r of rows) await this.syncStats(r.id);
    } catch (e) {
      if (!(e instanceof BudgetExceededError)) throw e;
      this.report.stoppedByBudget = true;
    }
    return this.report;
  }

  // Lista para `in (...)`: postgres.js la expande con sql(array).
  private sqlList(values: string[]) {
    return (this.sql as unknown as { (v: string[]): unknown })(values);
  }
}
