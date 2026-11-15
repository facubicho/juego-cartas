/**
 * API de Anthropic simulada: responde con datos fijos y registra cada llamada.
 * Imita la forma de las respuestas de `messages.parse` y `beta.messages.parse`.
 */
import type { ClienteAnthropic } from "@/lib/ia/cliente";
import type { Agrupacion, Comparacion, ExtraccionNota } from "@/lib/ia/esquemas";

export const USO_SIMULADO = {
  extraccion: { input_tokens: 1800, output_tokens: 400 },
  agrupacion: { input_tokens: 900, output_tokens: 120 },
  comparacion: { input_tokens: 3000, output_tokens: 1400 },
};

export interface OpcionesSimulador {
  /** ids de medio que la etapa 2 debe marcar como "otro hecho" */
  descartar?: string[];
  /** cita que devuelve la etapa 3 para cada medio (para probar el saneamiento) */
  citas?: Record<string, string>;
  /** hacer que la etapa 3 devuelva una negativa */
  negarComparacion?: boolean;
}

export function anthropicSimulado(op: OpcionesSimulador = {}) {
  const llamadas: { endpoint: string; model: string; system: string; params: Record<string, unknown> }[] = [];

  const respuesta = (model: string, usage: { input_tokens: number; output_tokens: number }, parsed: unknown, stop = "end_turn") => ({
    id: "msg_simulado",
    type: "message",
    role: "assistant",
    model,
    content: [{ type: "text", text: JSON.stringify(parsed), parsed_output: parsed }],
    stop_reason: stop,
    stop_details: null,
    usage: { ...usage, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    parsed_output: parsed,
  });

  const parse = async (params: Record<string, unknown>) => {
    const system = String(params.system);
    const user = String((params.messages as { content: string }[])[0].content);
    const model = String(params.model);
    llamadas.push({ endpoint: "messages.parse", model, system, params });

    if (system.includes("extraé")) {
      const medio = /medio="([^"]+)"/.exec(user)?.[1] ?? "?";
      const datos: ExtraccionNota = {
        hechos: [
          { texto: "Sube 12% el boleto de colectivos del AMBA desde diciembre", tipo: "hecho", fuente: null },
          { texto: `Lectura propia de ${medio} sobre el impacto`, tipo: "atribucion", fuente: "fuente citada" },
        ],
        cifras: [{ dato: "boleto mínimo", valor: "1.120 pesos", atribuidoA: "Gobierno" }],
        fuentesCitadas: [{ nombre: "Secretaría de Transporte", tipo: "oficial" }],
        encuadre: { enfoque: `Enfoque de ${medio}`, enfasis: ["tarifas"], ejemplo: "Ejemplo parafraseado" },
        citaTextual: null,
        noVerificado: user.includes("muro de pago") ? [{ dato: "Reclamo empresario", motivo: "Está detrás del muro de pago" }] : [],
      };
      return respuesta(model, USO_SIMULADO.extraccion, datos);
    }
    if (system.includes("MISMO hecho")) {
      const ids = [...user.matchAll(/<nota id="([^"]+)"/g)].map((m) => m[1]).filter((id) => id !== "original");
      const datos: Agrupacion = {
        notas: ids.map((id) => ({ id, mismoHecho: !op.descartar?.includes(id), motivo: "Mismo anuncio de tarifas" })),
      };
      return respuesta(model, USO_SIMULADO.agrupacion, datos);
    }
    throw new Error("Pedido inesperado al simulador: " + system.slice(0, 60));
  };

  const betaParse = async (params: Record<string, unknown>) => {
    const user = String((params.messages as { content: string }[])[0].content);
    const model = String(params.model);
    llamadas.push({ endpoint: "beta.messages.parse", model, system: String(params.system), params });
    if (op.negarComparacion) return respuesta(model, { input_tokens: 3000, output_tokens: 0 }, null, "refusal");
    const ids = [...user.matchAll(/<medio id="([^"]+)"/g)].map((m) => m[1]);
    const datos: Comparacion = {
      resumenHecho: "El boleto mínimo de colectivos del AMBA sube 12% desde diciembre.",
      tabla: ids.map((id) => ({
        medioId: id,
        enfoque: `Enfoque de ${id}`,
        cifrasClave: ["12%", "1.120 pesos"],
        fuentesPrincipales: ["Secretaría de Transporte"],
        composicion: "Combina el anuncio oficial con atribuciones",
        citaTextual: op.citas?.[id] ?? null,
      })),
      coincidencias: ["Todos informan una suba del 12%"],
      diferenciasDeHechos: [{ tema: "Impacto", porMedio: ids.map((id) => ({ medioId: id, version: `Versión de ${id}` })) }],
      diferenciasDeEncuadre: [
        { aspecto: "Qué ponen primero", porMedio: ids.map((id) => ({ medioId: id, descripcion: `Prioridad de ${id}`, ejemplo: "ejemplo" })) },
      ],
      noVerificado: [{ dato: "Reclamo de las empresas", medioId: "clarin", motivo: "Detrás del muro de pago" }],
    };
    return respuesta(model, USO_SIMULADO.comparacion, datos);
  };

  const cliente = { messages: { parse }, beta: { messages: { parse: betaParse } } } as unknown as ClienteAnthropic;
  return { cliente, llamadas };
}
