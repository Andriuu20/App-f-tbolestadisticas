// Lectura de los CSV gratuitos de football-data.co.uk (resultados + cuotas de Bet365 + córners y tarjetas).
// Descarga: https://football-data.co.uk/mmz4281/<temporada>/<liga>.csv  (ej.: 2425/SP1.csv)
import { readFileSync } from 'node:fs';
import type { PastMatch } from '../supabase/functions/_shared/model/index.ts';

export interface FdMatch extends PastMatch {
  league: string;
  home: string;
  away: string;
  /** Cuotas de Bet365 antes del partido y de cierre (justo antes de empezar). */
  odds: {
    home?: number; draw?: number; away?: number; over25?: number; under25?: number;
    homeClose?: number; drawClose?: number; awayClose?: number;
  };
  corners?: [number, number];
  yellows?: [number, number];
  reds?: [number, number];
}

const num = (v: string | undefined) => (v && v.trim() !== '' && !isNaN(Number(v)) ? Number(v) : undefined);

export function readFootballData(files: string[]): FdMatch[] {
  const ids = new Map<string, number>();
  const id = (name: string) => {
    if (!ids.has(name)) ids.set(name, ids.size + 1);
    return ids.get(name)!;
  };
  const out: FdMatch[] = [];
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
    const header = lines[0].split(',');
    for (const line of lines.slice(1)) {
      const cells = line.split(',');
      const r = Object.fromEntries(header.map((h, i) => [h, cells[i]]));
      const hg = num(r.FTHG), ag = num(r.FTAG);
      if (hg === undefined || ag === undefined || !r.Date) continue;
      const [d, m, y] = r.Date.split('/');
      const year = y.length === 2 ? `20${y}` : y;
      const pair = (a?: string, b?: string): [number, number] | undefined =>
        num(a) !== undefined && num(b) !== undefined ? [num(a)!, num(b)!] : undefined;
      out.push({
        league: r.Div, home: r.HomeTeam, away: r.AwayTeam,
        date: `${year}-${m}-${d}T${r.Time || '15:00'}:00Z`,
        homeId: id(r.HomeTeam), awayId: id(r.AwayTeam), homeGoals: hg, awayGoals: ag,
        homeShotsOnTarget: num(r.HST) ?? null, awayShotsOnTarget: num(r.AST) ?? null,
        odds: {
          home: num(r.B365H), draw: num(r.B365D), away: num(r.B365A),
          over25: num(r['B365>2.5']), under25: num(r['B365<2.5']),
          homeClose: num(r.B365CH), drawClose: num(r.B365CD), awayClose: num(r.B365CA),
        },
        corners: pair(r.HC, r.AC), yellows: pair(r.HY, r.AY), reds: pair(r.HR, r.AR),
      });
    }
  }
  return out.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}
