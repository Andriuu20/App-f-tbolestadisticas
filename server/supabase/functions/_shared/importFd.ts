// Importa football-data.co.uk a la base de datos y calcula las predicciones de los próximos partidos.
import type { FdRow } from './footballData.ts';
import { recommend, settle } from './recommend.ts';
import {
  CARD_LINES, CORNER_LINES, expectedCounts, historicalRates, overProbabilities, predictGoals,
  type CountMatch, type PastMatch,
} from './model/index.ts';
import type { Sql } from './types.ts';

export const MODEL_VERSION = 'goles-v2';
/** Ajustes elegidos con el backtest (scripts/backtest.ts). */
/** Córners y amarillas: ajustes elegidos con scripts/backtest-corners.ts (docs/backtest-corners.txt). */
export const COUNT_OPTIONS = { halfLifeDays: 180, priorMatches: 10, dispersion: 40 };
export const MODEL_OPTIONS = {
  version: 'v2' as const, halfLifeDays: 365, priorMatches: 5, promotedStrength: 0.8, goalsWeight: 0.5, rho: -0.1,
};

const key = (r: FdRow) => `fd:${r.league}:${r.date}:${r.home}:${r.away}`;

/** Devuelve el id de cada equipo, creándolo si es la primera vez que aparece. */
async function teamIds(sql: Sql, names: string[]): Promise<Map<string, number>> {
  const ids = new Map<string, number>();
  for (const r of await sql`select name, team_id from team_aliases where source = 'football-data'`) {
    ids.set(r.name, r.team_id);
  }
  for (const name of new Set(names)) {
    if (ids.has(name)) continue;
    const [t] = await sql`insert into teams (id, name) values (nextval('fd_team_ids'), ${name}) returning id`;
    await sql`insert into team_aliases (source, name, team_id) values ('football-data', ${name}, ${t.id})`;
    ids.set(name, t.id);
  }
  return ids;
}

const chunks = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

export interface ImportReport { fixtures: number; stats: number; odds: number; skipped: number }

