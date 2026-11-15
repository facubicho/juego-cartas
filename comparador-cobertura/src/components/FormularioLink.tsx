"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function FormularioLink({ conSesion }: { conSesion: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const r = await fetch("/api/comparar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const datos = await r.json();
      if (!r.ok) {
        setError(datos.mensaje ?? "Algo salió mal. Probá de nuevo en un rato.");
        return;
      }
      router.push(`/comparacion/${datos.comparacionId}${datos.reutilizada ? "?reutilizada=1" : ""}`);
      router.refresh();
    } catch {
      setError("No pudimos conectarnos. Revisá tu conexión.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <form className="pegar" onSubmit={enviar}>
        <input
          type="url"
          required
          placeholder="Pegá acá el link de la nota"
          aria-label="Link de la nota"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={!conSesion}
        />
        <button type="submit" disabled={enviando || !conSesion}>
          {enviando ? "Buscando…" : "Comparar"}
        </button>
      </form>
      {!conSesion && (
        <p className="mensaje aviso">
          Para comparar una noticia <a href="/ingresar">ingresá</a> o <a href="/registro">creá una cuenta</a>. Es gratis.
        </p>
      )}
      {error && (
        <p className="mensaje error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
