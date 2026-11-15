/**
 * Lista de medios. Para sumar uno, agregá una entrada con su dominio y sus feeds.
 * Las URL de feeds y sitemaps se toman de lo que cada diario publica; si alguna
 * cambia, se corrige acá. Los selectores son un respaldo: primero se usan JSON-LD
 * y metadatos estándar, que cambian mucho menos que el HTML.
 */
export interface Medio {
  id: string;
  nombre: string;
  dominios: string[];
  feeds: string[];
  sitemaps: string[];
  selectores: {
    /** Contenedores del cuerpo de la nota (se toman sus párrafos). */
    cuerpo: string[];
    /** Elementos que indican muro de pago visible. */
    muro: string[];
  };
}

export const MEDIOS: Medio[] = [
  {
    id: "infobae",
    nombre: "Infobae",
    dominios: ["infobae.com"],
    feeds: ["https://www.infobae.com/arc/outboundfeeds/rss/"],
    sitemaps: ["https://www.infobae.com/arc/outboundfeeds/news-sitemap2/"],
    selectores: {
      cuerpo: [".body-article", "article .article-body", "article"],
      muro: [".paywall", "[class*='paywall']"],
    },
  },
  {
    id: "clarin",
    nombre: "Clarín",
    dominios: ["clarin.com"],
    feeds: ["https://www.clarin.com/rss/lo-ultimo/"],
    sitemaps: ["https://www.clarin.com/sitemap_news.xml"],
    selectores: {
      cuerpo: [".body-nota", "[class*='StoryTextContainer']", "article"],
      muro: [".paywall", "[class*='paywall']", "#paywall", ".piano-container"],
    },
  },
  {
    id: "pagina12",
    nombre: "Página/12",
    dominios: ["pagina12.com.ar"],
    feeds: ["https://www.pagina12.com.ar/rss/portada"],
    sitemaps: [],
    selectores: {
      cuerpo: [".article-main-content", ".article-text", "article"],
      muro: [".paywall", "[class*='paywall']"],
    },
  },
  {
    id: "ambito",
    nombre: "Ámbito",
    dominios: ["ambito.com"],
    feeds: ["https://www.ambito.com/rss/pages/home.xml"],
    sitemaps: [],
    selectores: {
      cuerpo: [".detail-body", "article"],
      muro: [".paywall", "[class*='paywall']"],
    },
  },
];

/** Medios activos según MEDIOS_ACTIVOS (vacío = todos). */
export function mediosActivos(lista: Medio[] = MEDIOS): Medio[] {
  const ids = (process.env.MEDIOS_ACTIVOS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.length ? lista.filter((m) => ids.includes(m.id)) : lista;
}

export function medioPorUrl(url: string, lista: Medio[] = MEDIOS): Medio | undefined {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
  return lista.find((m) => m.dominios.some((d) => host === d || host.endsWith("." + d)));
}
