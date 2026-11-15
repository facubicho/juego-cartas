import * as cheerio from "cheerio";
import type { Medio } from "@config/medios";
import { recortarATokens } from "./texto";

export interface NotaPublica {
  url: string;
  urlCanonica: string;
  medioId: string;
  titulo: string;
  bajada: string;
  fecha: string | null;
  /** Solo el texto que el diario muestra sin suscripción, ya recortado al límite. */
  textoPublico: string;
  textoRecortado: boolean;
  muroPago: boolean;
  senalesMuro: string[];
}

const FRASES_MURO = [
  /suscrib[ií]te para (seguir|continuar) leyendo/i,
  /contenido exclusivo (para|de) suscriptores/i,
  /esta nota es exclusiva para suscriptores/i,
  /para leer (la nota completa|esta nota) (suscrib|ingres)/i,
  /ya sos suscriptor\??/i,
];

type JsonLd = Record<string, unknown>;

function nodosJsonLd($: cheerio.CheerioAPI): JsonLd[] {
  const nodos: JsonLd[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text());
      const pila = Array.isArray(data) ? data : [data];
      for (const n of pila) {
        if (n && typeof n === "object") {
          nodos.push(n);
          if (Array.isArray(n["@graph"])) nodos.push(...n["@graph"]);
        }
      }
    } catch {
      /* JSON-LD inválido: se ignora */
    }
  });
  return nodos;
}

function esArticulo(n: JsonLd): boolean {
  const t = n["@type"];
  const tipos = Array.isArray(t) ? t : [t];
  return tipos.some((x) => typeof x === "string" && /(News)?Article|ReportageNewsArticle|AnalysisNewsArticle|OpinionNewsArticle/.test(x));
}

function esFalso(v: unknown): boolean {
  return v === false || (typeof v === "string" && v.toLowerCase() === "false");
}

const limpiar = (s: string | undefined | null) => (s ?? "").replace(/\s+/g, " ").trim();

/**
 * Extrae titular, bajada y texto público de una nota y detecta si tiene muro de pago.
 *
 * Regla central: nunca se usa `articleBody` del JSON-LD, porque en notas con muro
 * puede traer el texto completo que el diario reserva a suscriptores. Solo se toma
 * el texto visible en la página, sacando las partes que el propio diario marca como
 * pagas (hasPart.isAccessibleForFree=false + cssSelector).
 */
export function parsearNota(html: string, url: string, medio: Medio): NotaPublica {
  const $ = cheerio.load(html);
  const ld = nodosJsonLd($);
  const art = ld.find(esArticulo);

  const meta = (sel: string) => $(sel).attr("content");
  const titulo = limpiar(
    (art?.headline as string) ?? meta('meta[property="og:title"]') ?? $("h1").first().text() ?? $("title").text(),
  );
  const bajada = limpiar(
    (art?.description as string) ?? meta('meta[property="og:description"]') ?? meta('meta[name="description"]'),
  );
  const fecha =
    (art?.datePublished as string) ?? meta('meta[property="article:published_time"]') ?? $("time[datetime]").first().attr("datetime") ?? null;
  const canonica = $('link[rel="canonical"]').attr("href") ?? url;

  // --- Señales de muro de pago ---
  const senales: string[] = [];
  const selectoresPagos: string[] = [];
  for (const n of ld.filter(esArticulo)) {
    if (esFalso(n.isAccessibleForFree)) senales.push("JSON-LD isAccessibleForFree=false");
    const partes = Array.isArray(n.hasPart) ? n.hasPart : n.hasPart ? [n.hasPart] : [];
    for (const p of partes as JsonLd[]) {
      if (esFalso(p?.isAccessibleForFree) && typeof p.cssSelector === "string") {
        selectoresPagos.push(p.cssSelector);
      }
    }
  }
  const tier = meta('meta[property="article:content_tier"]');
  if (tier && /locked|metered|premium/i.test(tier)) senales.push(`article:content_tier=${tier}`);
  for (const sel of medio.selectores.muro) {
    if ($(sel).length) {
      senales.push(`elemento de muro (${sel})`);
      break;
    }
  }

  // --- Texto visible ---
  $("script, style, noscript, iframe, nav, header, footer, aside, figure, form, [aria-hidden='true']").remove();
  for (const sel of selectoresPagos) $(sel).remove();
  for (const sel of medio.selectores.muro) $(sel).remove();

  let parrafos: string[] = [];
  for (const sel of medio.selectores.cuerpo) {
    const cont = $(sel).first();
    if (!cont.length) continue;
    parrafos = cont
      .find("p")
      .map((_, p) => limpiar($(p).text()))
      .get()
      .filter((t) => t.length > 30);
    if (parrafos.length) break;
  }
  if (!parrafos.length) {
    parrafos = $("p")
      .map((_, p) => limpiar($(p).text()))
      .get()
      .filter((t) => t.length > 30);
  }
  // Los avisos del muro no son parte de la nota.
  const textoVisible = parrafos.filter((t) => !FRASES_MURO.some((re) => re.test(t)));
  if (parrafos.some((t) => FRASES_MURO.some((re) => re.test(t))) || FRASES_MURO.some((re) => re.test($("body").text()))) {
    senales.push("aviso de suscripción en la página");
  }

  const { texto, recortado } = recortarATokens(textoVisible.join("\n\n"));
  return {
    url,
    urlCanonica: canonica,
    medioId: medio.id,
    titulo,
    bajada,
    fecha,
    textoPublico: texto,
    textoRecortado: recortado,
    muroPago: senales.length > 0,
    senalesMuro: [...new Set(senales)],
  };
}
