import { describe, it, expect } from "vitest";
import { calcularCosto } from "@/lib/costos";

describe("cálculo de costo", () => {
  it("Haiku 5.5: 0,10 entrada y 0,50 salida por millón", () => {
    expect(calcularCosto({ modelo: "claude-haiku-5-5", entrada: 1_000_000, salida: 0 })).toBeCloseTo(0.1, 6);
    expect(calcularCosto({ modelo: "claude-haiku-5-5", entrada: 0, salida: 1_000_000 })).toBeCloseTo(0.5, 6);
    expect(calcularCosto({ modelo: "claude-haiku-5-5", entrada: 1800, salida: 400 })).toBeCloseTo(0.00038, 6);
  });

  it("Sonnet 5.5: 2 entrada y 10 salida por millón", () => {
    expect(calcularCosto({ modelo: "claude-sonnet-5-5", entrada: 3000, salida: 1400 })).toBeCloseTo(0.02, 6);
  });

  it("el modo lote cuesta la mitad", () => {
    const tr = calcularCosto({ modelo: "claude-sonnet-5-5", entrada: 3000, salida: 1400 });
    expect(calcularCosto({ modelo: "claude-sonnet-5-5", entrada: 3000, salida: 1400 }, "lote")).toBeCloseTo(tr / 2, 6);
  });

  it("acepta una tabla de precios propia", () => {
    expect(calcularCosto({ modelo: "x", entrada: 1_000_000, salida: 1_000_000 }, "tiempo_real", { x: { entrada: 1, salida: 2 } })).toBe(3);
  });

  it("un modelo desconocido se cobra al precio más caro conocido (no subestima)", () => {
    expect(calcularCosto({ modelo: "modelo-nuevo", entrada: 1_000_000, salida: 0 })).toBe(2);
  });

  it("cuenta los tokens leídos de caché al 10% del precio de entrada", () => {
    expect(calcularCosto({ modelo: "claude-sonnet-5-5", entrada: 0, salida: 0, cacheLectura: 1_000_000 })).toBeCloseTo(0.2, 6);
  });
});
