import Link from "next/link";
import { FormularioLink } from "@/components/FormularioLink";
import { usuarioActual } from "@/lib/servidor";
import { obtenerDb } from "@/lib/db";
import { mediosActivos } from "@config/medios";

export const dynamic = "force-dynamic";

export default async function Inicio() {
  const usuario = await usuarioActual();
  const recientes = await obtenerDb().query<{ id: number; titulo: string }>(
    `SELECT id, titulo FROM comparaciones WHERE estado = 'lista' AND titulo IS NOT NULL ORDER BY creado DESC LIMIT 6`,
  );
  return (
    <>
      <h1>¿Cómo contaron esta noticia los otros diarios?</h1>
      <p className="bajada">
        Pegá el link de una nota y te mostramos cómo cubrieron el mismo hecho otros medios: en qué coinciden, qué datos
        cambian y qué pone en primer plano cada uno. Solo usamos lo que cada diario muestra sin suscripción.
      </p>
      <div className="tarjeta">
        <FormularioLink conSesion={!!usuario} />
        <ul className="chips" aria-label="Medios incluidos">
          {mediosActivos().map((m) => (
            <li key={m.id}>{m.nombre}</li>
          ))}
        </ul>
      </div>

      {recientes.rows.length > 0 && (
        <>
          <h2>Comparaciones recientes</h2>
          <ul className="lista">
            {recientes.rows.map((c) => (
              <li key={c.id}>
                <Link href={`/comparacion/${c.id}`}>{c.titulo}</Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2>Cómo funciona</h2>
      <ul className="lista">
        <li>Leemos titular, bajada y el texto que cada diario muestra gratis. Si una nota tiene muro de pago, solo usamos la parte abierta.</li>
        <li>Respetamos las reglas de acceso de cada sitio. Si un diario no permite la lectura automática, lo indicamos y seguimos con los demás.</li>
        <li>No decimos qué medio es mejor ni le asignamos ideología: describimos lo que hace cada nota.</li>
        <li>Lo que no se puede comprobar con el texto público aparece como “no verificado”.</li>
        <li>Si alguien ya pidió la misma noticia, te mostramos ese resultado y no se descuenta de tu cuota.</li>
      </ul>
    </>
  );
}
