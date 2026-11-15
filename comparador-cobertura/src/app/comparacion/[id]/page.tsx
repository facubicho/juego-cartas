import Link from "next/link";
import { notFound } from "next/navigation";
import { obtenerDb } from "@/lib/db";
import { costoDeComparacion, type ResultadoGuardado } from "@/lib/comparar";
import { Refrescar } from "@/components/Refrescar";
import { usd, fecha } from "@/lib/formato";

export const dynamic = "force-dynamic";

const TIPO_FUENTE: Record<string, string> = {
  oficial: "oficial",
  privada: "privada",
  experto: "especialista",
  testigo: "testigo",
  documento: "documento",
  anonima: "sin identificar",
  otro: "otra",
};

export default async function PaginaComparacion({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reutilizada?: string }>;
}) {
  const { id } = await params;
  const { reutilizada } = await searchParams;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) notFound();
  const db = obtenerDb();
  const r = await db.query<{ estado: string; titulo: string | null; url_origen: string; resultado: ResultadoGuardado | null; error: string | null }>(
    `SELECT estado, titulo, url_origen, resultado, error FROM comparaciones WHERE id = $1`,
    [n],
  );
  const c = r.rows[0];
  if (!c) notFound();

  if (c.estado === "procesando") {
    return (
      <>
        <Refrescar />
        <h1>{c.titulo ?? "Analizando la nota…"}</h1>
        <p className="mensaje aviso" role="status">
          Estamos leyendo la nota, buscando la misma noticia en otros medios y comparando. Suele tardar menos de un minuto; esta página se actualiza sola.
        </p>
      </>
    );
  }
  if (c.estado === "error" || !c.resultado) {
    return (
      <>
        <h1>No pudimos completar la comparación</h1>
        <p className="mensaje error">{c.error ?? "Ocurrió un error inesperado."}</p>
        <p>
          <Link href="/">Volver a intentar con otro link</Link>
        </p>
      </>
    );
  }

  const res = c.resultado;
  const cmp = res.comparacion;
  const nombre = (medioId: string | null) => res.fuentes.find((f) => f.medioId === medioId)?.medio ?? medioId ?? "General";
  const costo = await costoDeComparacion(db, n);
  const hayMuro = res.fuentes.some((f) => f.muroPago);

  return (
    <>
      <h1>{c.titulo}</h1>
      {cmp && <p className="bajada">{cmp.resumenHecho}</p>}
      {reutilizada && (
        <p className="mensaje ok">Esta noticia ya estaba analizada: te mostramos ese resultado y no se descontó de tu cuota.</p>
      )}
      {hayMuro && (
        <p className="mensaje aviso">
          Alguna nota tiene muro de pago: solo usamos la parte que el diario muestra gratis. Lo que no se pudo leer aparece como “no verificado”.
        </p>
      )}

      {cmp ? (
        <>
          <h2>Cómo la cubrió cada medio</h2>
          <div className="tabla-scroll">
            <table className="apilable">
              <thead>
                <tr>
                  <th>Medio</th>
                  <th>Qué pone en primer plano</th>
                  <th>Cifras</th>
                  <th>Fuentes</th>
                  <th>Hechos, atribuciones y opinión</th>
                </tr>
              </thead>
              <tbody>
                {cmp.tabla.map((f) => {
                  const fuente = res.fuentes.find((x) => x.medioId === f.medioId);
                  return (
                    <tr key={f.medioId}>
                      <td data-rotulo="Medio">
                        <span className="medio">{nombre(f.medioId)}</span>{" "}
                        {fuente?.muroPago && <span className="etiqueta">muro de pago</span>}
                        {fuente && (
                          <div>
                            <a href={fuente.url} target="_blank" rel="noopener noreferrer">
                              Leer la nota
                            </a>
                          </div>
                        )}
                      </td>
                      <td data-rotulo="Qué pone en primer plano">
                        {f.enfoque}
                        {f.citaTextual && <div className="cita">“{f.citaTextual}”</div>}
                      </td>
                      <td data-rotulo="Cifras">{f.cifrasClave.join(" · ") || "—"}</td>
                      <td data-rotulo="Fuentes">{f.fuentesPrincipales.join(" · ") || "—"}</td>
                      <td data-rotulo="Hechos, atribuciones y opinión">{f.composicion}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grilla" style={{ marginTop: 24 }}>
            <section className="tarjeta">
              <h2 style={{ marginTop: 0 }}>En qué coinciden</h2>
              <ul className="lista">
                {cmp.coincidencias.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </section>
            <section className="tarjeta">
              <h2 style={{ marginTop: 0 }}>Diferencias en los hechos</h2>
              {cmp.diferenciasDeHechos.length === 0 && <p className="pie">No encontramos datos que no coincidan.</p>}
              {cmp.diferenciasDeHechos.map((d, i) => (
                <div key={i}>
                  <strong>{d.tema}</strong>
                  <ul className="lista">
                    {d.porMedio.map((p) => (
                      <li key={p.medioId}>
                        <span className="medio">{nombre(p.medioId)}:</span> {p.version}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          </div>

          <h2>Diferencias de encuadre</h2>
          <p className="pie">Qué enfatiza cada nota, a quién cita y cómo ordena la información. No es un juicio sobre los medios.</p>
          <div className="grilla">
            {cmp.diferenciasDeEncuadre.map((d, i) => (
              <section key={i} className="tarjeta">
                <strong>{d.aspecto}</strong>
                <ul className="lista">
                  {d.porMedio.map((p) => (
                    <li key={p.medioId}>
                      <span className="medio">{nombre(p.medioId)}:</span> {p.descripcion}
                      {p.ejemplo && <div className="pie">Ejemplo: {p.ejemplo}</div>}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <h2>No verificado</h2>
          <div className="tarjeta">
            {cmp.noVerificado.length === 0 ? (
              <p className="pie">No hay datos marcados como no verificados.</p>
            ) : (
              <ul className="lista">
                {cmp.noVerificado.map((x, i) => (
                  <li key={i}>
                    <span className="etiqueta">no verificado</span> {x.dato}
                    {x.medioId && <> ({nombre(x.medioId)})</>}. <span className="pie">{x.motivo}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <p className="mensaje aviso">{res.avisos[0] ?? "No hay comparación disponible."}</p>
      )}

      <h2>Fuentes</h2>
      <ul className="lista">
        {res.fuentes.map((f) => (
          <li key={f.url}>
            <span className="medio">{f.medio}</span>: <a href={f.url} target="_blank" rel="noopener noreferrer">{f.titulo}</a>{" "}
            <span className="pie">
              ({fecha(f.fecha)}
              {f.esOrigen ? ", nota que pegaste" : ""}
              {f.muroPago ? ", con muro de pago" : ""})
            </span>
          </li>
        ))}
        {res.noDisponibles.map((x) => (
          <li key={x.medio}>
            <span className="medio">{x.medio}</span>: no disponible. <span className="pie">{x.motivo}</span>
          </li>
        ))}
        {res.sinCoincidencia.map((m) => (
          <li key={m}>
            <span className="medio">{m}</span>: <span className="pie">no encontramos una nota sobre el mismo hecho.</span>
          </li>
        ))}
        {res.descartadas.map((x) => (
          <li key={x.url}>
            <span className="medio">{x.medio}</span>: <a href={x.url} target="_blank" rel="noopener noreferrer">{x.titulo}</a>{" "}
            <span className="pie">(se descartó: {x.motivo})</span>
          </li>
        ))}
      </ul>

      <p className="pie" style={{ marginTop: 32 }}>
        Análisis generado el {fecha(res.generado)} con IA a partir del texto público de cada nota. Costo registrado: {usd(costo.usd)} en {costo.llamadas}{" "}
        llamadas.
        {res.avisos.length > 0 && <> Ajustes automáticos: {res.avisos.join("; ")}.</>}
      </p>
    </>
  );
}
