import fs from "node:fs";
import path from "node:path";
import type { Db } from "./index";

/** Aplica los archivos de sql/ en orden. Son idempotentes. */
export async function migrar(db: Db, dirSql = path.join(process.cwd(), "sql")): Promise<void> {
  const archivos = fs.readdirSync(dirSql).filter((f) => f.endsWith(".sql")).sort();
  for (const f of archivos) {
    await db.query(fs.readFileSync(path.join(dirSql, f), "utf8"));
  }
}
