import Parser from "rss-parser";
import * as cheerio from "cheerio";
import type { Medio } from "@config/medios";
import { LIMITES } from "@config/limites";
import { LectorWeb, NoDisponible } from "@/lib/extraccion/red";
import { puntajeSimilitud } from "./similitud";

export interface ItemFeed {
  url: string;
  titulo: string;
  bajada: string;
  fecha: string | null;
}

const parser = new Parser();

/** Lee un feed RSS/Atom. */
export async function leerFeed(lector: LectorWeb, url: string): Promise<ItemFeed[]> {
  const { texto } = await lector.leer(url);
  const feed = await parser.parseString(texto);
  return (feed.items ?? [])
    .filter((i) => i.link && i.title)
    .map((i) => ({
      url: i.link!,
      titulo: i.title!.trim(),
      bajada: (i.contentSnippet ?? i.summary ?? "").replace(/\s+/g, " ").trim().slice(0, 400),
      fecha: i.isoDate ?? i.pubDate ?? null,
    }));
}

/** Lee un sitemap de noticias (formato Google News). */
export async function leerSitemap(lector: LectorWeb, url: string): Promise<ItemFeed[]> {
  const { texto } = await lector.leer(url);
  const $ = cheerio.load(texto, { xml: true });
  return $("url")
    .map((_, el) => {
      const n = $(el);
      return {
        url: n.find("loc").first().text().trim(),
        titulo: n.find("news\\:title, title").first().text().trim(),
        bajada: "",
        fecha: n.find("news\\:publication_date, lastmod").first().text().trim() || null,
      };
    })
    .get()
    .filter((i) => i.url && i.titulo);
}

/** Junta lo que publican los feeds y sitemaps de un medio. Si todo falla, lanza NoDisponible. */
export async function itemsDeMedio(lector: LectorWeb, medio: Medio): Promise<ItemFeed[]> {
  const items: ItemFeed[] = [];
  const errores: string[] = [];
  for (const f of medio.feeds) {
    try {
      items.push(...(await leerFeed(lector, f)));
    } catch (e) {
      errores.push(e instanceof NoDisponible ? e.motivo : (e as Error).message);
    }
  }
  for (const s of medio.sitemaps) {
    try {
      items.push(...(await leerSitemap(lector, s)));
    } catch (e) {
      errores.push(e instanceof NoDisponible ? e.motivo : (e as Error).message);
    }
  }
  if (!items.length && errores.length) {
    throw new NoDisponible(medio.feeds[0] ?? medio.sitemaps[0] ?? medio.id, errores[0]);
  }
  const vistos = new Set<string>();
  return items.filter((i) => (vistos.has(i.url) ? false : (vistos.add(i.url), true)));
}

export interface Candidata extends ItemFeed {
  puntaje: number;
}

/**
 * Elige las notas del medio que más se parecen a la original, dentro de la ventana de fechas.
 */
export function elegirCandidatas(
  original: { titulo: string; bajada: string; fecha: string | null },
  items: ItemFeed[],
  op = LIMITES.busqueda,
): Candidata[] {
  const fOrig = original.fecha ? Date.parse(original.fecha) : NaN;
  const ventana = op.ventanaHoras * 3600 * 1000;
  return items
    .filter((i) => {
      if (Number.isNaN(fOrig) || !i.fecha) return true;
      const f = Date.parse(i.fecha);
      return Number.isNaN(f) || Math.abs(f - fOrig) <= ventana;
    })
    .map((i) => ({ ...i, puntaje: puntajeSimilitud(original, i) }))
    .filter((i) => i.puntaje >= op.similitudMinima)
    .sort((a, b) => b.puntaje - a.puntaje)
    .slice(0, op.candidatasPorMedio);
}
