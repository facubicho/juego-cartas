import { describe, it, expect, beforeEach, afterAll } from "vitest";
import type pg from "pg";
import { baseDeTest, crearUsuario } from "./helpers/db";
import { solicitarComparacion, procesarComparacion, costoDeComparacion, type ResultadoGuardado } from "@/lib/comparar";
import { estadoCuota } from "@/lib/costos";
import { LectorWeb } from "@/lib/extraccion/red";
import { fetchSimulado, URLS } from "./fixtures/sitios";
import { anthropicSimulado, type OpcionesSimulador } from "./fixtures/anthropic-simulado";

let db: pg.Pool;
beforeEach(async () => {
  db = await baseDeTest();
});
afterAll(async () => {
  await db?.end();
});

function deps(extraFetch = {}, opIA: OpcionesSimulador = {}) {
  const f = fetchSimulado(extraFetch);
  const ia = anthropicSimulado(opIA);
  return { deps: { db, lector: new LectorWeb({ fetchImpl: f.fetch, sinEsperas: true }), ia: ia.cliente }, ia, f };
}

async function resultado(id: number) {
  const r = await db.query<{ estado: string; resultado: ResultadoGuardado; error: string | null }>(
    "SELECT estado, resultado, error FROM comparaciones WHERE id=$1",
    [id],
  );
  return r.rows[0];
}

