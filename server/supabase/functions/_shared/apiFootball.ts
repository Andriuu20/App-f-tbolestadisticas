import type { Fetch, Sql } from './types.ts';

const BASE_URL = 'https://v3.football.api-sports.io';

export interface ApiFootballOptions {
  sql: Sql;
  fetch: Fetch;
  apiKey: string;
  /** Tope de consultas al día (el plan gratis permite 100; dejamos margen). */
  dailyBudget: number;
  /** Espera mínima entre consultas, en ms (plan gratis: máx. 10 por minuto). */
  minIntervalMs: number;
}

export class BudgetExceededError extends Error {}

interface ApiResponse<T> {
  errors: unknown;
  results: number;
  paging?: { current: number; total: number };
  response: T;
}

/** Cliente de API-Football que apunta cada consulta en `api_requests` y respeta los límites. */
export class ApiFootball {
  private lastCallAt = 0;
  private readonly opts: ApiFootballOptions;
  constructor(opts: ApiFootballOptions) {
    this.opts = opts;
  }

  /** Consultas hechas hoy (el contador de API-Football se reinicia a las 00:00 UTC). */
  async usedToday(): Promise<number> {
    const [row] = await this.opts.sql`
      select count(*)::int as n from api_requests
      where called_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'`;
    return row.n;
  }

  async remainingToday(): Promise<number> {
    return Math.max(0, this.opts.dailyBudget - (await this.usedToday()));
  }

  async get<T>(endpoint: string, params: Record<string, string | number>): Promise<T> {
    if ((await this.remainingToday()) <= 0) {
      throw new BudgetExceededError(`Tope diario de ${this.opts.dailyBudget} consultas alcanzado`);
    }
    const wait = this.lastCallAt + this.opts.minIntervalMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastCallAt = Date.now();

    const query = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)]),
    ).toString();
    let body: ApiResponse<T> | undefined;
    let error: string | null = null;
    try {
      const res = await this.opts.fetch(`${BASE_URL}${endpoint}?${query}`, {
        headers: { 'x-apisports-key': this.opts.apiKey },
      });
      body = (await res.json()) as ApiResponse<T>;
      if (res.status !== 200) error = `HTTP ${res.status}`;
      // API-Football devuelve los errores en `errors` (lista vacía u objeto).
      const errs = body.errors;
      if (errs && (Array.isArray(errs) ? errs.length > 0 : Object.keys(errs).length > 0)) {
        error = JSON.stringify(errs);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    await this.opts.sql`
      insert into api_requests (endpoint, params, ok, error, results)
      values (${endpoint}, ${JSON.stringify(params)}::text::jsonb, ${error === null}, ${error},
              ${body?.results ?? null})`;
    if (error !== null || !body) throw new Error(`API-Football ${endpoint}: ${error}`);
    return body.response;
  }
}
