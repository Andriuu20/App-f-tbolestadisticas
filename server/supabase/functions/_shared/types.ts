// Tipos mínimos compartidos. `Sql` es la función de consulta de postgres.js.
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Sql {
  // deno-lint-ignore no-explicit-any
  (strings: TemplateStringsArray, ...values: any[]): Promise<any[]>;
  /** Ayudante de postgres.js para insertar varias filas o listas: sql(filas, ...columnas). */
  // deno-lint-ignore no-explicit-any
  (value: any, ...columns: string[]): any;
}

export type Fetch = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;
