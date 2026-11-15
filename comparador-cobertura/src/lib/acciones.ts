"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { obtenerDb } from "@/lib/db";
import { COOKIE_SESION, DURACION_SESION_DIAS, crearSesion, registrarUsuario, verificarClave } from "@/lib/auth";

export interface EstadoForm {
  error?: string;
}

async function abrirSesion(usuarioId: number) {
  const token = await crearSesion(obtenerDb(), usuarioId);
  (await cookies()).set(COOKIE_SESION, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACION_SESION_DIAS * 24 * 3600,
  });
}

export async function ingresar(_: EstadoForm, datos: FormData): Promise<EstadoForm> {
  const u = await verificarClave(obtenerDb(), String(datos.get("email") ?? ""), String(datos.get("clave") ?? ""));
  if (!u) return { error: "El email o la contraseña no coinciden." };
  await abrirSesion(u.id);
  redirect("/");
}

export async function registrarse(_: EstadoForm, datos: FormData): Promise<EstadoForm> {
  const r = await registrarUsuario(obtenerDb(), String(datos.get("email") ?? ""), String(datos.get("clave") ?? ""));
  if (typeof r === "string") return { error: r };
  await abrirSesion(r.id);
  redirect("/");
}
