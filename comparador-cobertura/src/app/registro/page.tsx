import Link from "next/link";
import { FormularioCuenta } from "@/components/FormularioCuenta";
import { registrarse } from "@/lib/acciones";
import { LIMITES } from "@config/limites";

export default function Registro() {
  return (
    <>
      <h1>Crear cuenta</h1>
      <p className="bajada">
        Con el plan gratuito tenés {LIMITES.cuotaMensual.gratis} comparaciones nuevas por mes. Ver noticias que ya analizó otra persona no cuenta.
        ¿Ya tenés cuenta? <Link href="/ingresar">Ingresá</Link>.
      </p>
      <FormularioCuenta accion={registrarse} boton="Crear cuenta" autocompletarClave="new-password" />
    </>
  );
}
