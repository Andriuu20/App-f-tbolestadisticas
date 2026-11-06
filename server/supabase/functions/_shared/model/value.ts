// Comparar el modelo con las cuotas de la casa.

/** Probabilidad que implica una cuota (incluye el margen de la casa). */
export const impliedProbability = (odd: number) => 1 / odd;

/**
 * Probabilidades "justas" de un mercado completo (ej.: 1, X, 2) quitando el margen de la casa.
 * Método proporcional: se reparte el margen según la probabilidad de cada opción.
 */
export function fairProbabilities(odds: number[]): { probs: number[]; margin: number } {
  const implied = odds.map(impliedProbability);
  const total = implied.reduce((s, p) => s + p, 0);
  return { probs: implied.map((p) => p / total), margin: total - 1 };
}

export interface ValueCheck {
  modelProb: number;
  odd: number;
  /** Probabilidad justa según la casa (sin margen), si se conoce el mercado completo. */
  fairProb?: number;
  /** Beneficio esperado por cada euro apostado según el modelo (0.05 = +5 %). */
  expectedValue: number;
  /** El modelo cree que la apuesta paga más de lo que debería. */
  hasValue: boolean;
  /** Cuota mínima para que la apuesta no pierda dinero a largo plazo según el modelo. */
  minOdd: number;
}

export function checkValue(modelProb: number, odd: number, fairProb?: number, minEdge = 0.02): ValueCheck {
  const expectedValue = modelProb * odd - 1;
  return {
    modelProb, odd, fairProb, expectedValue,
    hasValue: expectedValue > minEdge,
    minOdd: 1 / modelProb,
  };
}

/** Probabilidad de acertar una combinada de selecciones independientes (de partidos distintos). */
export const parlayProbability = (probs: number[]) => probs.reduce((p, x) => p * x, 1);
