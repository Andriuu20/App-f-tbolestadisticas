// Lectura de datos desde nuestro servidor (Supabase). La app nunca llama a la API de fútbol.
// La clave "publishable" es pública por diseño: solo permite leer (las tablas no dejan escribir).
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};
const URL_BASE = `${extra.supabaseUrl}/rest/v1`;
const KEY: string = extra.supabasePublishableKey;

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${URL_BASE}/${path}`, { headers: { apikey: KEY } });
  if (!res.ok) throw new Error(`Error ${res.status} al leer ${path.split('?')[0]}`);
  return (await res.json()) as T;
}

export interface MatchCard {
  id: number;
  kickoff: string;
  status: string;
  league_id: number;
  league_name: string;
  round: string | null;
  referee: string | null;
  home_id: number;
  home_name: string;
  home_goals: number | null;
  away_id: number;
  away_name: string;
  away_goals: number | null;
  model: string | null;
  lambda_home: number | null;
  lambda_away: number | null;
  p_home: number | null;
  p_draw: number | null;
  p_away: number | null;
  p_over25: number | null;
  p_btts: number | null;
  corners_avg: number | null;
  cards_avg: number | null;
  odd_home: number | null;
  odd_draw: number | null;
  odd_away: number | null;
}

export interface RecentStats {
  matches: number;
  over: Record<string, number>;
  btts: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  form: ('V' | 'E' | 'D')[];
  cornersAvg: number | null;
  yellowsAvg: number | null;
  home: Omit<RecentStats, 'home' | 'away' | 'cornersAvg' | 'yellowsAvg'>;
  away: Omit<RecentStats, 'home' | 'away' | 'cornersAvg' | 'yellowsAvg'>;
}

export interface Prediction {
  fixture_id: number;
  model: string;
  computed_at: string;
  markets: {
    lambdaHome: number;
    lambdaAway: number;
    home: number;
    draw: number;
    away: number;
    homeOrDraw: number;
    homeOrAway: number;
    drawOrAway: number;
    btts: number;
    over: Record<string, number>;
    homeOver: Record<string, number>;
    awayOver: Record<string, number>;
    topScores: { home: number; away: number; p: number }[];
  };
  home_recent: RecentStats;
  away_recent: RecentStats;
}

export interface Odd { bookmaker: string; market: string; selection: string; odd: number }

const num = (x: unknown) => (x === null || x === undefined ? null : Number(x));
const normalize = (m: MatchCard): MatchCard => ({
  ...m,
  lambda_home: num(m.lambda_home), lambda_away: num(m.lambda_away),
  p_home: num(m.p_home), p_draw: num(m.p_draw), p_away: num(m.p_away),
  p_over25: num(m.p_over25), p_btts: num(m.p_btts),
  corners_avg: num(m.corners_avg), cards_avg: num(m.cards_avg),
  odd_home: num(m.odd_home), odd_draw: num(m.odd_draw), odd_away: num(m.odd_away),
});

/** Partidos entre dos instantes (ISO), opcionalmente de una liga. */
export async function getMatches(fromIso: string, toIso: string, leagueId?: number): Promise<MatchCard[]> {
  const league = leagueId ? `&league_id=eq.${leagueId}` : '';
  const rows = await get<MatchCard[]>(
    `match_cards?select=*&kickoff=gte.${encodeURIComponent(fromIso)}&kickoff=lt.${encodeURIComponent(toIso)}${league}&order=kickoff,league_id`,
  );
  return rows.map(normalize);
}

export async function getMatch(id: number): Promise<{ card: MatchCard; prediction: Prediction | null; odds: Odd[] }> {
  const [cards, preds, odds] = await Promise.all([
    get<MatchCard[]>(`match_cards?select=*&id=eq.${id}`),
    get<Prediction[]>(`predictions?select=*&fixture_id=eq.${id}`),
    get<Odd[]>(`odds?select=bookmaker,market,selection,odd&fixture_id=eq.${id}`),
  ]);
  if (!cards[0]) throw new Error('Partido no encontrado');
  return { card: normalize(cards[0]), prediction: preds[0] ?? null, odds: odds.map((o) => ({ ...o, odd: Number(o.odd) })) };
}

/** Últimos enfrentamientos directos entre dos equipos (en cualquier campo). */
export async function getHeadToHead(a: number, b: number, before: string): Promise<MatchCard[]> {
  const rows = await get<MatchCard[]>(
    `match_cards?select=*&or=(and(home_id.eq.${a},away_id.eq.${b}),and(home_id.eq.${b},away_id.eq.${a}))` +
      `&status=eq.FT&kickoff=lt.${encodeURIComponent(before)}&order=kickoff.desc&limit=10`,
  );
  return rows.map(normalize);
}

/** Medias de córners y tarjetas de un partido jugado (para el H2H). */
export async function getStats(fixtureIds: number[]) {
  if (!fixtureIds.length) return [];
  return await get<{ fixture_id: number; team_id: number; corners: number | null; yellow_cards: number | null }[]>(
    `fixture_stats?select=fixture_id,team_id,corners,yellow_cards&fixture_id=in.(${fixtureIds.join(',')})`,
  );
}
