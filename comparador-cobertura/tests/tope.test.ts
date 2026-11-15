import { describe, it, expect, beforeEach, afterAll, afterEach } from "vitest";
import type pg from "pg";
import { baseDeTest, crearUsuario } from "./helpers/db";
import { gastoDelMes, registrarLlamada, topeAlcanzado } from "@/lib/costos";
import { solicitarComparacion } from "@/lib/comparar";
import { URLS } from "./fixtures/sitios";

let db: pg.Pool;
beforeEach(async () => {
  db = await baseDeTest();
  process.env.TOPE_GASTO_MENSUAL_USD = "1";
});
afterEach(() => {
  delete process.env.TOPE_GASTO_MENSUAL_USD;
});
afterAll(async () => {
  await db?.end();
});

describe("tope de gasto mensual global", () => {
  it("registra el costo de cada llamada y lo suma en el mes", async () => {
    const u = await crearUsuario(db);
    await registrarLlamada(db, { etapa: "comparacion", modelo: "claude-sonnet-5-5", entrada: 3000, salida: 1400, comparacionId: null, usuarioId: u });
    await registrarLlamada(db, { etapa: "extraccion", modelo: "claude-haiku-5-5", entrada: 1800, salida: 400, comparacionId: null, usuarioId: u });
    expect(await gastoDelMes(db)).toBeCloseTo(0.02038, 6);
    const r = await db.query("SELECT modelo, tokens_entrada, tokens_salida, costo_usd, usuario_id FROM llamadas_ia ORDER BY id");
    expect(r.rows[0]).toMatchObject({ modelo: "claude-sonnet-5-5", tokens_entrada: 3000, tokens_salida: 1400, costo_usd: "0.020000", usuario_id: u });
  });

  it("al alcanzar el tope no se generan análisis nuevos", async () => {
    const u = await crearUsuario(db);
    expect(await topeAlcanzado(db)).toBe(false);
    // Simula 1 USD gastado en el mes.
    await registrarLlamada(db, { etapa: "comparacion", modelo: "claude-sonnet-5-5", entrada: 0, salida: 100_000, comparacionId: null, usuarioId: u });
    expect(await topeAlcanzado(db)).toBe(true);
    const r = await solicitarComparacion({ db }, URLS.infobae, u);
    expect(r).toMatchObject({ tipo: "rechazada", motivo: "tope" });
    // Y no consume cuota del usuario.
    const uso = await db.query("SELECT * FROM uso_mensual");
    expect(uso.rowCount).toBe(0);
  });

  it("el gasto de meses anteriores no cuenta", async () => {
    await db.query(
      `INSERT INTO llamadas_ia (creado, etapa, modelo, tokens_entrada, tokens_salida, costo_usd) VALUES (now() - interval '40 days', 'x', 'm', 0, 0, 5)`,
    );
    expect(await topeAlcanzado(db)).toBe(false);
  });
});
