import type pg from "pg";
import { mediosActivos, medioPorUrl, MEDIOS, type Medio } from "@config/medios";
import { MODELOS } from "@config/precios";
import { LIMITES } from "@config/limites";
import { enTransaccion, mesActual, type Db } from "@/lib/db";
import { registrarLlamada, reservarCuota, devolverCuota, topeAlcanzado, type UsoTokens } from "@/lib/costos";
import { LectorWeb, NoDisponible } from "@/lib/extraccion/red";
import { parsearNota, type NotaPublica } from "@/lib/extraccion/parsear";
import { normalizarUrl, variantesUrl } from "@/lib/extraccion/texto";
import { itemsDeMedio, elegirCandidatas } from "@/lib/busqueda/feeds";
import { ErrorIA, llamarComparacion, llamarRapido, type ClienteAnthropic, type RespuestaIA } from "@/lib/ia/cliente";
import { Agrupacion, Comparacion, ExtraccionNota } from "@/lib/ia/esquemas";
import { SISTEMA_AGRUPACION, SISTEMA_COMPARACION, SISTEMA_EXTRACCION, bloqueNota } from "@/lib/ia/prompts";
import { sanearComparacion } from "@/lib/ia/salida";

export interface Dependencias {
  db: pg.Pool;
  lector: LectorWeb;
  ia: ClienteAnthropic;
  medios?: Medio[];
}

export type ResultadoSolicitud =
  | { tipo: "existente"; comparacionId: number }
  | { tipo: "nueva"; comparacionId: number }
  | { tipo: "rechazada"; motivo: "url_invalida" | "medio_no_soportado" | "tope" | "cuota"; mensaje: string };

/** Busca una comparación (lista o en curso) que ya incluya esta URL. */
export async function buscarExistente(db: Db, url: string): Promise<number | null> {
  const r = await db.query<{ id: number }>(
    `SELECT c.id FROM notas n JOIN comparaciones c ON c.id = n.comparacion_id
      WHERE (n.url = ANY($1) OR n.url_canonica = ANY($1))
        AND n.estado IN ('pendiente', 'ok')
        AND (c.estado = 'lista'
             -- Una comparación en curso hace más de 10 minutos se considera colgada.
             OR (c.estado = 'procesando' AND c.actualizado > now() - interval '10 minutes'))
      ORDER BY c.creado DESC LIMIT 1`,
    [variantesUrl(url)],
  );
  return r.rows[0]?.id ?? null;
}

/**
 * Paso 1 del flujo: decide si la noticia ya está analizada (se reutiliza, gratis)
 * o si hay que generar una nueva (se controla tope global y cuota).
 * Todo ocurre bajo un lock por URL para que dos pedidos simultáneos no generen dos análisis.
 */
export async function solicitarComparacion(
  deps: Pick<Dependencias, "db" | "medios">,
  urlCruda: string,
  usuarioId: number,
): Promise<ResultadoSolicitud> {
  let url: string;
  try {
    url = normalizarUrl(urlCruda);
  } catch {
    return { tipo: "rechazada", motivo: "url_invalida", mensaje: "Eso no parece un link válido." };
  }
  const medio = medioPorUrl(url, mediosActivos(deps.medios ?? MEDIOS));
  if (!medio) {
    return {
      tipo: "rechazada",
      motivo: "medio_no_soportado",
      mensaje: "Por ahora solo comparamos notas de los medios de la lista.",
    };
  }

  return enTransaccion(deps.db, async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [url]);
    const existente = await buscarExistente(tx, url);
    if (existente) return { tipo: "existente", comparacionId: existente } as const;

    if (await topeAlcanzado(tx)) {
      return {
        tipo: "rechazada",
        motivo: "tope",
        mensaje:
          "Este mes se alcanzó el tope de gasto de la app, así que no podemos generar análisis nuevos. Las noticias ya analizadas se pueden seguir viendo.",
      } as const;
    }
    if (!(await reservarCuota(tx, usuarioId))) {
      return {
        tipo: "rechazada",
        motivo: "cuota",
        mensaje: "Ya usaste todas tus comparaciones nuevas de este mes. Las noticias ya analizadas no cuentan.",
      } as const;
    }
    const c = await tx.query<{ id: number }>(
      `INSERT INTO comparaciones (estado, url_origen, creado_por) VALUES ('procesando', $1, $2) RETURNING id`,
      [url, usuarioId],
    );
    const id = c.rows[0].id;
    await tx.query(
      `INSERT INTO notas (comparacion_id, medio_id, url, es_origen, estado) VALUES ($1, $2, $3, true, 'pendiente')`,
      [id, medio.id, url],
    );
    return { tipo: "nueva", comparacionId: id } as const;
  });
}

