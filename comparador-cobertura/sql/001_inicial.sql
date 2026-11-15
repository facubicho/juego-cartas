-- Esquema inicial del Comparador de cobertura.

CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  hash_clave    TEXT NOT NULL,
  plan          TEXT NOT NULL DEFAULT 'gratis' CHECK (plan IN ('gratis', 'pago')),
  creado        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sesiones (
  token_hash    TEXT PRIMARY KEY,
  usuario_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira        TIMESTAMPTZ NOT NULL
);

-- Una comparación es "una noticia": se comparte entre todos los usuarios.
CREATE TABLE IF NOT EXISTS comparaciones (
  id            SERIAL PRIMARY KEY,
  estado        TEXT NOT NULL CHECK (estado IN ('procesando', 'lista', 'error')),
  url_origen    TEXT NOT NULL,
  titulo        TEXT,
  resultado     JSONB,
  error         TEXT,
  creado_por    INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  creado        TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notas que forman parte de una comparación (o que se intentaron y no estaban disponibles).
CREATE TABLE IF NOT EXISTS notas (
  id              SERIAL PRIMARY KEY,
  comparacion_id  INTEGER NOT NULL REFERENCES comparaciones(id) ON DELETE CASCADE,
  medio_id        TEXT NOT NULL,
  url             TEXT,
  es_origen       BOOLEAN NOT NULL DEFAULT false,
  estado          TEXT NOT NULL CHECK (estado IN ('pendiente', 'ok', 'no_disponible', 'sin_coincidencia', 'descartada')),
  motivo          TEXT,
  titulo          TEXT,
  bajada          TEXT,
  fecha           TIMESTAMPTZ,
  muro_pago       BOOLEAN NOT NULL DEFAULT false,
  extraccion      JSONB
);
CREATE INDEX IF NOT EXISTS notas_url_idx ON notas (url);
CREATE INDEX IF NOT EXISTS notas_comparacion_idx ON notas (comparacion_id);

-- Registro de cada llamada a la IA, para control de costos.
CREATE TABLE IF NOT EXISTS llamadas_ia (
  id               SERIAL PRIMARY KEY,
  creado           TIMESTAMPTZ NOT NULL DEFAULT now(),
  etapa            TEXT NOT NULL,
  modelo           TEXT NOT NULL,
  modo             TEXT NOT NULL DEFAULT 'tiempo_real' CHECK (modo IN ('tiempo_real', 'lote')),
  tokens_entrada   INTEGER NOT NULL,
  tokens_salida    INTEGER NOT NULL,
  tokens_cache_lectura   INTEGER NOT NULL DEFAULT 0,
  tokens_cache_escritura INTEGER NOT NULL DEFAULT 0,
  costo_usd        NUMERIC(12, 6) NOT NULL,
  comparacion_id   INTEGER REFERENCES comparaciones(id) ON DELETE SET NULL,
  usuario_id       INTEGER REFERENCES usuarios(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS llamadas_ia_creado_idx ON llamadas_ia (creado);

-- Comparaciones nuevas consumidas por usuario y por mes (formato AAAA-MM).
CREATE TABLE IF NOT EXISTS uso_mensual (
  usuario_id     INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  mes            TEXT NOT NULL,
  comparaciones  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (usuario_id, mes)
);
