import { notFound } from "next/navigation";
import Link from "next/link";
import { usuarioActual } from "@/lib/servidor";
import { esAdmin } from "@/lib/auth";
import { obtenerDb, mesActual } from "@/lib/db";
import { topeGastoMensual } from "@/lib/costos";
import { costosPorComparacion, costosPorUsuario, resumenDelMes } from "@/lib/costos/reportes";
import { LIMITES } from "@config/limites";
import { usd, fecha } from "@/lib/formato";

export const dynamic = "force-dynamic";

export default async function Admin() {
  const usuario = await usuarioActual();
  if (!esAdmin(usuario)) notFound();
  const db = obtenerDb();
  const mes = mesActual();
  const [resumen, porComparacion, porUsuario] = await Promise.all([
    resumenDelMes(db, mes),
    costosPorComparacion(db, mes),
    costosPorUsuario(db, mes),
  ]);
  const tope = topeGastoMensual();
  const objetivo = LIMITES.objetivoCostoPorComparacionUsd;
  const excedido = resumen.comparaciones > 0 && resumen.promedioPorComparacionUsd > objetivo * 1.5;

  return (
    <>
      <h1>Costos de IA · {mes}</h1>
      {resumen.gastoUsd >= tope && (
        <p className="mensaje error">Se alcanzó el tope de gasto mensual: la app no está generando análisis nuevos.</p>
      )}
      {excedido && (
        <p className="mensaje aviso">
          El costo promedio por comparación ({usd(resumen.promedioPorComparacionUsd)}) supera bastante el objetivo de {usd(objetivo, 2)}.
        </p>
      )}
      <div className="metricas">
        <div className="tarjeta metrica">
          <div className="valor">{usd(resumen.gastoUsd, 2)}</div>
          <div className="rotulo">Gasto del mes (tope {usd(tope, 2)})</div>
        </div>
        <div className="tarjeta metrica">
          <div className="valor">{usd(resumen.promedioPorComparacionUsd)}</div>
          <div className="rotulo">Promedio por comparación (objetivo {usd(objetivo, 2)})</div>
        </div>
        <div className="tarjeta metrica">
          <div className="valor">{resumen.comparaciones}</div>
          <div className="rotulo">Comparaciones con gasto</div>
        </div>
        <div className="tarjeta metrica">
          <div className="valor">{resumen.llamadas}</div>
          <div className="rotulo">Llamadas a la IA</div>
        </div>
      </div>

      <h2>Costo por comparación</h2>
      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th>Noticia</th>
              <th>Pedida por</th>
              <th className="num">Llamadas</th>
              <th className="num">Tokens entrada / salida</th>
              <th className="num">Extracción</th>
              <th className="num">Agrupación</th>
              <th className="num">Comparación</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {porComparacion.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/comparacion/${c.id}`}>{c.titulo ?? `#${c.id}`}</Link>
                  <div className="pie">
                    {fecha(c.creado)} · {c.estado}
                  </div>
                </td>
                <td>{c.email ?? "—"}</td>
                <td className="num">{c.llamadas}</td>
                <td className="num">
                  {c.tokensEntrada.toLocaleString("es-AR")} / {c.tokensSalida.toLocaleString("es-AR")}
                </td>
                <td className="num">{usd(c.costoPorEtapa.extraccion ?? 0)}</td>
                <td className="num">{usd(c.costoPorEtapa.agrupacion ?? 0)}</td>
                <td className="num">{usd(c.costoPorEtapa.comparacion ?? 0)}</td>
                <td className="num">
                  <strong>{usd(c.costoUsd)}</strong>
                </td>
              </tr>
            ))}
            {porComparacion.length === 0 && (
              <tr>
                <td colSpan={8} className="pie">
                  Todavía no hay gasto este mes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2>Costo por usuario</h2>
      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Plan</th>
              <th className="num">Comparaciones nuevas</th>
              <th className="num">Gasto generado</th>
            </tr>
          </thead>
          <tbody>
            {porUsuario.map((u) => (
              <tr key={u.usuarioId}>
                <td>{u.email}</td>
                <td>{u.plan}</td>
                <td className="num">
                  {u.comparacionesNuevas} / {LIMITES.cuotaMensual[u.plan] ?? LIMITES.cuotaMensual.gratis}
                </td>
                <td className="num">{usd(u.costoUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="pie" style={{ marginTop: 16 }}>
        Costos estimados con la tabla de config/precios.ts. Las noticias reutilizadas desde la caché no generan llamadas.
      </p>
    </>
  );
}