interface NotaEnCurso {
  filaId: number;
  medio: Medio;
  nota: NotaPublica;
  esOrigen: boolean;
  extraccion?: ExtraccionNota;
}

export interface Fuente {
  medioId: string;
  medio: string;
  titulo: string;
  url: string;
  fecha: string | null;
  muroPago: boolean;
  esOrigen: boolean;
}

export interface ResultadoGuardado {
  comparacion: Comparacion | null;
  fuentes: Fuente[];
  noDisponibles: { medio: string; motivo: string }[];
  sinCoincidencia: string[];
  descartadas: { medio: string; titulo: string; url: string; motivo: string }[];
  avisos: string[];
  generado: string;
}

/**
 * Paso 2 del flujo: hace el trabajo pesado (lectura, búsqueda y las tres etapas de IA)
 * y guarda el resultado. Pensado para correr en segundo plano.
 */
export async function procesarComparacion(deps: Dependencias, comparacionId: number, usuarioId: number | null): Promise<void> {
  const { db, lector, ia } = deps;
  const lista = mediosActivos(deps.medios ?? MEDIOS);
  const mes = mesActual();
  let llamadas = 0;

  const conIA = async <T>(etapa: string, fn: () => Promise<RespuestaIA<T>>): Promise<T> => {
    const registrar = async (usos: UsoTokens[]) => {
      for (const u of usos) {
        llamadas++;
        await registrarLlamada(db, { ...u, etapa, comparacionId, usuarioId });
      }
    };
    try {
      const r = await fn();
      await registrar(r.usos);
      return r.datos;
    } catch (e) {
      if (e instanceof ErrorIA) await registrar(e.usos);
      throw e;
    }
  };

  try {
    const fila = (
      await db.query<{ id: number; medio_id: string; url: string }>(
        `SELECT id, medio_id, url FROM notas WHERE comparacion_id = $1 AND es_origen`,
        [comparacionId],
      )
    ).rows[0];
    const medioOrigen = lista.find((m) => m.id === fila.medio_id) ?? MEDIOS.find((m) => m.id === fila.medio_id)!;

    // 1. Nota original
    let origen: NotaPublica;
    try {
      const { texto, urlFinal } = await lector.leer(fila.url);
      origen = parsearNota(texto, urlFinal, medioOrigen);
    } catch (e) {
      const motivo = e instanceof NoDisponible ? e.motivo : (e as Error).message;
      throw new Error(`No pudimos leer la nota original: ${motivo}.`);
    }
    if (!origen.titulo) throw new Error("No encontramos el titular de la nota.");
    const canonica = safeNormalizar(new URL(origen.urlCanonica, fila.url).toString());
    await db.query(
      `UPDATE notas SET estado='ok', url_canonica=$2, titulo=$3, bajada=$4, fecha=$5, muro_pago=$6 WHERE id=$1`,
      [fila.id, canonica, origen.titulo, origen.bajada, fechaValida(origen.fecha), origen.muroPago],
    );
    await db.query(`UPDATE comparaciones SET titulo=$2, actualizado=now() WHERE id=$1`, [comparacionId, origen.titulo]);

    const notas: NotaEnCurso[] = [{ filaId: fila.id, medio: medioOrigen, nota: origen, esOrigen: true }];

    // 2. Búsqueda en los otros medios (en paralelo; cada medio que falla se informa y se sigue)
    const otros = lista.filter((m) => m.id !== medioOrigen.id);
    const encontradas = await Promise.all(
      otros.map(async (m): Promise<NotaEnCurso | null> => {
        try {
          const items = await itemsDeMedio(lector, m);
          const [mejor] = elegirCandidatas(origen, items);
          if (!mejor) {
            await insertarNota(db, comparacionId, m.id, null, "sin_coincidencia", "No encontramos una nota sobre el mismo hecho en sus feeds.");
            return null;
          }
          const { texto, urlFinal } = await lector.leer(mejor.url);
          const nota = parsearNota(texto, urlFinal, m);
          const id = await insertarNota(db, comparacionId, m.id, safeNormalizar(mejor.url), "pendiente", null, nota);
          return { filaId: id, medio: m, nota, esOrigen: false };
        } catch (e) {
          const motivo = e instanceof NoDisponible ? e.motivo : `error al leer (${(e as Error).message})`;
          await insertarNota(db, comparacionId, m.id, null, "no_disponible", motivo);
          return null;
        }
      }),
    );
    notas.push(...encontradas.filter((n): n is NotaEnCurso => n !== null));

    // 3. Etapa 1: extracción por nota (Haiku)
    await Promise.all(
      notas.map(async (n, i) => {
        n.extraccion = await conIA("extraccion", () =>
          llamarRapido(ia, {
            modelo: MODELOS.extraccion,
            sistema: SISTEMA_EXTRACCION,
            usuario: bloqueNota({ id: `n${i}`, medio: n.medio.nombre, ...n.nota }),
            esquema: ExtraccionNota,
            maxTokens: LIMITES.maxTokensSalida.extraccion,
          }),
        );
      }),
    );

    // 4. Etapa 2: confirmar que es el mismo hecho (Haiku)
    const candidatas = notas.filter((n) => !n.esOrigen);
    if (candidatas.length) {
      const resumen = (n: NotaEnCurso, id: string) =>
        `<nota id="${id}" medio="${n.medio.nombre}" fecha="${n.nota.fecha ?? "desconocida"}">\n<titulo>${n.nota.titulo}</titulo>\n<bajada>${n.nota.bajada}</bajada>\n<hechos>${(n.extraccion?.hechos ?? []).map((h) => h.texto).join(" | ")}</hechos>\n</nota>`;
      const ag = await conIA("agrupacion", () =>
        llamarRapido(ia, {
          modelo: MODELOS.agrupacion,
          sistema: SISTEMA_AGRUPACION,
          usuario: `Original:\n${resumen(notas[0], "original")}\n\nCandidatas:\n${candidatas.map((n) => resumen(n, n.medio.id)).join("\n")}`,
          esquema: Agrupacion,
          maxTokens: LIMITES.maxTokensSalida.agrupacion,
        }),
      );
      for (const n of candidatas) {
        const v = ag.notas.find((x) => x.id === n.medio.id);
        if (v && !v.mismoHecho) {
          await db.query(`UPDATE notas SET estado='descartada', motivo=$2 WHERE id=$1`, [n.filaId, v.motivo]);
          notas.splice(notas.indexOf(n), 1);
        }
      }
    }
    for (const n of notas) {
      await db.query(`UPDATE notas SET estado='ok', extraccion=$2 WHERE id=$1`, [n.filaId, JSON.stringify(n.extraccion)]);
    }

    // 5. Etapa 3: comparación final (Sonnet). Recibe las extracciones, no las notas completas.
    let comparacion: Comparacion | null = null;
    const avisos: string[] = [];
    if (notas.length >= 2) {
      const entrada = notas
        .map(
          (n) =>
            `<medio id="${n.medio.id}" nombre="${n.medio.nombre}" muro_de_pago="${n.nota.muroPago}">\n<titulo>${n.nota.titulo}</titulo>\n<bajada>${n.nota.bajada}</bajada>\n<extraccion>${JSON.stringify(n.extraccion)}</extraccion>\n</medio>`,
        )
        .join("\n");
      const bruto = await conIA("comparacion", () =>
        llamarComparacion(ia, {
          modelo: MODELOS.comparacion,
          sistema: SISTEMA_COMPARACION,
          usuario: entrada,
          esquema: Comparacion,
          maxTokens: LIMITES.maxTokensSalida.comparacion,
        }),
      );
      const textos = Object.fromEntries(notas.map((n) => [n.medio.id, n.nota.textoPublico]));
      const s = sanearComparacion(bruto, textos);
      comparacion = s.comparacion;
      avisos.push(...s.cambios);
    } else {
      avisos.push("No encontramos la misma noticia en otros medios, así que no hay comparación.");
    }

    // 6. Guardar
    const filas = (
      await db.query<{ medio_id: string; url: string | null; titulo: string | null; fecha: Date | null; muro_pago: boolean; es_origen: boolean; estado: string; motivo: string | null }>(
        `SELECT medio_id, url, titulo, fecha, muro_pago, es_origen, estado, motivo FROM notas WHERE comparacion_id = $1 ORDER BY es_origen DESC, id`,
        [comparacionId],
      )
    ).rows;
    const nombre = (id: string) => MEDIOS.find((m) => m.id === id)?.nombre ?? id;
    const resultado: ResultadoGuardado = {
      comparacion,
      fuentes: filas
        .filter((f) => f.estado === "ok")
        .map((f) => ({
          medioId: f.medio_id,
          medio: nombre(f.medio_id),
          titulo: f.titulo ?? "",
          url: f.url ?? "",
          fecha: f.fecha ? f.fecha.toISOString() : null,
          muroPago: f.muro_pago,
          esOrigen: f.es_origen,
        })),
      noDisponibles: filas.filter((f) => f.estado === "no_disponible").map((f) => ({ medio: nombre(f.medio_id), motivo: f.motivo ?? "" })),
      sinCoincidencia: filas.filter((f) => f.estado === "sin_coincidencia").map((f) => nombre(f.medio_id)),
      descartadas: filas
        .filter((f) => f.estado === "descartada")
        .map((f) => ({ medio: nombre(f.medio_id), titulo: f.titulo ?? "", url: f.url ?? "", motivo: f.motivo ?? "" })),
      avisos,
      generado: new Date().toISOString(),
    };
    await db.query(`UPDATE comparaciones SET estado='lista', resultado=$2, actualizado=now() WHERE id=$1`, [
      comparacionId,
      JSON.stringify(resultado),
    ]);
  } catch (e) {
    await db.query(`UPDATE comparaciones SET estado='error', error=$2, actualizado=now() WHERE id=$1`, [
      comparacionId,
      (e as Error).message,
    ]);
    // Si no se llegó a gastar en IA, la comparación no cuenta contra la cuota.
    if (llamadas === 0 && usuarioId) await devolverCuota(db, usuarioId, mes);
  }
}

