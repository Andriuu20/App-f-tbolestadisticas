// Textos y cálculos de las apuestas recomendadas. Sin nada de diseño.
import type { Tier } from '../data/supabase';

export const TIER_INFO: Record<Tier, { title: string; range: string }> = {
  segura: { title: 'SEGURA', range: 'cuota 1,30-1,60' },
  media: { title: 'MEDIA', range: 'cuota 1,80-2,50' },
  arriesgada: { title: 'ARRIESGADA', range: 'cuota 4,00-10,00' },
};

/** Resultado en partidos pasados (docs/backtest-recomendaciones.txt, 12.901 partidos 2019-2026). */
export const PAST_RESULTS: Record<Tier, { hit: number; profit: number }> = {
  segura: { hit: 0.66, profit: -0.031 },
  media: { hit: 0.447, profit: -0.055 },
  arriesgada: { hit: 0.177, profit: -0.11 },
};

/** "Fallas ~3 de cada 10". */
export const failsOutOf10 = (prob: number) => Math.round((1 - prob) * 10);

/** Lo que se recibe si se acierta (apuesta incluida). */
export const payout = (stake: number, odd: number) => stake * odd;

export const euros = (x: number) => `${x.toFixed(2).replace('.', ',')} €`;

/** Resumen del historial por nivel: aciertos y beneficio apostando 1 € a cada una. */
export function summarize(items: { tier: Tier; won: boolean | null; odd: number }[]) {
  const out = {} as Record<Tier, { n: number; won: number; profit: number }>;
  for (const t of ['segura', 'media', 'arriesgada'] as Tier[]) out[t] = { n: 0, won: 0, profit: 0 };
  for (const r of items) {
    if (r.won === null) continue;
    const s = out[r.tier];
    s.n++;
    if (r.won) { s.won++; s.profit += r.odd - 1; } else s.profit -= 1;
  }
  return out;
}
