import type { Comparacion } from "./esquemas";
import { normalizar } from "@/lib/busqueda/similitud";

export const MAX_PALABRAS_CITA = 14; // "menos de 15 palabras"

const palabras = (s: string) => normalizar(s).split(/\s+/).filter(Boolean);

/** Secuencias de N palabras seguidas de un texto (para detectar copia literal). */
function tejas(texto: string, n: number): Set<string> {
  const p = palabras(texto);
  const out = new Set<string>();
  for (let i = 0; i + n <= p.length; i++) out.add(p.slice(i, i + n).join(" "));
  return out;
}

/**
 * Una cita es válida si tiene menos de 15 palabras y aparece de verdad en el texto
 * público de la nota (si no aparece, sería una cita inventada).
 */
export function citaValida(cita: string | null | undefined, textoPublico: string): string | null {
  if (!cita) return null;
  const limpia = cita.replace(/^["“«']+|["”»']+$/g, "").trim();
  const n = palabras(limpia).length;
  if (n === 0 || n > MAX_PALABRAS_CITA) return null;
  if (!normalizar(textoPublico).replace(/\s+/g, " ").includes(palabras(limpia).join(" "))) return null;
  return limpia;
}

export interface Saneamiento {
  comparacion: Comparacion;
  cambios: string[];
}

/**
 * Aplica las reglas de derechos de autor sobre la salida del modelo, sin confiar en
 * que las haya cumplido:
 *  - una sola cita por nota, de menos de 15 palabras y presente en el texto público;
 *  - ningún campo puede copiar 15 palabras seguidas de una nota;
 *  - solo medios que efectivamente forman parte de la comparación.
 */
export function sanearComparacion(c: Comparacion, textos: Record<string, string>): Saneamiento {
  const cambios: string[] = [];
  const medios = new Set(Object.keys(textos));
  const tejasNotas = new Set<string>();
  for (const t of Object.values(textos)) for (const x of tejas(t, MAX_PALABRAS_CITA + 1)) tejasNotas.add(x);

  const limpiar = (s: string): string => {
    for (const x of tejas(s, MAX_PALABRAS_CITA + 1)) {
      if (tejasNotas.has(x)) {
        cambios.push("Se omitió un fragmento que reproducía el texto original");
        return "[fragmento omitido: reproducía el texto original]";
      }
    }
    return s;
  };

  const tabla = c.tabla
    .filter((f) => medios.has(f.medioId) || (cambios.push(`Se descartó una fila de un medio desconocido (${f.medioId})`), false))
    .map((f) => {
      const cita = citaValida(f.citaTextual, textos[f.medioId] ?? "");
      if (f.citaTextual && !cita) cambios.push(`Se quitó una cita de ${f.medioId} que no cumplía las reglas`);
      return {
        ...f,
        enfoque: limpiar(f.enfoque),
        composicion: limpiar(f.composicion),
        cifrasClave: f.cifrasClave.map(limpiar),
        citaTextual: cita,
      };
    });

  return {
    cambios,
    comparacion: {
      resumenHecho: limpiar(c.resumenHecho),
      tabla,
      coincidencias: c.coincidencias.map(limpiar),
      diferenciasDeHechos: c.diferenciasDeHechos.map((d) => ({
        tema: limpiar(d.tema),
        porMedio: d.porMedio.filter((p) => medios.has(p.medioId)).map((p) => ({ ...p, version: limpiar(p.version) })),
      })),
      diferenciasDeEncuadre: c.diferenciasDeEncuadre.map((d) => ({
        aspecto: limpiar(d.aspecto),
        porMedio: d.porMedio
          .filter((p) => medios.has(p.medioId))
          .map((p) => ({ ...p, descripcion: limpiar(p.descripcion), ejemplo: limpiar(p.ejemplo) })),
      })),
      noVerificado: c.noVerificado.map((n) => ({ ...n, dato: limpiar(n.dato), medioId: n.medioId && medios.has(n.medioId) ? n.medioId : null })),
    },
  };
}
