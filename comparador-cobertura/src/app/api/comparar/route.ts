import { NextResponse, after } from "next/server";
import { dependencias, usuarioActual } from "@/lib/servidor";
import { procesarComparacion, solicitarComparacion } from "@/lib/comparar";

export async function POST(req: Request) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json({ mensaje: "Tenés que ingresar para comparar una noticia." }, { status: 401 });
  }
  let url: unknown;
  try {
    url = (await req.json()).url;
  } catch {
    url = undefined;
  }
  if (typeof url !== "string" || !url.trim()) {
    return NextResponse.json({ mensaje: "Pegá el link de una nota." }, { status: 400 });
  }

  const deps = dependencias();
  const r = await solicitarComparacion(deps, url, usuario.id);
  if (r.tipo === "rechazada") {
    const status = r.motivo === "tope" ? 503 : r.motivo === "cuota" ? 429 : 400;
    return NextResponse.json({ mensaje: r.mensaje, motivo: r.motivo }, { status });
  }
  if (r.tipo === "nueva") {
    // El análisis sigue en segundo plano; la página de resultado se actualiza sola.
    after(() => procesarComparacion(deps, r.comparacionId, usuario.id));
  }
  return NextResponse.json({ comparacionId: r.comparacionId, reutilizada: r.tipo === "existente" });
}