/** Guarda partidos (jugados y por jugar) con sus estadísticas y cuotas. */
export async function importRows(sql: Sql, rows: FdRow[]): Promise<ImportReport> {
  const leagues = new Map<string, number>();
  for (const l of await sql`select id, fd_code from leagues where fd_code is not null`) leagues.set(l.fd_code, l.id);
  const known = rows.filter((r) => leagues.has(r.league));
  const ids = await teamIds(sql, known.flatMap((r) => [r.home, r.away]));
  const report: ImportReport = { fixtures: 0, stats: 0, odds: 0, skipped: rows.length - known.length };

  for (const part of chunks(known, 400)) {
    const fx = part.map((r) => {
      const played = r.homeGoals !== undefined && r.awayGoals !== undefined;
      const k = new Date(r.kickoff);
      const season = k.getUTCMonth() >= 6 ? k.getUTCFullYear() : k.getUTCFullYear() - 1;
      return {
        external_key: key(r), source: 'football-data', league_id: leagues.get(r.league)!, season,
        kickoff: r.kickoff, status: played ? 'FT' : 'NS',
        home_id: ids.get(r.home)!, away_id: ids.get(r.away)!,
        home_goals: r.homeGoals ?? null, away_goals: r.awayGoals ?? null,
        home_goals_ht: r.homeGoalsHt ?? null, away_goals_ht: r.awayGoalsHt ?? null,
        referee: r.referee ?? null,
      };
    });
    const saved = await sql`
      insert into fixtures ${sql(fx, 'external_key', 'source', 'league_id', 'season', 'kickoff', 'status',
        'home_id', 'away_id', 'home_goals', 'away_goals', 'home_goals_ht', 'away_goals_ht', 'referee')}
      on conflict (external_key) do update set
        kickoff = excluded.kickoff, status = excluded.status,
        home_goals = excluded.home_goals, away_goals = excluded.away_goals,
        home_goals_ht = excluded.home_goals_ht, away_goals_ht = excluded.away_goals_ht,
        referee = coalesce(excluded.referee, fixtures.referee), updated_at = now()
      returning id, external_key`;
    report.fixtures += saved.length;
    const idOf = new Map(saved.map((s) => [s.external_key as string, s.id as number]));

    const stats = part.flatMap((r) => {
      if (!r.corners && !r.yellows && !r.shots) return [];
      const id = idOf.get(key(r))!;
      return ([0, 1] as const).map((i) => ({
        fixture_id: id, team_id: ids.get(i === 0 ? r.home : r.away)!,
        corners: r.corners?.[i] ?? null, yellow_cards: r.yellows?.[i] ?? null, red_cards: r.reds?.[i] ?? null,
        shots: r.shots?.[i] ?? null, shots_on_target: r.shotsOnTarget?.[i] ?? null,
      }));
    });
    if (stats.length) {
      await sql`
        insert into fixture_stats ${sql(stats, 'fixture_id', 'team_id', 'corners', 'yellow_cards', 'red_cards', 'shots', 'shots_on_target')}
        on conflict (fixture_id, team_id) do update set
          corners = excluded.corners, yellow_cards = excluded.yellow_cards, red_cards = excluded.red_cards,
          shots = excluded.shots, shots_on_target = excluded.shots_on_target, updated_at = now()`;
      report.stats += stats.length;
    }

    const odds = part.flatMap((r) => {
      const id = idOf.get(key(r))!;
      const o = r.odds;
      const list: [string, string, string, number | undefined][] = [
        ['Bet365', 'Match Winner', 'Home', o.home], ['Bet365', 'Match Winner', 'Draw', o.draw],
        ['Bet365', 'Match Winner', 'Away', o.away],
        ['Bet365', 'Goals Over/Under', 'Over 2.5', o.over25], ['Bet365', 'Goals Over/Under', 'Under 2.5', o.under25],
        ['Media', 'Match Winner', 'Home', o.avgHome], ['Media', 'Match Winner', 'Draw', o.avgDraw],
        ['Media', 'Match Winner', 'Away', o.avgAway],
        ['Media', 'Goals Over/Under', 'Over 2.5', o.avgOver25], ['Media', 'Goals Over/Under', 'Under 2.5', o.avgUnder25],
      ];
      return list.filter(([, , , odd]) => odd && odd > 1)
        .map(([bookmaker, market, selection, odd]) => ({ fixture_id: id, bookmaker, market, selection, odd: odd! }));
    });
    if (odds.length) {
      await sql`
        insert into odds ${sql(odds, 'fixture_id', 'bookmaker', 'market', 'selection', 'odd')}
        on conflict (fixture_id, bookmaker, market, selection) do update set odd = excluded.odd, fetched_at = now()`;
      report.odds += odds.length;
    }
  }
  // Partidos aplazados: el que no se jugó y ya pasó hace días se borra (vuelve con su nueva fecha).
  await sql`delete from fixtures where source = 'football-data' and status = 'NS' and kickoff < now() - interval '3 days'`;
  return report;
}

