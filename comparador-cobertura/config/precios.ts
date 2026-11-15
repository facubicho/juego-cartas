/**
 * Tabla de precios editable, en USD por millón de tokens.
 * Si Anthropic cambia los precios, se actualiza acá y nada más.
 */
export interface PrecioModelo {
  entrada: number;
  salida: number;
}

export const PRECIOS: Record<string, PrecioModelo> = {
  "claude-haiku-5-5": { entrada: 0.1, salida: 0.5 },
  "claude-sonnet-5-5": { entrada: 2, salida: 10 },
  // Modelo de respaldo si Sonnet 5.5 declina una respuesta (fallback del servidor).
  "claude-sonnet-5": { entrada: 2, salida: 10 },
};

/** El modo lote (Message Batches) cuesta la mitad. */
export const FACTOR_LOTE = 0.5;

/**
 * Multiplicadores de caché de prompts sobre el precio de entrada.
 * Hoy la app no usa caché de prompts, pero si la API los informa, se cobran bien.
 */
export const FACTOR_CACHE_LECTURA = 0.1;
export const FACTOR_CACHE_ESCRITURA = 1.25;

/**
 * Precio que se usa si aparece un modelo que no está en la tabla.
 * Se elige a propósito el más caro conocido para no subestimar el gasto.
 */
export const PRECIO_DESCONOCIDO: PrecioModelo = { entrada: 2, salida: 10 };

export const MODELOS = {
  extraccion: "claude-haiku-5-5",
  agrupacion: "claude-haiku-5-5",
  comparacion: "claude-sonnet-5-5",
} as const;
