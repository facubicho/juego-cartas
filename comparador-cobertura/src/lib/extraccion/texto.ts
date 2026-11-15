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

/** Quita parámetros de seguimiento, el fragmento y la barra final, y unifica el host. */
export function normalizarUrl(url: string): string {
  const u = new URL(url.trim());
  u.hash = "";
  u.protocol = "https:";
  u.hostname = u.hostname.toLowerCase().replace(/^(m|amp)\./, "www.");
  for (const k of [...u.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid|mc_|ref|outputType|s$|from)/i.test(k)) u.searchParams.delete(k);
  }
  let s = u.toString();
  if (s.endsWith("/") && u.pathname !== "/") s = s.slice(0, -1);
  return s;
}
