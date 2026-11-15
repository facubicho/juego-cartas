# Comparador de cobertura

Pegás el link de una nota de un diario argentino y la app muestra cómo cubrieron el mismo hecho otros medios: en qué coinciden, qué datos cambian, qué pone en primer plano cada uno y qué no se pudo verificar. Solo usa lo que cada diario muestra sin suscripción.

Medios iniciales: Infobae, Clarín, Página/12 y Ámbito (configurables en `config/medios.ts`).

## Cómo correrlo

Requisitos: Node 22 o superior y PostgreSQL 14 o superior.

```bash
npm install
```

```bash
cp .env.example .env   # y completá las variables
```

```bash
createdb comparador && createdb comparador_test
```

```bash
npm run db:migrate
```

```bash
npm run dev            # http://localhost:3000
```

Para producción: `npm run build` y después `npm start`. El análisis corre en segundo plano dentro del proceso de Node (con `after()` de Next), así que hace falta un servidor Node que quede encendido, no funciones serverless con tiempo corto.

### Ver la interfaz sin API key ni red

```bash
npm run demo
```

Carga una comparación de ejemplo con notas ficticias y una IA simulada (los costos que registra también son simulados). Después ingresás con `demo@ejemplo.org` / `demo-demo-demo`. Si ponés ese email en `ADMIN_EMAILS`, también ves `/admin`.

### Tests

```bash
npm test
```

Usan `TEST_DATABASE_URL` (por defecto `postgres://postgres:postgres@localhost:5432/comparador_test`). Esa base **se borra y se recrea** en cada corrida. La API de Anthropic y los sitios de los diarios están simulados (`tests/fixtures/`), así que los tests no usan red ni gastan dinero.

Cubren: extracción y detección de muro de pago, robots.txt y sitios bloqueados, búsqueda de la misma noticia, cálculo de costo, cuotas (incluso con pedidos simultáneos), tope de gasto, caché por noticia y reglas de citas.

## Variables de entorno

| Variable | Para qué sirve |
|---|---|
| `DATABASE_URL` | Base PostgreSQL de la app |
| `TEST_DATABASE_URL` | Base para los tests (se borra en cada corrida) |
| `ANTHROPIC_API_KEY` | Clave de la API de Anthropic. Nunca va en el código |
| `TOPE_GASTO_MENSUAL_USD` | Tope de gasto global por mes (20 si no se define) |
| `USER_AGENT` | Cómo se identifica la app ante los diarios. Usá una URL de contacto del proyecto, no datos personales |
| `MEDIOS_ACTIVOS` | Ids de medios separados por coma. Vacío = todos |
| `ADMIN_EMAILS` | Emails con acceso a `/admin` |

## Cómo funciona

1. **Pedido** (`solicitarComparacion`): normaliza la URL (saca `utm_`, `#…` y la versión móvil) y, con un lock por URL, busca si esa nota ya forma parte de alguna comparación. Si ya existe, la devuelve sin llamar a la IA y sin tocar la cuota. Si no existe, controla el tope global y reserva una unidad de la cuota del usuario.
2. **Lectura** (`LectorWeb` + `parsearNota`): consulta robots.txt, respeta el crawl-delay y nunca manda cookies ni credenciales. Toma titular, bajada y fecha del JSON-LD o de los metadatos, y el texto de los párrafos visibles.
3. **Búsqueda**: lee los RSS y sitemaps de los otros medios y elige la nota más parecida por titular y bajada dentro de ±48 h. Si un medio bloquea el acceso, figura como "no disponible" y se sigue con los demás.
4. **Etapa 1, extracción con `claude-haiku-5-5`**: cifras, fuentes, encuadre, clasificación de cada dato (hecho, atribución u opinión) y lo no verificado.
5. **Etapa 2, agrupación con `claude-haiku-5-5`**: confirma que cada nota trata el mismo hecho y descarta las que no.
6. **Etapa 3, comparación con `claude-sonnet-5-5`**: recibe las extracciones (no las notas completas) y arma la tabla por medio, las coincidencias, las diferencias de hechos, las diferencias de encuadre y lo no verificado.
7. **Saneamiento** (`sanearComparacion`): antes de guardar, la app aplica las reglas de derechos de autor sin confiar en el modelo (ver más abajo). Los links a las notas los arma la app, no la IA.
8. Se guarda el resultado y queda disponible para cualquier usuario que pegue cualquiera de las notas de la comparación.

