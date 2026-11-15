import { z } from "zod";

/** Etapa 1: lo que se extrae de cada nota. */
export const ExtraccionNota = z.object({
  hechos: z.array(
    z.object({
      texto: z.string().describe("Paráfrasis breve del dato, nunca copiado del texto"),
      tipo: z.enum(["hecho", "atribucion", "opinion"]),
      fuente: z.string().nullable().describe("A quién se atribuye, si corresponde"),
    }),
  ),
  cifras: z.array(
    z.object({
      dato: z.string(),
      valor: z.string(),
      atribuidoA: z.string().nullable(),
    }),
  ),
  fuentesCitadas: z.array(
    z.object({
      nombre: z.string(),
      tipo: z.enum(["oficial", "privada", "experto", "testigo", "documento", "anonima", "otro"]),
    }),
  ),
  encuadre: z.object({
    enfoque: z.string().describe("Qué aspecto pone en primer plano la nota, descrito sin juzgar"),
    enfasis: z.array(z.string()),
    ejemplo: z.string().describe("Ejemplo parafraseado del texto que muestra el enfoque"),
  }),
  citaTextual: z
    .string()
    .nullable()
    .describe("Como máximo UNA cita textual de menos de 15 palabras, o null"),
  noVerificado: z.array(
    z.object({
      dato: z.string(),
      motivo: z.string(),
    }),
  ),
});
export type ExtraccionNota = z.infer<typeof ExtraccionNota>;

/** Etapa 2: confirmación de que las notas tratan el mismo hecho. */
export const Agrupacion = z.object({
  notas: z.array(
    z.object({
      id: z.string(),
      mismoHecho: z.boolean(),
      motivo: z.string(),
    }),
  ),
});
export type Agrupacion = z.infer<typeof Agrupacion>;

/** Etapa 3: comparación final. Los links a las notas los arma la app, no el modelo. */
export const Comparacion = z.object({
  resumenHecho: z.string().describe("Qué pasó, en una o dos oraciones, solo con lo que coinciden las notas"),
  tabla: z.array(
    z.object({
      medioId: z.string(),
      enfoque: z.string(),
      cifrasClave: z.array(z.string()),
      fuentesPrincipales: z.array(z.string()),
      composicion: z.string().describe("Cómo combina hechos, atribuciones y opinión, con un ejemplo"),
      citaTextual: z.string().nullable(),
    }),
  ),
  coincidencias: z.array(z.string()),
  diferenciasDeHechos: z.array(
    z.object({
      tema: z.string(),
      porMedio: z.array(z.object({ medioId: z.string(), version: z.string() })),
    }),
  ),
  diferenciasDeEncuadre: z.array(
    z.object({
      aspecto: z.string(),
      porMedio: z.array(z.object({ medioId: z.string(), descripcion: z.string(), ejemplo: z.string() })),
    }),
  ),
  noVerificado: z.array(
    z.object({
      dato: z.string(),
      medioId: z.string().nullable(),
      motivo: z.string(),
    }),
  ),
});
export type Comparacion = z.infer<typeof Comparacion>;
