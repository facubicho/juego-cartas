import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import type { UsoTokens } from "@/lib/costos";

export class ErrorIA extends Error {
  constructor(
    message: string,
    /** Tokens gastados aunque la respuesta no sirva: también se registran. */
    public usos: UsoTokens[] = [],
  ) {
    super(message);
    this.name = "ErrorIA";
  }
}

export interface PedidoIA<S extends z.ZodType> {
  modelo: string;
  sistema: string;
  usuario: string;
  esquema: S;
  maxTokens: number;
}

export interface RespuestaIA<T> {
  datos: T;
  usos: UsoTokens[];
}

/** Lo único del SDK que usa la app: así los tests pueden simularlo. */
export type ClienteAnthropic = Pick<Anthropic, "messages" | "beta">;

export function crearClienteAnthropic(): ClienteAnthropic {
  // Toma ANTHROPIC_API_KEY del entorno; nunca se escribe en el código.
  return new Anthropic({ maxRetries: 2, timeout: 120_000 });
}

type UsoApi = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

function uso(modelo: string, u: UsoApi): UsoTokens {
  return {
    modelo,
    entrada: u.input_tokens,
    salida: u.output_tokens,
    cacheLectura: u.cache_read_input_tokens ?? 0,
    cacheEscritura: u.cache_creation_input_tokens ?? 0,
  };
}

/**
 * Haiku: extracción y agrupación. Sin razonamiento extendido y con esfuerzo bajo,
 * porque son tareas acotadas y así el costo queda en centavos.
 */
export async function llamarRapido<S extends z.ZodType>(
  cliente: ClienteAnthropic,
  p: PedidoIA<S>,
): Promise<RespuestaIA<z.infer<S>>> {
  const r = await cliente.messages.parse({
    model: p.modelo,
    max_tokens: p.maxTokens,
    system: p.sistema,
    thinking: { type: "disabled" },
    output_config: { effort: "low", format: zodOutputFormat(p.esquema) },
    messages: [{ role: "user", content: p.usuario }],
  });
  const usos = [uso(r.model ?? p.modelo, r.usage)];
  if (r.stop_reason === "refusal") throw new ErrorIA("El modelo declinó responder", usos);
  if (r.stop_reason === "max_tokens") throw new ErrorIA("La respuesta superó el tope de tokens", usos);
  if (r.parsed_output == null) throw new ErrorIA("Respuesta sin formato válido", usos);
  return { datos: r.parsed_output as z.infer<S>, usos };
}

/**
 * Sonnet: comparación final. `between_tools` apaga el razonamiento extendido
 * (que se cobra como salida) y `fallbacks: "default"` reintenta del lado del
 * servidor si el modelo declina por sus filtros de seguridad.
 */
export async function llamarComparacion<S extends z.ZodType>(
  cliente: ClienteAnthropic,
  p: PedidoIA<S>,
): Promise<RespuestaIA<z.infer<S>>> {
  const r = await cliente.beta.messages.parse({
    model: p.modelo,
    max_tokens: p.maxTokens,
    system: p.sistema,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "between_tools" },
    output_config: { effort: "medium", format: betaZodOutputFormat(p.esquema) },
    messages: [{ role: "user", content: p.usuario }],
  });
  // Si hubo respaldo, cada intento trae su propio uso y su modelo.
  const its = r.usage.iterations ?? [];
  const usos = its.length
    ? its.map((it) => uso(("model" in it && it.model) || p.modelo, it as UsoApi))
    : [uso(r.model ?? p.modelo, r.usage)];
  if (r.stop_reason === "refusal") throw new ErrorIA("El modelo declinó responder", usos);
  if (r.stop_reason === "max_tokens") throw new ErrorIA("La respuesta superó el tope de tokens", usos);
  if (r.parsed_output == null) throw new ErrorIA("Respuesta sin formato válido", usos);
  return { datos: r.parsed_output as z.infer<S>, usos };
}
