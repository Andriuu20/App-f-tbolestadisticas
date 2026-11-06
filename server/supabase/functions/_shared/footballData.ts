// Lectura de los CSV gratuitos de football-data.co.uk (resultados, cuotas de Bet365, córners y tarjetas).
// Históricos: https://football-data.co.uk/mmz4281/<temporada>/<liga>.csv (ej.: 2627/SP1.csv)
// Próximos partidos de todas las ligas: https://football-data.co.uk/fixtures.csv

export interface FdRow {
  league: string;          // SP1, E0, I1, D1, F1...
  kickoff: string;         // ISO en UTC
  date: string;            // AAAA-MM-DD (fecha local británica, para la clave)
  home: string;
  away: string;
  referee?: string;
  homeGoals?: number;      // sin goles = partido aún por jugar
  awayGoals?: number;
  homeGoalsHt?: number;
  awayGoalsHt?: number;
  shots?: [number, number];
  shotsOnTarget?: [number, number];
  corners?: [number, number];
  yellows?: [number, number];
  reds?: [number, number];
  /** Cuotas de Bet365 y la media del mercado. */
  odds: { home?: number; draw?: number; away?: number; over25?: number; under25?: number;
    avgHome?: number; avgDraw?: number; avgAway?: number; avgOver25?: number; avgUnder25?: number };
}

const num = (v: string | undefined) => (v && v.trim() !== '' && !isNaN(Number(v)) ? Number(v) : undefined);

/** Las horas de football-data están en hora británica; esto las pasa a UTC (con horario de verano). */
export function londonToUtc(y: number, m: number, d: number, hh: number, mm: number): Date {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(guess));
  const p = Object.fromEntries(parts.map((x) => [x.type, Number(x.value)]));
  const localAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return new Date(guess - (localAsUtc - guess));
}

export function parseFootballData(csv: string): FdRow[] {
  const lines = csv.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const header = lines[0].split(',');
  const out: FdRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(',');
    const r = Object.fromEntries(header.map((h, i) => [h, cells[i]]));
    if (!r.Div || !r.Date || !r.HomeTeam || !r.AwayTeam) continue;
    const [d, m, y] = r.Date.split('/').map(Number);
    const year = y < 100 ? 2000 + y : y;
    const [hh, mm] = (r.Time || '15:00').split(':').map(Number);
    const pair = (a?: string, b?: string): [number, number] | undefined =>
      num(a) !== undefined && num(b) !== undefined ? [num(a)!, num(b)!] : undefined;
    out.push({
      league: r.Div,
      kickoff: londonToUtc(year, m, d, hh, mm).toISOString(),
      date: `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      home: r.HomeTeam.trim(), away: r.AwayTeam.trim(),
      referee: r.Referee?.trim() || undefined,
      homeGoals: num(r.FTHG), awayGoals: num(r.FTAG),
      homeGoalsHt: num(r.HTHG), awayGoalsHt: num(r.HTAG),
      shots: pair(r.HS, r.AS), shotsOnTarget: pair(r.HST, r.AST),
      corners: pair(r.HC, r.AC), yellows: pair(r.HY, r.AY), reds: pair(r.HR, r.AR),
      odds: {
        home: num(r.B365H), draw: num(r.B365D), away: num(r.B365A),
        over25: num(r['B365>2.5']), under25: num(r['B365<2.5']),
        avgHome: num(r.AvgH), avgDraw: num(r.AvgD), avgAway: num(r.AvgA),
        avgOver25: num(r['Avg>2.5']), avgUnder25: num(r['Avg<2.5']),
      },
    });
  }
  return out;
}
