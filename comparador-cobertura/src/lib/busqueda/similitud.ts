const VACIAS = new Set(
  `a al algo ante antes como con contra cual cuando de del desde donde durante e el ella ellas ellos en entre era es esa ese eso esta este esto estos fue fueron ha han hasta hay la las le les lo los mas me mi mientras muy mas ni no nos o otra otro para pero por porque que quien se ser si sin sobre son su sus tambien tras tu un una uno unos y ya asi dijo segun tras video fotos minuto vivo hoy ayer`.split(
    /\s+/,
  ),
);

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ");
}

/** Palabras significativas, con una raíz muy simple (se recorta el plural). */
export function palabrasClave(texto: string): Set<string> {
  const out = new Set<string>();
  for (const p of normalizar(texto).split(/\s+/)) {
    if (p.length < 3 || VACIAS.has(p)) continue;
    out.add(p.length > 4 ? p.replace(/(es|s)$/, "") : p);
  }
  return out;
}

/** Coeficiente de Dice entre dos conjuntos (0 a 1). */
export function dice(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let comunes = 0;
  for (const x of a) if (b.has(x)) comunes++;
  return (2 * comunes) / (a.size + b.size);
}

export interface Texto {
  titulo: string;
  bajada?: string;
}

/** Puntaje de parecido entre dos notas: pesa más el titular que la bajada. */
export function puntajeSimilitud(a: Texto, b: Texto): number {
  const titulos = dice(palabrasClave(a.titulo), palabrasClave(b.titulo));
  const todo = dice(
    palabrasClave(`${a.titulo} ${a.bajada ?? ""}`),
    palabrasClave(`${b.titulo} ${b.bajada ?? ""}`),
  );
  return 0.6 * titulos + 0.4 * todo;
}
