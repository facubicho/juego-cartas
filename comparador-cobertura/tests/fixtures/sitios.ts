/**
 * Sitios simulados para tests y demo. Las notas son ficticias y fueron escritas
 * para este proyecto: no reproducen contenido de ningún diario.
 */
import type { FetchFn } from "@/lib/extraccion/red";

export const FECHA = "2026-11-14T10:00:00-03:00";

export const URLS = {
  infobae: "https://www.infobae.com/economia/2026/11/14/aumentan-los-colectivos-del-amba-un-12-desde-diciembre/",
  clarin: "https://www.clarin.com/economia/colectivos-amba-suben-12-diciembre_0_abc123.html",
  pagina12: "https://www.pagina12.com.ar/900001-tarifas-de-colectivos-suba-del-12-en-el-amba",
  ambito: "https://www.ambito.com/economia/colectivos-aumento-del-12-el-amba-diciembre-n6000001",
};

const parrafos = (ps: string[]) => ps.map((p) => `<p>${p}</p>`).join("\n");

function pagina(op: {
  titulo: string;
  bajada: string;
  url: string;
  cuerpoClase: string;
  cuerpo: string;
  ld?: Record<string, unknown>;
  extra?: string;
}): string {
  const ld = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: op.titulo,
    description: op.bajada,
    datePublished: FECHA,
    ...op.ld,
  };
  return `<!doctype html><html><head>
<title>${op.titulo}</title>
<link rel="canonical" href="${op.url}">
<meta property="og:title" content="${op.titulo}">
<meta property="og:description" content="${op.bajada}">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head><body>
<nav><p>Menú del sitio con muchas secciones que no forman parte de la nota</p></nav>
<article><h1>${op.titulo}</h1><div class="${op.cuerpoClase}">${op.cuerpo}</div></article>
${op.extra ?? ""}
<footer><p>Todos los derechos reservados. Pie de página del sitio, no es parte de la nota.</p></footer>
</body></html>`;
}

export const HTML = {
  infobae: pagina({
    titulo: "Aumentan los colectivos del AMBA un 12% desde diciembre",
    bajada: "La Secretaría de Transporte confirmó la suba del boleto mínimo, que pasará a costar 1.120 pesos.",
    url: URLS.infobae,
    cuerpoClase: "body-article",
    cuerpo: parrafos([
      "La Secretaría de Transporte oficializó este viernes un aumento del 12% en las tarifas de colectivos que circulan en el AMBA, que regirá desde el 1 de diciembre.",
      "Según la resolución publicada en el Boletín Oficial, el boleto mínimo pasará de 1.000 a 1.120 pesos para quienes viajen con la tarjeta SUBE registrada.",
      "Desde el ministerio explicaron que la medida busca reducir los subsidios al transporte, que este año sumaron unos 900.000 millones de pesos.",
      "Las cámaras empresarias consideraron que la actualización es insuficiente para cubrir los costos de combustible y salarios.",
    ]),
  }),
  clarin: pagina({
    titulo: "Colectivos en el AMBA: suben 12% en diciembre y el boleto mínimo llega a $1.120",
    bajada: "Es la tercera suba del año. Las empresas advierten que no alcanza.",
    url: URLS.clarin,
    cuerpoClase: "body-nota",
    ld: {
      isAccessibleForFree: false,
      hasPart: { "@type": "WebPageElement", isAccessibleForFree: false, cssSelector: ".paywalled-content" },
    },
    cuerpo:
      parrafos([
        "El boleto de colectivo en el AMBA tendrá un nuevo aumento del 12% a partir del 1 de diciembre, según confirmó el Gobierno nacional en el Boletín Oficial.",
        "Con este ajuste, el boleto mínimo quedará en 1.120 pesos. Se trata de la tercera suba en lo que va del año para los usuarios del transporte público.",
      ]) +
      `<div class="paywalled-content">${parrafos([
        "TEXTO RESERVADO A SUSCRIPTORES: las empresas reclamaron una suba del 40% en una reunión reservada con funcionarios.",
      ])}</div>`,
    extra: `<div class="paywall"><p>Suscribite para seguir leyendo esta nota y acceder a todo el contenido.</p></div>`,
  }),
  pagina12: pagina({
    titulo: "Otra suba en el transporte: los colectivos del AMBA aumentan 12%",
    bajada: "El ajuste golpea a los usuarios que viajan todos los días al trabajo. Organizaciones de usuarios cuestionaron la medida.",
    url: URLS.pagina12,
    cuerpoClase: "article-main-content",
    cuerpo: parrafos([
      "El Gobierno dispuso un nuevo aumento de 12% en el boleto de colectivos del AMBA, que se aplicará desde diciembre y llevará el pasaje mínimo a 1.120 pesos.",
      "Una asociación de usuarios del transporte advirtió que un trabajador que toma cuatro colectivos por día gastará más de 100.000 pesos por mes.",
      "Para la organización, la reducción de subsidios traslada el costo del sistema a los sectores de menores ingresos.",
      "En el Ejecutivo sostienen que la tarifa social se mantiene para jubilados y beneficiarios de planes, con un descuento del 55%.",
    ]),
  }),
  ambito: pagina({
    titulo: "Colectivos: el boleto sube 12% en el AMBA y presiona sobre la inflación de diciembre",
    bajada: "Consultoras estiman que el ajuste sumará dos décimas al índice de precios del mes.",
    url: URLS.ambito,
    cuerpoClase: "detail-body",
    cuerpo: parrafos([
      "El aumento de 12% en los colectivos del AMBA, vigente desde el 1 de diciembre, tendrá impacto en el índice de precios al consumidor de ese mes.",
      "De acuerdo con una consultora privada, el ajuste aportaría alrededor de 0,2 puntos porcentuales a la inflación mensual.",
      "El boleto mínimo pasará a 1.120 pesos. El Gobierno apunta a recortar la partida de subsidios económicos en el presupuesto del año próximo.",
    ]),
  }),
};

