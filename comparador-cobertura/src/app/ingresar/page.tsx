import Link from "next/link";
import { FormularioCuenta } from "@/components/FormularioCuenta";
import { ingresar } from "@/lib/acciones";

export default function Ingresar() {
  return (
    <>
      <h1>Ingresar</h1>
      <p className="bajada">
        ¿No tenés cuenta? <Link href="/registro">Creá una gratis</Link>.
      </p>
      <FormularioCuenta accion={ingresar} boton="Ingresar" autocompletarClave="current-password" />
    </>
  );
}
