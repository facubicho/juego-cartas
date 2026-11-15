import { describe, it, expect } from "vitest";
import { LectorWeb, NoDisponible } from "@/lib/extraccion/red";
import { fetchSimulado, URLS } from "./fixtures/sitios";

describe("lectura respetando robots.txt", () => {
  it("lee una página permitida y se identifica con su User-Agent, sin credenciales", async () => {
    const f = fetchSimulado();
    const lector = new LectorWeb({ fetchImpl: f.fetch, userAgent: "ComparadorTest/1", sinEsperas: true });
    const r = await lector.leer(URLS.infobae);
    expect(r.texto).toContain("<html>");
    const pedido = f.pedidos.find((p) => p.url === URLS.infobae)!;
    expect(pedido.headers["User-Agent"]).toBe("ComparadorTest/1");
    expect(JSON.stringify(pedido.headers).toLowerCase()).not.toContain("cookie");
  });

  it("no lee lo que robots.txt prohíbe", async () => {
    const f = fetchSimulado();
    const lector = new LectorWeb({ fetchImpl: f.fetch, sinEsperas: true });
    await expect(lector.leer("https://www.infobae.com/privado/nota")).rejects.toBeInstanceOf(NoDisponible);
    expect(f.pedidos.some((p) => p.url.includes("/privado/"))).toBe(false);
  });

  it("si robots.txt no existe (404) se permite", async () => {
    const lector = new LectorWeb({ fetchImpl: fetchSimulado().fetch, sinEsperas: true });
    await expect(lector.leer(URLS.pagina12)).resolves.toBeTruthy();
  });

  it("informa 'no disponible' si el sitio bloquea el acceso automático", async () => {
    const f = fetchSimulado({ [URLS.ambito]: { status: 403, body: "Forbidden" } });
    const lector = new LectorWeb({ fetchImpl: f.fetch, sinEsperas: true });
    const e = await lector.leer(URLS.ambito).catch((x) => x);
    expect(e).toBeInstanceOf(NoDisponible);
    expect(e.motivo).toMatch(/bloque/);
  });

  it("si robots.txt devuelve 403 no se lee nada del sitio", async () => {
    const f = fetchSimulado({ "https://www.clarin.com/robots.txt": { status: 403, body: "" } });
    const lector = new LectorWeb({ fetchImpl: f.fetch, sinEsperas: true });
    await expect(lector.leer(URLS.clarin)).rejects.toBeInstanceOf(NoDisponible);
    expect(f.pedidos.some((p) => p.url === URLS.clarin)).toBe(false);
  });

  it("si el sitio no responde, lo informa como tal (no como bloqueo de robots.txt)", async () => {
    const lector = new LectorWeb({ fetchImpl: async () => { throw new TypeError("fetch failed"); }, sinEsperas: true });
    const e = await lector.leer(URLS.infobae).catch((x) => x);
    expect(e.motivo).toBe("el sitio no respondió");
  });
});
