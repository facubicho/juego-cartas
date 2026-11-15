import pg from "pg";
import { migrar } from "../src/lib/db/index.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL");
  process.exit(1);
}
const db = new pg.Pool({ connectionString: url });
await migrar(db);
await db.end();
console.log("Migraciones aplicadas.");
