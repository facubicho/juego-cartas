import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { usuarioActual } from "@/lib/servidor";
import { estadoCuota } from "@/lib/costos";
import { obtenerDb } from "@/lib/db";
import { esAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Comparador de cobertura",
  description: "Mirá cómo cubrieron la misma noticia distintos diarios argentinos.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function Layout({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioActual();
  const cuota = usuario ? await estadoCuota(obtenerDb(), usuario.id) : null;
  return (
    <html lang="es-AR">
      <body>
        <header className="barra">
          <div className="contenedor">
            <Link href="/" className="marca">
              Comparador de cobertura
            </Link>
            <nav>
              {usuario && cuota ? (
                <>
                  <span className="cuota" title="Comparaciones nuevas este mes. Las noticias ya analizadas no cuentan.">
                    {cuota.restantes} de {cuota.limite} disponibles · plan {cuota.plan === "pago" ? "pago" : "gratuito"}
                  </span>
                  <Link href="/planes">Planes</Link>
                  {esAdmin(usuario) && <Link href="/admin">Admin</Link>}
                  <form action="/api/salir" method="post">
                    <button className="secundario" type="submit">
                      Salir
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/ingresar">Ingresar</Link>
                  <Link href="/registro">Crear cuenta</Link>
                </>
              )}
            </nav>
          </div>
        </header>
        <main className="contenedor">{children}</main>
      </body>
    </html>
  );
}
