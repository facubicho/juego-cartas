import { describe, it, expect } from "vitest";
import { parsearNota } from "@/lib/extraccion/parsear";
import { normalizarUrl, recortarATokens } from "@/lib/extraccion/texto";
import { MEDIOS } from "@config/medios";
import { HTML, URLS } from "./fixtures/sitios";

const medio = (id: string) => MEDIOS.find((m) => m.id === id)!;

describe("extracción de contenido público", () => {
  it("toma titular, bajada, fecha y texto visible de una nota abierta", () => {
    const n = parsearNota(HTML.infobae, URLS.infobae, medio("infobae"));
    expect(n.titulo).toBe("Aumentan los colectivos del AMBA un 12% desde diciembre");
    expect(n.bajada).toContain("1.120 pesos");
    expect(n.fecha).toBe("2026-11-14T10:00:00-03:00");
    expect(n.textoPublico).toContain("Boletín Oficial");
    expect(n.muroPago).toBe(false);
    expect(n.senalesMuro).toEqual([]);
  });

  it("no incluye menú ni pie de página", () => {
    const n = parsearNota(HTML.infobae, URLS.infobae, medio("infobae"));
    expect(n.textoPublico).not.toContain("Menú del sitio");
    expect(n.textoPublico).not.toContain("derechos reservados");
  });

  it("si no hay JSON-LD usa los metadatos Open Graph", () => {
    const html = `<html><head><meta property="og:title" content="Título OG"><meta property="og:description" content="Bajada OG"></head>
      <body><article><p>Un párrafo de la nota con bastante texto para que cuente como cuerpo.</p></article></body></html>`;
    const n = parsearNota(html, "https://www.ambito.com/x", medio("ambito"));
    expect(n.titulo).toBe("Título OG");
    expect(n.bajada).toBe("Bajada OG");
    expect(n.textoPublico).toContain("Un párrafo de la nota");
  });

  it("recorta el texto público al límite de tokens", () => {
    const largo = Array.from({ length: 400 }, (_, i) => `Esta es la oración número ${i} de una nota muy larga.`).join(" ");
    const r = recortarATokens(largo, 100);
    expect(r.recortado).toBe(true);
    expect(r.texto.length).toBeLessThanOrEqual(400);
    expect(r.texto.endsWith(".")).toBe(true);
  });
});

describe("detección de muro de pago", () => {
  const n = parsearNota(HTML.clarin, URLS.clarin, medio("clarin"));

  it("detecta el muro por JSON-LD y por el aviso visible", () => {
    expect(n.muroPago).toBe(true);
    expect(n.senalesMuro).toContain("JSON-LD isAccessibleForFree=false");
    expect(n.senalesMuro.some((s) => s.startsWith("elemento de muro"))).toBe(true);
  });

  it("usa solo el texto público: excluye la parte marcada como paga", () => {
    expect(n.textoPublico).toContain("tercera suba");
    expect(n.textoPublico).not.toContain("RESERVADO A SUSCRIPTORES");
    expect(n.textoPublico).not.toContain("40%");
  });

  it("no incluye el aviso de suscripción como texto de la nota", () => {
    expect(n.textoPublico).not.toMatch(/suscribite/i);
  });

  it("nunca usa articleBody del JSON-LD (puede traer el texto pago)", () => {
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({
      "@type": "NewsArticle",
      headline: "Nota",
      isAccessibleForFree: "False",
      articleBody: "SECRETO: texto completo solo para suscriptores.",
    })}</script></head><body><article><p>Primer párrafo abierto de la nota, visible para todo el mundo.</p></article></body></html>`;
    const r = parsearNota(html, "https://www.clarin.com/x", medio("clarin"));
    expect(r.muroPago).toBe(true);
    expect(r.textoPublico).not.toContain("SECRETO");
  });

  it("detecta muro por frase de suscripción aunque no haya metadatos", () => {
    const html = `<html><body><article><p>Primer párrafo abierto de la nota, visible para todo el mundo.</p>
      <p>Esta nota es exclusiva para suscriptores. Ingresá con tu cuenta.</p></article></body></html>`;
    const r = parsearNota(html, "https://www.ambito.com/x", medio("ambito"));
    expect(r.muroPago).toBe(true);
    expect(r.textoPublico).not.toContain("exclusiva");
  });
});

describe("normalización de URL", () => {
  it("quita parámetros de seguimiento y fragmento", () => {
    expect(normalizarUrl("http://WWW.Infobae.com/nota/?utm_source=tw&fbclid=1#arriba")).toBe("https://www.infobae.com/nota/");
  });
  it("unifica versiones móviles y AMP", () => {
    expect(normalizarUrl("https://m.clarin.com/nota.html")).toBe("https://www.clarin.com/nota.html");
  });
});
