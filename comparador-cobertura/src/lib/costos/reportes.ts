import { mesActual, type Db } from "@/lib/db";

const FILTRO_MES = `to_char(l.creado AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM') = $1`;

export interface ResumenMes {
  gastoUsd: number;
  llamadas: number;
  comparaciones: number;
  promedioPorComparacionUsd: number;
}

export async function resumenDelMes(db: Db, mes = mesActual()): Promise<ResumenMes> {
  const r = await db.query<{ gasto: string; llamadas: string; comparaciones: string }>(
    `SELECT COALESCE(SUM(costo_usd),0) AS gasto, COUNT(*) AS llamadas, COUNT(DISTINCT comparacion_id) AS comparaciones
       FROM llamadas_ia l WHERE ${FILTRO_MES}`,
    [mes],
  );
  const gastoUsd = Number(r.rows[0].gasto);
  const comparaciones = Number(r.rows[0].comparaciones);
  return {
    gastoUsd,
    llamadas: Number(r.rows[0].llamadas),
    comparaciones,
    promedioPorComparacionUsd: comparaciones ? gastoUsd / comparaciones : 0,
  };
}

export interface CostoComparacion {
  id: number;
  titulo: string | null;
  estado: string;
  creado: Date;
  email: string | null;
  llamadas: number;
  tokensEntrada: number;
  tokensSalida: number;
  costoUsd: number;
  costoPorEtapa: Record<string, number>;
}

export async function costosPorComparacion(db: Db, mes = mesActual(), limite = 50): Promise<CostoComparacion[]> {
  const r = await db.query<{
    id: number;
    titulo: string | null;
    estado: string;
    creado: Date;
    email: string | null;
    llamadas: string;
    entrada: string;
    salida: string;
    costo: string;
    por_etapa: Record<string, string>;
  }>(
    `SELECT c.id, c.titulo, c.estado, c.creado, u.email,
            COUNT(*) AS llamadas, SUM(l.tokens_entrada) AS entrada, SUM(l.tokens_salida) AS salida,
            SUM(l.costo_usd) AS costo,
            (SELECT jsonb_object_agg(etapa, total) FROM (
               SELECT etapa, SUM(costo_usd) AS total FROM llamadas_ia WHERE comparacion_id = c.id GROUP BY etapa) e) AS por_etapa
       FROM llamadas_ia l
       JOIN comparaciones c ON c.id = l.comparacion_id
       LEFT JOIN usuarios u ON u.id = c.creado_por
      WHERE ${FILTRO_MES}
      GROUP BY c.id, u.email
      ORDER BY c.creado DESC
      LIMIT $2`,
    [mes, limite],
  );
  return r.rows.map((x) => ({
    id: x.id,
    titulo: x.titulo,
    estado: x.estado,
    creado: x.creado,
    email: x.email,
    llamadas: Number(x.llamadas),
    tokensEntrada: Number(x.entrada),
    tokensSalida: Number(x.salida),
    costoUsd: Number(x.costo),
    costoPorEtapa: Object.fromEntries(Object.entries(x.por_etapa ?? {}).map(([k, v]) => [k, Number(v)])),
  }));
}

export interface CostoUsuario {
  usuarioId: number;
  email: string;
  plan: string;
  comparacionesNuevas: number;
  costoUsd: number;
}

export async function costosPorUsuario(db: Db, mes = mesActual()): Promise<CostoUsuario[]> {
  const r = await db.query<{ id: number; email: string; plan: string; nuevas: number | null; costo: string }>(
    `SELECT u.id, u.email, u.plan, m.comparaciones AS nuevas, COALESCE(SUM(l.costo_usd), 0) AS costo
       FROM usuarios u
       LEFT JOIN uso_mensual m ON m.usuario_id = u.id AND m.mes = $1
       LEFT JOIN llamadas_ia l ON l.usuario_id = u.id AND ${FILTRO_MES}
      GROUP BY u.id, m.comparaciones
     HAVING COALESCE(SUM(l.costo_usd), 0) > 0 OR COALESCE(m.comparaciones, 0) > 0
      ORDER BY costo DESC`,
    [mes],
  );
  return r.rows.map((x) => ({
    usuarioId: x.id,
    email: x.email,
    plan: x.plan,
    comparacionesNuevas: x.nuevas ?? 0,
    costoUsd: Number(x.costo),
  }));
}
