/**
 * Carga una comparación de ejemplo SIN red y SIN API key: usa los sitios y la IA
 * simulados de los tests contra la base de DATABASE_URL. Sirve para ver la interfaz
 * y el registro de costos. Los costos que registra son simulados.
 *
 * Uso: npm run demo
 */
import pg from "pg";
import { migrar } from "../src/lib/db/migrar";
import { procesarComparacion, solicitarComparacion, costoDeComparacion } from "../src/lib/comparar";
import { LectorWeb } from "../src/lib/extraccion/red";
import { registrarUsuario } from "../src/lib/auth";
import { fetchSimulado, URLS } from "../tests/fixtures/sitios";
import { anthropicSimulado } from "../tests/fixtures/anthropic-simulado";

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
await migrar(db);
const email = "demo@ejemplo.org";
await registrarUsuario(db, email, "demo-demo-demo");
const { id } = (await db.query<{ id: number }>("SELECT id FROM usuarios WHERE email=$1", [email])).rows[0];

const ia = anthropicSimulado({ citas: { infobae: "oficializó este viernes un aumento del 12%" } });
const deps = { db, lector: new LectorWeb({ fetchImpl: fetchSimulado().fetch, sinEsperas: true }), ia: ia.cliente };

const r1 = await solicitarComparacion(deps, URLS.infobae, id);
console.log("Primer pedido:", r1);
if (r1.tipo === "nueva") await procesarComparacion(deps, r1.comparacionId, id);
const llamadas1 = ia.llamadas.length;

const r2 = await solicitarComparacion(deps, URLS.clarin, id);
console.log("Segundo pedido (link de otro medio de la misma noticia):", r2);
console.log("Llamadas a la IA en el segundo pedido:", ia.llamadas.length - llamadas1);

if (r1.tipo !== "rechazada") {
  const c = await db.query("SELECT estado, error, resultado FROM comparaciones WHERE id=$1", [r1.comparacionId]);
  const res = c.rows[0].resultado;
  console.log("Estado:", c.rows[0].estado, c.rows[0].error ?? "");
  console.log("Medios comparados:", res?.fuentes.map((f: { medio: string }) => f.medio).join(", "));
  console.log("No verificado:", res?.comparacion?.noVerificado.length ?? 0, "ítems");
  console.log("Costo registrado:", await costoDeComparacion(db, r1.comparacionId));
  console.log(`\nAbrí http://localhost:3000/comparacion/${r1.comparacionId} (usuario ${email} / demo-demo-demo)`);
}
await db.end();
