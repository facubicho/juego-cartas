import {
  PRECIOS,
  FACTOR_LOTE,
  FACTOR_CACHE_LECTURA,
  FACTOR_CACHE_ESCRITURA,
  PRECIO_DESCONOCIDO,
  type PrecioModelo,
} from "@config/precios";
import { LIMITES } from "@config/limites";
import { mesActual, type Db } from "@/lib/db";

export interface UsoTokens {
  modelo: string;
  entrada: number;
  salida: number;
  cacheLectura?: number;
  cacheEscritura?: number;
}

export type Modo = "tiempo_real" | "lote";

/** Costo estimado en USD de una llamada, según la tabla de config/precios.ts. */
export function calcularCosto(
  uso: UsoTokens,
  modo: Modo = "tiempo_real",
  precios: Record<string, PrecioModelo> = PRECIOS,
): number {
  const p = precios[uso.modelo] ?? PRECIO_DESCONOCIDO;
  const porToken = (usdPorMillon: number) => usdPorMillon / 1_000_000;
  let costo =
    uso.entrada * porToken(p.entrada) +
    uso.salida * porToken(p.salida) +
    (uso.cacheLectura ?? 0) * porToken(p.entrada) * FACTOR_CACHE_LECTURA +
    (uso.cacheEscritura ?? 0) * porToken(p.entrada) * FACTOR_CACHE_ESCRITURA;
  if (modo === "lote") costo *= FACTOR_LOTE;
  // Redondeo a 6 decimales, igual que la columna de la base.
  return Math.round(costo * 1e6) / 1e6;
}

export interface RegistroLlamada extends UsoTokens {
  etapa: string;
  modo?: Modo;
  comparacionId: number | null;
  usuarioId: number | null;
}

export async function registrarLlamada(db: Db, r: RegistroLlamada): Promise<number> {
  const modo = r.modo ?? "tiempo_real";
  const costo = calcularCosto(r, modo);
  await db.query(
    `INSERT INTO llamadas_ia (etapa, modelo, modo, tokens_entrada, tokens_salida,
       tokens_cache_lectura, tokens_cache_escritura, costo_usd, comparacion_id, usuario_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      r.etapa,
      r.modelo,
      modo,
      r.entrada,
      r.salida,
      r.cacheLectura ?? 0,
      r.cacheEscritura ?? 0,
      costo,
      r.comparacionId,
      r.usuarioId,
    ],
  );
  return costo;
}

/** Tope de gasto mensual global vigente, en USD. */
export function topeGastoMensual(): number {
  const env = Number(process.env.TOPE_GASTO_MENSUAL_USD);
  return Number.isFinite(env) && process.env.TOPE_GASTO_MENSUAL_USD !== ""
    ? env
    : LIMITES.topeGastoMensualUsdPorDefecto;
}

const FILTRO_MES = `to_char(creado AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM') = $1`;

export async function gastoDelMes(db: Db, mes = mesActual()): Promise<number> {
  const r = await db.query<{ total: string | null }>(
    `SELECT COALESCE(SUM(costo_usd), 0) AS total FROM llamadas_ia WHERE ${FILTRO_MES}`,
    [mes],
  );
  return Number(r.rows[0].total ?? 0);
}

export async function topeAlcanzado(db: Db): Promise<boolean> {
  return (await gastoDelMes(db)) >= topeGastoMensual();
}

export function cuotaDePlan(plan: string): number {
  return LIMITES.cuotaMensual[plan] ?? LIMITES.cuotaMensual.gratis;
}

export interface EstadoCuota {
  plan: string;
  usadas: number;
  limite: number;
  restantes: number;
}

export async function estadoCuota(db: Db, usuarioId: number, mes = mesActual()): Promise<EstadoCuota> {
  const r = await db.query<{ plan: string; usadas: number | null }>(
    `SELECT u.plan, m.comparaciones AS usadas
       FROM usuarios u LEFT JOIN uso_mensual m ON m.usuario_id = u.id AND m.mes = $2
      WHERE u.id = $1`,
    [usuarioId, mes],
  );
  if (!r.rows[0]) throw new Error("Usuario inexistente");
  const plan = r.rows[0].plan;
  const usadas = r.rows[0].usadas ?? 0;
  const limite = cuotaDePlan(plan);
  return { plan, usadas, limite, restantes: Math.max(0, limite - usadas) };
}

/**
 * Reserva una comparación nueva de la cuota del mes, de forma atómica:
 * dos pedidos simultáneos no pueden pasarse del límite.
 * Devuelve false si no queda cuota.
 */
export async function reservarCuota(db: Db, usuarioId: number, mes = mesActual()): Promise<boolean> {
  const { limite } = await estadoCuota(db, usuarioId, mes);
  if (limite <= 0) return false;
  const r = await db.query(
    `INSERT INTO uso_mensual (usuario_id, mes, comparaciones) VALUES ($1, $2, 1)
     ON CONFLICT (usuario_id, mes) DO UPDATE
       SET comparaciones = uso_mensual.comparaciones + 1
       WHERE uso_mensual.comparaciones < $3
     RETURNING comparaciones`,
    [usuarioId, mes, limite],
  );
  return (r.rowCount ?? 0) > 0;
}

/** Devuelve una comparación a la cuota (por ejemplo, si falló antes de generar nada). */
export async function devolverCuota(db: Db, usuarioId: number, mes = mesActual()): Promise<void> {
  await db.query(
    `UPDATE uso_mensual SET comparaciones = GREATEST(comparaciones - 1, 0)
      WHERE usuario_id = $1 AND mes = $2`,
    [usuarioId, mes],
  );
}
