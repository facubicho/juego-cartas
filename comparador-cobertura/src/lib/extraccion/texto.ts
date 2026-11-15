import { LIMITES } from "@config/limites";

export function estimarTokens(texto: string): number {
  return Math.ceil(texto.length / LIMITES.caracteresPorToken);
}

/** Recorta el texto al límite de tokens, cortando en el final de una oración si se puede. */
export function recortarATokens(texto: string, maxTokens = LIMITES.maxTokensPorNota): { texto: string; recortado: boolean } {
  const maxCar = maxTokens * LIMITES.caracteresPorToken;
  if (texto.length <= maxCar) return { texto, recortado: false };
  const corte = texto.slice(0, maxCar);
  const fin = Math.max(corte.lastIndexOf(". "), corte.lastIndexOf(".\n"));
  return { texto: (fin > maxCar * 0.6 ? corte.slice(0, fin + 1) : corte).trim(), recortado: true };
}

/**
 * Quita parámetros de seguimiento y el fragmento, y unifica el host.
 * La barra final se conserva (algunos sitios la necesitan); para la caché se
 * comparan las dos variantes con `variantesUrl`.
 */
export function normalizarUrl(url: string): string {
  const u = new URL(url.trim());
  u.hash = "";
  u.protocol = "https:";
  u.hostname = u.hostname.toLowerCase().replace(/^(m|amp)\./, "www.");
  for (const k of [...u.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid|mc_|ref|outputType|s$|from)/i.test(k)) u.searchParams.delete(k);
  }
  return u.toString();
}

/** La URL con y sin barra final, para buscar en la caché. */
export function variantesUrl(url: string): string[] {
  return url.endsWith("/") ? [url, url.slice(0, -1)] : [url, url + "/"];
}
