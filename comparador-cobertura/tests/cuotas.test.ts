import { describe, it, expect, beforeEach, afterAll } from "vitest";
import type pg from "pg";
import { baseDeTest, crearUsuario } from "./helpers/db";
import { estadoCuota, reservarCuota, devolverCuota } from "@/lib/costos";

let db: pg.Pool;
beforeEach(async () => {
  db = await baseDeTest();
});
afterAll(async () => {
  await db?.end();
});

describe("cuotas mensuales", () => {
  it("plan gratuito: 5 comparaciones nuevas por mes", async () => {
    const u = await crearUsuario(db);
    for (let i = 0; i < 5; i++) expect(await reservarCuota(db, u, "2026-11")).toBe(true);
    expect(await reservarCuota(db, u, "2026-11")).toBe(false);
    expect(await estadoCuota(db, u, "2026-11")).toMatchObject({ usadas: 5, limite: 5, restantes: 0 });
  });

  it("plan pago: 40 comparaciones nuevas por mes", async () => {
    const u = await crearUsuario(db, "pago@ejemplo.org", "pago");
    for (let i = 0; i < 40; i++) expect(await reservarCuota(db, u, "2026-11")).toBe(true);
    expect(await reservarCuota(db, u, "2026-11")).toBe(false);
  });

  it("la cuota se renueva cada mes", async () => {
    const u = await crearUsuario(db);
    for (let i = 0; i < 5; i++) await reservarCuota(db, u, "2026-11");
    expect(await reservarCuota(db, u, "2026-12")).toBe(true);
  });

  it("pedidos simultáneos no superan el límite", async () => {
    const u = await crearUsuario(db);
    const r = await Promise.all(Array.from({ length: 12 }, () => reservarCuota(db, u, "2026-11")));
    expect(r.filter(Boolean)).toHaveLength(5);
  });

  it("devolver cuota libera un lugar", async () => {
    const u = await crearUsuario(db);
    for (let i = 0; i < 5; i++) await reservarCuota(db, u, "2026-11");
    await devolverCuota(db, u, "2026-11");
    expect(await reservarCuota(db, u, "2026-11")).toBe(true);
  });
});
