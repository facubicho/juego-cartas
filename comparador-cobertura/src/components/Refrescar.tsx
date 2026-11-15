"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Vuelve a pedir la página cada unos segundos mientras el análisis está en curso. */
export function Refrescar({ cadaMs = 3000 }: { cadaMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), cadaMs);
    return () => clearInterval(t);
  }, [router, cadaMs]);
  return null;
}