/** Calcula y guarda las predicciones de los partidos por jugar de los próximos `days` días. */
export async function computePredictions(sql: Sql, now = new Date(), days = 8): Promise<number> {
  const until = new Date(now.getTime() + days * 86400_000);
  const upcoming = await sql`
    select id, league_id, kickoff, home_id, away_id from fixtures
    where status = 'NS' and kickoff between ${new Date(now.getTime() - 3 * 3600_000)} and ${until}`;
  if (upcoming.length === 0) return 0;

  const byLeague = new Map<number, PastMatch[]>();
  const cornersByLeague = new Map<number, CountMatch[]>();
  const yellowsByLeague = new Map<number, CountMatch[]>();
  const statsByTeam = new Map<number, { kickoff: number; corners: number | null; yellows: number | null }[]>();
  for (const leagueId of new Set(upcoming.map((u) => u.league_id as number))) {
    const past = await sql`
      select f.id, f.kickoff, f.home_id, f.away_id, f.home_goals, f.away_goals,
        (select sum(s.corners) from fixture_stats s where s.fixture_id = f.id) as corners,
        (select sum(s.yellow_cards) from fixture_stats s where s.fixture_id = f.id) as yellows,
        hs.shots_on_target as home_sot, aws.shots_on_target as away_sot,
        hs.corners as home_corners, aws.corners as away_corners,
        hs.yellow_cards as home_yellows, aws.yellow_cards as away_yellows
      from fixtures f
      left join fixture_stats hs on hs.fixture_id = f.id and hs.team_id = f.home_id
      left join fixture_stats aws on aws.fixture_id = f.id and aws.team_id = f.away_id
      where f.league_id = ${leagueId} and f.status in ('FT', 'AET', 'PEN')
        and f.kickoff > ${new Date(now.getTime() - 800 * 86400_000)}`;
    const toCounts = (h: string, a: string): CountMatch[] => past.map((p) => ({
      date: p.kickoff, homeId: p.home_id, awayId: p.away_id, home: p[h], away: p[a],
    }));
    cornersByLeague.set(leagueId, toCounts('home_corners', 'away_corners'));
    yellowsByLeague.set(leagueId, toCounts('home_yellows', 'away_yellows'));
    byLeague.set(leagueId, past.map((p) => ({
      date: p.kickoff, homeId: p.home_id, awayId: p.away_id, homeGoals: p.home_goals, awayGoals: p.away_goals,
      homeShotsOnTarget: p.home_sot, awayShotsOnTarget: p.away_sot,
    })));
    for (const p of past) {
      for (const t of [p.home_id, p.away_id]) {
        const list = statsByTeam.get(t) ?? [];
        list.push({ kickoff: new Date(p.kickoff).getTime(), corners: p.corners === null ? null : Number(p.corners),
          yellows: p.yellows === null ? null : Number(p.yellows) });
        statsByTeam.set(t, list);
      }
    }
  }
  // Media de córners/amarillas en los últimos 10 partidos de cada equipo, y la de los dos juntos.
  const avgOf = (teamId: number, before: number, field: 'corners' | 'yellows') => {
    const xs = (statsByTeam.get(teamId) ?? []).filter((s) => s.kickoff < before && s[field] !== null)
      .sort((a, b) => b.kickoff - a.kickoff).slice(0, 10).map((s) => s[field] as number);
    return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
  };
  const both = (a: number | null, b: number | null) => (a === null || b === null ? null : Math.round(((a + b) / 2) * 10) / 10);

  let saved = 0;
  for (const u of upcoming) {
    const matches = byLeague.get(u.league_id) ?? [];
    let p;
    try {
      p = predictGoals(matches, u.home_id, u.away_id, u.kickoff, MODEL_OPTIONS);
    } catch {
      continue; // liga sin historial todavía
    }
    const t = new Date(u.kickoff).getTime();
    const recent = (id: number) => ({
      ...historicalRates(matches, id, u.kickoff, { last: 10 }),
      home: historicalRates(matches, id, u.kickoff, { last: 10, venue: 'home' }),
      away: historicalRates(matches, id, u.kickoff, { last: 10, venue: 'away' }),
      cornersAvg: avgOf(id, t, 'corners'), yellowsAvg: avgOf(id, t, 'yellows'),
    });
    const home = recent(u.home_id), away = recent(u.away_id);
    // Córners y amarillas esperados y probabilidad de "más de X" (null si la liga no tiene esos datos).
    const countMarket = (list: CountMatch[] | undefined, lines: number[]) => {
      try {
        const e = expectedCounts(list ?? [], u.home_id, u.away_id, u.kickoff, COUNT_OPTIONS);
        return { home: e.home, away: e.away, total: e.total, over: overProbabilities(e.total, lines, COUNT_OPTIONS.dispersion) };
      } catch {
        return null;
      }
    };
    const markets = {
      ...p,
      corners: countMarket(cornersByLeague.get(u.league_id), CORNER_LINES),
      yellows: countMarket(yellowsByLeague.get(u.league_id), CARD_LINES),
    };
    const r4 = (x: number) => Math.round(x * 10000) / 10000;
    await sql`
      insert into predictions (fixture_id, model, computed_at, lambda_home, lambda_away, p_home, p_draw, p_away,
        p_over25, p_btts, corners_avg, cards_avg, markets, home_recent, away_recent)
      values (${u.id}, ${MODEL_VERSION}, now(), ${p.lambdaHome.toFixed(2)}, ${p.lambdaAway.toFixed(2)},
        ${r4(p.home)}, ${r4(p.draw)}, ${r4(p.away)}, ${r4(p.over[2.5])}, ${r4(p.btts)},
        ${both(home.cornersAvg, away.cornersAvg)}, ${both(home.yellowsAvg, away.yellowsAvg)},
        ${JSON.stringify(markets)}::text::jsonb, ${JSON.stringify(home)}::text::jsonb, ${JSON.stringify(away)}::text::jsonb)
      on conflict (fixture_id) do update set
        model = excluded.model, computed_at = now(), lambda_home = excluded.lambda_home,
        lambda_away = excluded.lambda_away, p_home = excluded.p_home, p_draw = excluded.p_draw,
        p_away = excluded.p_away, p_over25 = excluded.p_over25, p_btts = excluded.p_btts,
        corners_avg = excluded.corners_avg, cards_avg = excluded.cards_avg, markets = excluded.markets,
        home_recent = excluded.home_recent, away_recent = excluded.away_recent`;
    saved++;
  }
  return saved;
}

