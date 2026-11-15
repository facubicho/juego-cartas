import "server-only";
import { cookies } from "next/headers";
import { obtenerDb } from "@/lib/db";
import { LectorWeb } from "@/lib/extraccion/red";
import { crearClienteAnthropic, type ClienteAnthropic } from "@/lib/ia/cliente";
import { COOKIE_SESION, usuarioDeToken, type Usuario } from "@/lib/auth";
import type { Dependencias } from "@/lib/comparar";

let ia: ClienteAnthropic | undefined;
let lector: LectorWeb | undefined;
let lectorCreado = 0;

/** Dependencias reales del flujo (base, red e IA), creadas una sola vez por proceso. */
export function dependencias(): Dependencias {
  ia ??= crearClienteAnthropic();
  // Se renueva cada hora para volver a leer los robots.txt.
  if (!lector || Date.now() - lectorCreado > 3600_000) {
    lector = new LectorWeb();
    lectorCreado = Date.now();
  }
  return { db: obtenerDb(), lector, ia };
}

export async function usuarioActual(): Promise<Usuario | null> {
  const token = (await cookies()).get(COOKIE_SESION)?.value;
  return usuarioDeToken(obtenerDb(), token);
}
