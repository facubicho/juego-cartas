import pg from "pg";

/** Interfaz mínima que usan los módulos: sirve tanto para el pool como para una transacción. */
export interface Db {
  query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    sql: string,
    params?: unknown[],
  ): Promise<pg.QueryResult<T>>;
}

let pool: pg.Pool | undefined;

export function obtenerDb(): pg.Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Falta DATABASE_URL");
    pool = new pg.Pool({ connectionString: url, max: 10 });
  }
  return pool;
}

/** Corre una función dentro de una transacción. */
export async function enTransaccion<T>(db: pg.Pool, fn: (tx: Db) => Promise<T>): Promise<T> {
  const cliente = await db.connect();
  try {
    await cliente.query("BEGIN");
    const r = await fn(cliente);
    await cliente.query("COMMIT");
    return r;
  } catch (e) {
    await cliente.query("ROLLBACK");
    throw e;
  } finally {
    cliente.release();
  }
}

/** Mes actual en formato AAAA-MM, en hora de Argentina. */
export function mesActual(fecha = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(fecha);
  const y = partes.find((p) => p.type === "year")!.value;
  const m = partes.find((p) => p.type === "month")!.value;
  return `${y}-${m}`;
}
