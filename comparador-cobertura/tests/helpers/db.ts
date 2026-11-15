import pg from "pg";
import { migrar } from "@/lib/db";

export const URL_TEST =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/comparador_test";

/** Pool contra la base de tests, con el esquema recreado desde cero. */
export async function baseDeTest(): Promise<pg.Pool> {
  const db = new pg.Pool({ connectionString: URL_TEST, max: 5 });
  await db.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await migrar(db);
  return db;
}

export async function crearUsuario(db: pg.Pool, email = "ana@ejemplo.org", plan = "gratis"): Promise<number> {
  const r = await db.query<{ id: number }>(
    `INSERT INTO usuarios (email, hash_clave, plan) VALUES ($1, 'x', $2) RETURNING id`,
    [email, plan],
  );
  return r.rows[0].id;
}