/**
 * Recalcula las recomendaciones de los partidos que aún no han empezado (las cuotas cambian) y
 * comprueba las de los partidos terminados. Una vez empezado el partido, la recomendación ya no cambia.
 */
export async function updateRecommendations(sql: Sql, now = new Date()): Promise<{ saved: number; settled: number }> {
  const upcoming = await sql`
    select f.id, h.name as home_name, a.name as away_name, p.p_home, p.p_draw, p.p_away, p.p_over25,
      p.home_recent, p.away_recent
    from fixtures f join predictions p on p.fixture_id = f.id
    join teams h on h.id = f.home_id join teams a on a.id = f.away_id
    where f.status = 'NS' and f.kickoff > ${now}`;
  let saved = 0;
  for (const u of upcoming) {
    const odds = (await sql`select bookmaker, market, selection, odd from odds where fixture_id = ${u.id}`)
      .map((o) => ({ ...o, odd: Number(o.odd) })) as { bookmaker: string; market: string; selection: string; odd: number }[];
    const recs = recommend(odds, {
      homeName: u.home_name, awayName: u.away_name,
      model: { home: Number(u.p_home), draw: Number(u.p_draw), away: Number(u.p_away), over25: Number(u.p_over25) },
      homeRecent: u.home_recent, awayRecent: u.away_recent,
    });
    const tiers = recs.map((r) => r.tier);
    await sql`delete from recommendations where fixture_id = ${u.id} and won is null
      and not (tier = any(${tiers}::text[]))`;
    for (const r of recs) {
      await sql`
        insert into recommendations (fixture_id, tier, market, selection, label, odd, prob, model_prob, reason, model, updated_at)
        values (${u.id}, ${r.tier}, ${r.market}, ${r.selection}, ${r.label}, ${r.odd}, ${r.prob.toFixed(4)},
          ${r.modelProb.toFixed(4)}, ${r.reason}, ${MODEL_VERSION}, now())
        on conflict (fixture_id, tier) do update set
          market = excluded.market, selection = excluded.selection, label = excluded.label, odd = excluded.odd,
          prob = excluded.prob, model_prob = excluded.model_prob, reason = excluded.reason,
          model = excluded.model, updated_at = now()`;
      saved++;
    }
  }
  const pending = await sql`
    select r.fixture_id, r.tier, r.market, r.selection, f.home_goals, f.away_goals
    from recommendations r join fixtures f on f.id = r.fixture_id
    where r.won is null and f.status in ('FT', 'AET', 'PEN') and f.home_goals is not null`;
  let settled = 0;
  for (const p of pending) {
    const won = settle(p.market, p.selection, p.home_goals, p.away_goals);
    if (won === null) continue;
    await sql`update recommendations set won = ${won}, settled_at = now()
      where fixture_id = ${p.fixture_id} and tier = ${p.tier}`;
    settled++;
  }
  return { saved, settled };
}