function rss(medio: keyof typeof URLS, titulo: string, bajada: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>${medio}</title>
<item><title>${titulo}</title><link>${URLS[medio]}</link><description>${bajada}</description><pubDate>Fri, 14 Nov 2026 13:30:00 GMT</pubDate></item>
<item><title>River y Boca empataron en un clásico sin goles</title><link>https://www.${medio === "pagina12" ? "pagina12.com.ar" : medio + ".com"}/deportes/clasico</link><description>Partido de fútbol.</description><pubDate>Fri, 14 Nov 2026 12:00:00 GMT</pubDate></item>
<item><title>Pronóstico: anuncian lluvias para el fin de semana en Buenos Aires</title><link>https://www.${medio === "pagina12" ? "pagina12.com.ar" : medio + ".com"}/sociedad/lluvias</link><description>Clima.</description><pubDate>Fri, 14 Nov 2026 11:00:00 GMT</pubDate></item>
</channel></rss>`;
}

export const FEEDS: Record<string, string> = {
  "https://www.infobae.com/arc/outboundfeeds/rss/": rss("infobae", "Aumentan los colectivos del AMBA un 12% desde diciembre", "Suba del boleto mínimo a 1.120 pesos."),
  "https://www.clarin.com/rss/lo-ultimo/": rss("clarin", "Colectivos en el AMBA: suben 12% en diciembre y el boleto mínimo llega a $1.120", "Tercera suba del año."),
  "https://www.pagina12.com.ar/rss/portada": rss("pagina12", "Otra suba en el transporte: los colectivos del AMBA aumentan 12%", "Usuarios cuestionaron la medida."),
  "https://www.ambito.com/rss/pages/home.xml": rss("ambito", "Colectivos: el boleto sube 12% en el AMBA y presiona sobre la inflación de diciembre", "Impacto en el índice de precios."),
};

export interface RespuestaSimulada {
  status: number;
  body: string;
}

/** Arma un fetch falso a partir de un mapa URL -> respuesta. Lo que no está, da 404. */
export function fetchSimulado(extra: Record<string, RespuestaSimulada> = {}) {
  const pedidos: { url: string; headers: Record<string, string> }[] = [];
  const mapa: Record<string, RespuestaSimulada> = {
    "https://www.infobae.com/robots.txt": { status: 200, body: "User-agent: *\nDisallow: /privado/\n" },
    "https://www.clarin.com/robots.txt": { status: 200, body: "User-agent: *\nAllow: /\n" },
    "https://www.pagina12.com.ar/robots.txt": { status: 404, body: "" },
    "https://www.ambito.com/robots.txt": { status: 200, body: "User-agent: *\nAllow: /\n" },
    [URLS.infobae]: { status: 200, body: HTML.infobae },
    [URLS.clarin]: { status: 200, body: HTML.clarin },
    [URLS.pagina12]: { status: 200, body: HTML.pagina12 },
    [URLS.ambito]: { status: 200, body: HTML.ambito },
    ...Object.fromEntries(Object.entries(FEEDS).map(([u, b]) => [u, { status: 200, body: b }])),
    ...extra,
  };
  const fn: FetchFn = async (url, init) => {
    pedidos.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    const r = mapa[url] ?? { status: 404, body: "no encontrado" };
    return new Response(r.body, { status: r.status });
  };
  return { fetch: fn, pedidos };
}
