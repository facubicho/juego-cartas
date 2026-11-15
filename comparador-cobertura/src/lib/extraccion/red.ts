import robotsParser from "robots-parser";
import { LIMITES } from "@config/limites";

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

/** Error que significa "este sitio no se puede leer de forma automática": se informa y se sigue. */
export class NoDisponible extends Error {
  constructor(
    public url: string,
    public motivo: string,
  ) {
    super(`${url}: ${motivo}`);
    this.name = "NoDisponible";
  }
}

type Robots = ReturnType<typeof robotsParser>;

export interface OpcionesLector {
  fetchImpl?: FetchFn;
  userAgent?: string;
  timeoutMs?: number;
  /** Para tests: no esperar el crawl-delay. */
  sinEsperas?: boolean;
}

/**
 * Lector de páginas que respeta robots.txt, identifica a la app con su User-Agent,
 * respeta el crawl-delay de cada sitio y nunca manda cookies ni credenciales.
 */
export class LectorWeb {
  private robots = new Map<string, Promise<Robots | "bloqueado">>();
  private ultimoPedido = new Map<string, number>();
  private fetchImpl: FetchFn;
  readonly userAgent: string;
  private timeoutMs: number;
  private sinEsperas: boolean;

  constructor(op: OpcionesLector = {}) {
    this.fetchImpl = op.fetchImpl ?? ((u, i) => fetch(u, i));
    this.userAgent =
      op.userAgent ?? process.env.USER_AGENT ?? "ComparadorCobertura/0.1";
    this.timeoutMs = op.timeoutMs ?? LIMITES.red.timeoutMs;
    this.sinEsperas = op.sinEsperas ?? false;
  }

  private async pedir(url: string): Promise<Response> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(url, {
        headers: { "User-Agent": this.userAgent, Accept: "text/html,application/xml,application/rss+xml;q=0.9,*/*;q=0.8" },
        credentials: "omit",
        redirect: "follow",
        signal: ctrl.signal,
      });
    } catch (e) {
      throw new NoDisponible(url, `sin respuesta (${(e as Error).name === "AbortError" ? "tiempo agotado" : "error de red"})`);
    } finally {
      clearTimeout(t);
    }
  }

  private cargarRobots(origen: string): Promise<Robots | "bloqueado"> {
    let p = this.robots.get(origen);
    if (!p) {
      const urlRobots = `${origen}/robots.txt`;
      p = (async () => {
        let res: Response;
        try {
          res = await this.pedir(urlRobots);
        } catch {
          // Si ni siquiera responde robots.txt, no seguimos con ese sitio.
          return "bloqueado" as const;
        }
        if (res.status === 401 || res.status === 403) return "bloqueado" as const;
        // 404 u otro 4xx: no hay reglas, se permite (criterio estándar de robots.txt).
        const texto = res.ok ? await res.text() : "";
        if (res.status >= 500) return "bloqueado" as const;
        return robotsParser(urlRobots, texto);
      })();
      this.robots.set(origen, p);
    }
    return p;
  }

  /** ¿Se puede leer esta URL según robots.txt? */
  async permitido(url: string): Promise<boolean> {
    const origen = new URL(url).origin;
    const r = await this.cargarRobots(origen);
    if (r === "bloqueado") return false;
    return r.isAllowed(url, this.userAgent) !== false;
  }

  private async respetarDemora(url: string): Promise<void> {
    if (this.sinEsperas) return;
    const origen = new URL(url).origin;
    const r = await this.cargarRobots(origen);
    const demora = r === "bloqueado" ? 0 : Math.min(r.getCrawlDelay(this.userAgent) ?? 0, LIMITES.red.maxCrawlDelaySeg);
    const ultimo = this.ultimoPedido.get(origen) ?? 0;
    const espera = ultimo + demora * 1000 - Date.now();
    if (espera > 0) await new Promise((res) => setTimeout(res, espera));
    this.ultimoPedido.set(origen, Date.now());
  }

  /** Trae el texto de una URL o lanza NoDisponible. */
  async leer(url: string): Promise<{ texto: string; urlFinal: string }> {
    if (!(await this.permitido(url))) {
      throw new NoDisponible(url, "robots.txt no permite el acceso automático");
    }
    await this.respetarDemora(url);
    const res = await this.pedir(url);
    if (res.status === 401 || res.status === 403 || res.status === 429) {
      throw new NoDisponible(url, `el sitio bloqueó el acceso automático (HTTP ${res.status})`);
    }
    if (!res.ok) throw new NoDisponible(url, `HTTP ${res.status}`);
    const texto = await res.text();
    if (texto.length > LIMITES.red.maxBytes) throw new NoDisponible(url, "respuesta demasiado grande");
    return { texto, urlFinal: res.url || url };
  }
}