async function insertarNota(
  db: Db,
  comparacionId: number,
  medioId: string,
  url: string | null,
  estado: string,
  motivo: string | null,
  nota?: NotaPublica,
): Promise<number> {
  const r = await db.query<{ id: number }>(
    `INSERT INTO notas (comparacion_id, medio_id, url, url_canonica, estado, motivo, titulo, bajada, fecha, muro_pago)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [
      comparacionId,
      medioId,
      url,
      nota && url ? safeNormalizar(new URL(nota.urlCanonica, url).toString()) : null,
      estado,
      motivo,
      nota?.titulo ?? null,
      nota?.bajada ?? null,
      fechaValida(nota?.fecha ?? null),
      nota?.muroPago ?? false,
    ],
  );
  return r.rows[0].id;
}

function safeNormalizar(u: string): string {
  try {
    return normalizarUrl(u);
  } catch {
    return u;
  }
}

function fechaValida(f: string | null): string | null {
  return f && !Number.isNaN(Date.parse(f)) ? new Date(f).toISOString() : null;
}

export async function costoDeComparacion(db: Db, id: number): Promise<{ usd: number; llamadas: number }> {
  const r = await db.query<{ usd: string; n: string }>(
    `SELECT COALESCE(SUM(costo_usd),0) AS usd, COUNT(*) AS n FROM llamadas_ia WHERE comparacion_id = $1`,
    [id],
  );
  return { usd: Number(r.rows[0].usd), llamadas: Number(r.rows[0].n) };
}