## Decisiones tomadas

- **`pg` + SQL plano en vez de Prisma.** Prisma descarga motores binarios en la instalación, lo que en entornos con red restringida falla. El esquema está en `sql/001_inicial.sql`.
- **Login propio** (bcrypt + token de sesión aleatorio guardado como hash). Para email y contraseña no hacía falta una librería entera. El cobro es un stub: `/planes` muestra los planes y el botón está deshabilitado. Para pasar a alguien al plan pago: `UPDATE usuarios SET plan = 'pago' WHERE email = '…'`.
- **Solo contenido público.** No se usa nunca `articleBody` del JSON-LD, porque en notas con muro puede traer el texto completo. Se toma solo el texto visible y se sacan las partes que el diario marca como pagas (`hasPart.isAccessibleForFree=false` + `cssSelector`) y los avisos de suscripción. El muro se detecta por JSON-LD, por `article:content_tier`, por selectores de cada medio y por las frases típicas del aviso.
- **No se guarda el texto de las notas** en la base: solo titular, bajada, link y la extracción parafraseada.
- **Reglas de salida aplicadas por código.** Se permite una sola cita por nota, de menos de 15 palabras, y tiene que aparecer de verdad en el texto público: si no aparece, se descarta por inventada o por venir de la parte paga. Cualquier campo que copie 15 palabras seguidas de una nota se reemplaza por un aviso.
- **Caché por noticia, no por URL suelta.** Si la comparación salió de una nota de Infobae, pegar el link de Clarín de la misma comparación también la reutiliza. Las comparaciones con error no se reutilizan, y las que quedaron "procesando" más de 10 minutos se consideran colgadas.
- **Cuota.** Si la nota original no se puede leer y no se llegó a usar la IA, la unidad de cuota se devuelve. Si la IA ya se usó, cuenta igual, porque hubo gasto.
- **Tope global.** Se controla antes de empezar cada análisis nuevo. Con muchos pedidos simultáneos justo en el límite, el gasto puede pasarse por algunos centavos (los análisis que ya estaban en curso).
- **Respaldo ante negativas.** Sonnet usa `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`): si declina por sus filtros de seguridad, la API reintenta con otro modelo. Cada intento se registra con su modelo y su costo.

## Control de costos

- Cada llamada a la IA queda registrada en `llamadas_ia` con etapa, modelo, tokens de entrada y salida, costo estimado en USD, comparación y usuario. Las respuestas fallidas también se registran, porque se cobran igual.
- Precios en `config/precios.ts` (USD por millón de tokens): Haiku 5.5 0,10 de entrada y 0,50 de salida, Sonnet 5.5 2 y 10, modo lote a la mitad. Un modelo que no esté en la tabla se cobra al precio más caro, para no subestimar.
- Límites en `config/limites.ts`: unos 1.500 tokens de texto público por nota, cuota de 5 comparaciones nuevas por mes en el plan gratuito y 40 en el pago, y topes de salida por etapa.
- Para bajar el costo:
  - Haiku corre sin razonamiento extendido y con esfuerzo bajo.
  - Sonnet corre con `thinking: between_tools` (no razona antes de responder, y ese razonamiento se cobraría como salida).
  - La etapa 3 recibe las extracciones, no las notas completas.
- `/admin` muestra el gasto del mes contra el tope, el costo promedio por comparación contra el objetivo de 0,02 USD (avisa si lo supera en más del 50%), el costo por comparación desglosado por etapa y el costo por usuario.

**Estimación.** Con 4 notas: unos 0,0015 USD en extracciones, 0,0002 USD en la agrupación y alrededor de 0,02 USD en la comparación con Sonnet, que es casi todo el costo. Total: **unos 0,022 USD**, apenas por encima del objetivo. Hay que confirmarlo con uso real en `/admin`.

## Pendiente o a verificar con red real

- Las URL de feeds, sitemaps y selectores de `config/medios.ts` salen de lo que publica cada diario, pero no se pudieron probar contra los sitios reales desde el entorno donde se desarrolló, porque tenía la red bloqueada. Conviene probar un link real de cada medio y ajustar lo que haga falta.
- Hoy se busca solo en lo que los feeds muestran en ese momento (las notas recientes). Para notas de días anteriores haría falta un índice propio que guarde los titulares de los feeds periódicamente.