describe("flujo completo y caché por noticia", () => {
  it("genera una comparación con 4 medios, marca lo no verificado y registra el costo", async () => {
    const u = await crearUsuario(db);
    const { deps: d, ia } = deps();
    const s = await solicitarComparacion(d, URLS.infobae + "?utm_source=twitter", u);
    expect(s.tipo).toBe("nueva");
    if (s.tipo !== "nueva") return;
    await procesarComparacion(d, s.comparacionId, u);

    const c = await resultado(s.comparacionId);
    expect(c.error).toBeNull();
    expect(c.estado).toBe("lista");
    expect(c.resultado.fuentes.map((f) => f.medioId).sort()).toEqual(["ambito", "clarin", "infobae", "pagina12"]);
    expect(c.resultado.fuentes.every((f) => f.url.startsWith("https://"))).toBe(true);
    expect(c.resultado.fuentes.find((f) => f.medioId === "clarin")!.muroPago).toBe(true);
    expect(c.resultado.comparacion!.noVerificado.length).toBeGreaterThan(0);

    // 4 extracciones (Haiku) + 1 agrupación (Haiku) + 1 comparación (Sonnet)
    expect(ia.llamadas.map((l) => l.model).sort()).toEqual([...Array(5).fill("claude-haiku-5-5"), "claude-sonnet-5-5"].sort());
    const costo = await costoDeComparacion(db, s.comparacionId);
    expect(costo.llamadas).toBe(6);
    // 4 × 0,00038 + 0,00015 + 0,02 = 0,02167
    expect(costo.usd).toBeCloseTo(0.02167, 5);
    const filas = await db.query("SELECT DISTINCT usuario_id, comparacion_id FROM llamadas_ia");
    expect(filas.rows).toEqual([{ usuario_id: u, comparacion_id: s.comparacionId }]);
  });

  it("el texto de las notas no se guarda en la base", async () => {
    const u = await crearUsuario(db);
    const { deps: d } = deps();
    const s = await solicitarComparacion(d, URLS.infobae, u);
    if (s.tipo !== "nueva") throw new Error();
    await procesarComparacion(d, s.comparacionId, u);
    const dump = JSON.stringify((await db.query("SELECT * FROM notas")).rows) + JSON.stringify((await db.query("SELECT * FROM comparaciones")).rows);
    expect(dump).not.toContain("cámaras empresarias consideraron");
  });

  it("un segundo pedido de la misma noticia reutiliza el resultado sin llamar a la IA ni gastar cuota", async () => {
    const ana = await crearUsuario(db, "ana@ejemplo.org");
    const beto = await crearUsuario(db, "beto@ejemplo.org");
    const { deps: d, ia } = deps();
    const s1 = await solicitarComparacion(d, URLS.infobae, ana);
    if (s1.tipo !== "nueva") throw new Error();
    await procesarComparacion(d, s1.comparacionId, ana);
    const llamadasAntes = ia.llamadas.length;

    // Otro usuario, misma URL con parámetros distintos
    const s2 = await solicitarComparacion(d, URLS.infobae + "#comentarios", beto);
    expect(s2).toEqual({ tipo: "existente", comparacionId: s1.comparacionId });
    // La misma URL sin la barra final
    expect(await solicitarComparacion(d, URLS.infobae.slice(0, -1), beto)).toEqual({ tipo: "existente", comparacionId: s1.comparacionId });
    // Otro usuario pega el link de OTRO medio que ya forma parte de la comparación
    const s3 = await solicitarComparacion(d, URLS.clarin, beto);
    expect(s3).toEqual({ tipo: "existente", comparacionId: s1.comparacionId });

    expect(ia.llamadas.length).toBe(llamadasAntes);
    expect((await estadoCuota(db, beto)).usadas).toBe(0);
    expect((await estadoCuota(db, ana)).usadas).toBe(1);
  });

  it("dos pedidos simultáneos de la misma URL generan un solo análisis", async () => {
    const ana = await crearUsuario(db, "ana@ejemplo.org");
    const beto = await crearUsuario(db, "beto@ejemplo.org");
    const { deps: d } = deps();
    const [a, b] = await Promise.all([solicitarComparacion(d, URLS.ambito, ana), solicitarComparacion(d, URLS.ambito, beto)]);
    expect([a.tipo, b.tipo].sort()).toEqual(["existente", "nueva"]);
    expect((await db.query("SELECT * FROM comparaciones")).rowCount).toBe(1);
  });

  it("un medio que bloquea el acceso figura como no disponible y se sigue con los demás", async () => {
    const u = await crearUsuario(db);
    const { deps: d } = deps({ "https://www.ambito.com/robots.txt": { status: 200, body: "User-agent: *\nDisallow: /\n" } });
    const s = await solicitarComparacion(d, URLS.infobae, u);
    if (s.tipo !== "nueva") throw new Error();
    await procesarComparacion(d, s.comparacionId, u);
    const c = await resultado(s.comparacionId);
    expect(c.estado).toBe("lista");
    expect(c.resultado.noDisponibles).toEqual([{ medio: "Ámbito", motivo: "robots.txt no permite el acceso automático" }]);
    expect(c.resultado.fuentes).toHaveLength(3);
  });

  it("la etapa 2 descarta notas que no tratan el mismo hecho", async () => {
    const u = await crearUsuario(db);
    const { deps: d } = deps({}, { descartar: ["pagina12"] });
    const s = await solicitarComparacion(d, URLS.infobae, u);
    if (s.tipo !== "nueva") throw new Error();
    await procesarComparacion(d, s.comparacionId, u);
    const c = await resultado(s.comparacionId);
    expect(c.resultado.fuentes.map((f) => f.medioId)).not.toContain("pagina12");
    expect(c.resultado.descartadas[0].medio).toBe("Página/12");
    expect(c.resultado.comparacion!.tabla.map((t) => t.medioId)).not.toContain("pagina12");
  });

  it("si no se puede leer la nota original, falla sin gastar IA y devuelve la cuota", async () => {
    const u = await crearUsuario(db);
    const { deps: d, ia } = deps({ [URLS.infobae]: { status: 403, body: "" } });
    const s = await solicitarComparacion(d, URLS.infobae, u);
    if (s.tipo !== "nueva") throw new Error();
    await procesarComparacion(d, s.comparacionId, u);
    const c = await resultado(s.comparacionId);
    expect(c.estado).toBe("error");
    expect(c.error).toMatch(/No pudimos leer/);
    expect(ia.llamadas).toHaveLength(0);
    expect((await estadoCuota(db, u)).usadas).toBe(0);
    // Y una comparación con error no se reutiliza como caché.
    const otra = await solicitarComparacion(d, URLS.infobae, u);
    expect(otra.tipo).toBe("nueva");
  });

  it("si la IA declina, se registra igual lo gastado y la comparación queda con error", async () => {
    const u = await crearUsuario(db);
    const { deps: d } = deps({}, { negarComparacion: true });
    const s = await solicitarComparacion(d, URLS.infobae, u);
    if (s.tipo !== "nueva") throw new Error();
    await procesarComparacion(d, s.comparacionId, u);
    expect((await resultado(s.comparacionId)).estado).toBe("error");
    const costo = await costoDeComparacion(db, s.comparacionId);
    expect(costo.llamadas).toBe(6);
    expect((await estadoCuota(db, u)).usadas).toBe(1);
  });

  it("rechaza links de medios que no están en la lista", async () => {
    const u = await crearUsuario(db);
    const r = await solicitarComparacion({ db }, "https://www.otrodiario.com/nota", u);
    expect(r).toMatchObject({ tipo: "rechazada", motivo: "medio_no_soportado" });
  });

  it("al agotar la cuota no se generan comparaciones nuevas, pero sí se ven las existentes", async () => {
    const u = await crearUsuario(db);
    const { deps: d } = deps();
    const s = await solicitarComparacion(d, URLS.infobae, u);
    if (s.tipo !== "nueva") throw new Error();
    await db.query("UPDATE uso_mensual SET comparaciones = 5");
    expect(await solicitarComparacion(d, "https://www.infobae.com/otra-nota", u)).toMatchObject({ tipo: "rechazada", motivo: "cuota" });
    expect(await solicitarComparacion(d, URLS.infobae, u)).toMatchObject({ tipo: "existente" });
  });
});
