// Tipos mínimos compartidos. `Sql` es la función de consulta de postgres.js.
// deno-lint-ignore no-explicit-any
export type Sql = (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>;

export type Fetch = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  status: number;
  json(): Promise<unknown>;
}>;
