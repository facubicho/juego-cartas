"use client";

import { useActionState } from "react";
import type { EstadoForm } from "@/lib/acciones";

export function FormularioCuenta({
  accion,
  boton,
  autocompletarClave,
}: {
  accion: (e: EstadoForm, d: FormData) => Promise<EstadoForm>;
  boton: string;
  autocompletarClave: "current-password" | "new-password";
}) {
  const [estado, enviar, pendiente] = useActionState(accion, {});
  return (
    <form action={enviar} className="tarjeta" style={{ maxWidth: 420 }}>
      <div className="campo">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="campo">
        <label htmlFor="clave">Contraseña</label>
        <input id="clave" name="clave" type="password" required minLength={8} autoComplete={autocompletarClave} />
      </div>
      {estado.error && (
        <p className="mensaje error" role="alert">
          {estado.error}
        </p>
      )}
      <button type="submit" disabled={pendiente}>
        {pendiente ? "Un momento…" : boton}
      </button>
    </form>
  );
}
