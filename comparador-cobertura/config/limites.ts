/** Límites de uso y de costo. Todos editables. */
export const LIMITES = {
  /** Máximo de texto público por nota que se manda a la IA, en tokens aproximados. */
  maxTokensPorNota: 1500,
  /** Caracteres por token para estimar (español, aproximado). */
  caracteresPorToken: 4,

  /** Comparaciones nuevas por usuario y por mes. Las ya analizadas no cuentan. */
  cuotaMensual: { gratis: 5, pago: 40 } as Record<string, number>,

  /** Tope de gasto mensual global en USD si no se define TOPE_GASTO_MENSUAL_USD. */
  topeGastoMensualUsdPorDefecto: 20,

  /** Objetivo de costo promedio por comparación en tiempo real (para alertar en /admin). */
  objetivoCostoPorComparacionUsd: 0.02,

  /** Búsqueda de notas relacionadas. */
  busqueda: {
    ventanaHoras: 48,
    similitudMinima: 0.2,
    candidatasPorMedio: 1,
  },

  /** Topes de salida por etapa (tokens). */
  maxTokensSalida: { extraccion: 800, agrupacion: 400, comparacion: 3000 },

  /** Red */
  red: { timeoutMs: 10000, maxBytes: 3_000_000, maxCrawlDelaySeg: 5 },
} as const;
