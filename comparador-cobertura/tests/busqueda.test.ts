import { describe, it, expect } from "vitest";
import { elegirCandidatas, type ItemFeed } from "@/lib/busqueda/feeds";
import { puntajeSimilitud } from "@/lib/busqueda/similitud";

const original = {
  titulo: "Aumentan los colectivos del AMBA un 12% desde diciembre",
  bajada: "La Secretaría de Transporte confirmó la suba del boleto mínimo.",
  fecha: "2026-11-14T10:00:00-03:00",
};

const items: ItemFeed[] = [
  { url: "a", titulo: "River y Boca empataron en un clásico sin goles", bajada: "", fecha: "2026-11-14T12:00:00Z" },
  { url: "b", titulo: "Colectivos: el boleto sube 12% en el AMBA en diciembre", bajada: "", fecha: "2026-11-14T13:00:00Z" },
  { url: "c", titulo: "Colectivos del AMBA: aumento del 12% en diciembre", bajada: "", fecha: "2026-10-01T13:00:00Z" },
];

describe("búsqueda de la misma noticia", () => {
  it("elige la nota más parecida dentro de la ventana de fechas", () => {
    const [c] = elegirCandidatas(original, items);
    expect(c.url).toBe("b");
  });

  it("descarta notas fuera de la ventana de fechas aunque se parezcan", () => {
    const r = elegirCandidatas(original, [items[2]]);
    expect(r).toEqual([]);
  });

  it("una nota de otro tema tiene puntaje bajo", () => {
    expect(puntajeSimilitud(original, items[0])).toBeLessThan(0.1);
    expect(puntajeSimilitud(original, items[1])).toBeGreaterThan(0.3);
  });
});
