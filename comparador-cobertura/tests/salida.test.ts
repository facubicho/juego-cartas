import { describe, it, expect } from "vitest";
import { citaValida, sanearComparacion } from "@/lib/ia/salida";
import type { Comparacion } from "@/lib/ia/esquemas";

const texto = "La Secretaría de Transporte oficializó este viernes un aumento del 12% en las tarifas de colectivos que circulan en el AMBA, que regirá desde el 1 de diciembre.";

describe("reglas de citas y derechos de autor", () => {
  it("acepta una cita corta que está en el texto", () => {
    expect(citaValida("“un aumento del 12% en las tarifas”", texto)).toBe("un aumento del 12% en las tarifas");
  });
  it("rechaza citas de 15 palabras o más", () => {
    expect(citaValida("La Secretaría de Transporte oficializó este viernes un aumento del 12% en las tarifas de colectivos", texto)).toBeNull();
  });
  it("rechaza citas que no aparecen en el texto público (inventadas o detrás del muro)", () => {
    expect(citaValida("las empresas pidieron un 40%", texto)).toBeNull();
  });

  it("borra campos que copian 15 palabras seguidas de la nota y deja una cita por medio", () => {
    const c: Comparacion = {
      resumenHecho: texto,
      tabla: [
        { medioId: "infobae", enfoque: "Oficial", cifrasClave: [], fuentesPrincipales: [], composicion: "x", citaTextual: "un aumento del 12%" },
        { medioId: "otro", enfoque: "x", cifrasClave: [], fuentesPrincipales: [], composicion: "x", citaTextual: null },
      ],
      coincidencias: [],
      diferenciasDeHechos: [],
      diferenciasDeEncuadre: [],
      noVerificado: [],
    };
    const s = sanearComparacion(c, { infobae: texto });
    expect(s.comparacion.resumenHecho).toMatch(/omitido/);
    expect(s.comparacion.tabla).toHaveLength(1);
    expect(s.comparacion.tabla[0].citaTextual).toBe("un aumento del 12%");
    expect(s.cambios.length).toBeGreaterThan(0);
  });
});
