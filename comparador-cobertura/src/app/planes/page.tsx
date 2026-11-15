import { LIMITES } from "@config/limites";
import { usuarioActual } from "@/lib/servidor";

export const dynamic = "force-dynamic";

/**
 * Stub de cobro: muestra los planes pero no integra ningún medio de pago.
 * Para pasar a alguien al plan pago, hoy se cambia a mano en la base
 * (UPDATE usuarios SET plan = 'pago' WHERE email = ...).
 */
export default async function Planes() {
  const usuario = await usuarioActual();
  return (
    <>
      <h1>Planes</h1>
      <div className="grilla">
        <section className="tarjeta">
          <h2 style={{ marginTop: 0 }}>Gratuito</h2>
          <p>{LIMITES.cuotaMensual.gratis} comparaciones nuevas por mes.</p>
          {usuario?.plan === "gratis" && <p className="pie">Es tu plan actual.</p>}
        </section>
        <section className="tarjeta">
          <h2 style={{ marginTop: 0 }}>Pago</h2>
          <p>{LIMITES.cuotaMensual.pago} comparaciones nuevas por mes.</p>
          {usuario?.plan === "pago" ? (
            <p className="pie">Es tu plan actual.</p>
          ) : (
            <button type="button" disabled title="Todavía no está disponible">
              Pasar al plan pago (próximamente)
            </button>
          )}
        </section>
      </div>
      <p className="pie" style={{ marginTop: 16 }}>
        En los dos planes, ver una noticia que ya analizó otra persona no cuenta contra tu cuota.
      </p>
    </>
  );
}
