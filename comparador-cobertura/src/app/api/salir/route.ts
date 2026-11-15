import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { obtenerDb } from "@/lib/db";
import { COOKIE_SESION, borrarSesion } from "@/lib/auth";

export async function POST(req: Request) {
  const jar = await cookies();
  await borrarSesion(obtenerDb(), jar.get(COOKIE_SESION)?.value);
  jar.delete(COOKIE_SESION);
  return NextResponse.redirect(new URL("/", req.url), 303);
}
