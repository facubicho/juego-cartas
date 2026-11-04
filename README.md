# Adiviná y llegá a 10 — versión online

Juego web de cartas para jugar con amigos **desde el celular, entrando por un link** (modo sala online), o para mostrar en un live de TikTok (pantalla 16:9, para capturar con OBS o TikTok LIVE Studio).

- **Modo sala online:** el anfitrión crea una sala, manda el link por WhatsApp y cada amigo juega desde su celular. Ver [Modo sala online](#modo-sala-online).
- Se puede probar **sin estar en vivo** con el simulador de chat que trae la página.
- Con el **conector** (carpeta `conector/`), los comentarios de tu live de TikTok llegan al juego.
- Muestra un cartel de **Cafecito** (☕ Invitame un cafecito) y un código QR en la pantalla del ganador.

> **Aviso importante.** El conector usa [TikTok-Live-Connector](https://github.com/zerodytrash/TikTok-Live-Connector), una librería **no oficial**: TikTok no la hizo ni la mantiene. Puede dejar de funcionar en cualquier momento si TikTok cambia algo. Para conectarse, la librería usa un servicio externo de firma (Euler Stream). **Antes de transmitir, revisá los términos de servicio y las normas de la comunidad de TikTok** (y las reglas de TikTok LIVE sobre juegos y links externos) para asegurarte de que podés usarlo en tu cuenta.

## Modo sala online

Para jugar con amigos sin TikTok: cada uno usa su celular y la mesa completa se ve en la pantalla del anfitrión (que podés compartir en una videollamada o proyectar en la tele).

### Cómo se juega

1. El **anfitrión** abre el juego (desde el servidor, ver abajo) y toca **Crear sala online**. Aparece un **código de 4 letras** (por ejemplo `PJER`), el **link** de la sala, un **código QR** y el botón **Copiar link**.
2. Manda el link por WhatsApp (o los amigos escanean el QR). Cada uno lo abre en el celular, escribe su **nombre** (máximo 20 letras) y toca **Entrar**. Si el nombre ya lo usa otra persona en la sala, le pide otro.
3. El anfitrión toca **Abrir inscripción**. En el celular aparece el botón **Anotarme** (es lo mismo que escribir `!jugar`). Entran los primeros 10; los demás quedan en la lista de espera.
4. El anfitrión toca **Empezar ya** (o espera la cuenta regresiva).
5. En su turno, cada jugador escribe su predicción (por ejemplo `5 de diamantes`) o usa los botones rápidos **Rojo, Negro, ♥ ♦ ♠ ♣, Joker**, y toca **Enviar**. Tiene 15 segundos. Fuera de su turno ve de quién es el turno, el reloj, la última carta y los puntajes.
6. Al terminar, el anfitrión toca **Nueva inscripción** para jugar otra.

Las reglas son las mismas de siempre. Si un celular se desconecta (se bloqueó la pantalla, se cortó la wifi), al volver a abrir el link **recupera su lugar y sus puntos**: el navegador guarda un identificador del dispositivo.

### Probarlo en tu PC (y desde los celulares de tu casa)

1. Instalá Node.js e instalá las dependencias (pasos 1 a 3 de la guía de TikTok, más abajo: [instalar Node.js](#1-instalar-nodejs), [descargar el juego](#2-descargar-el-juego) e [instalar las dependencias](#3-instalar-las-dependencias)).
2. En la ventana negra, en la carpeta del juego, escribí:
   ```bash
   npm run servidor
   ```
3. Aparece algo así:
   ```
   En esta PC:          http://localhost:3000
   Desde la misma wifi: http://192.168.0.15:3000
   ```
   Dejá esa ventana abierta mientras juegan (para apagarlo: Ctrl+C).
4. En la PC abrí `http://localhost:3000` y tocá **Crear sala online**.
5. **Celulares en la misma wifi:** el link y el QR de la sala ya traen la dirección de tu PC en la wifi (por ejemplo `http://192.168.0.15:3000/s/PJER`), aunque en la PC lo hayas abierto como `localhost`. Mandá ese link o escaneá el QR con el celular.
6. Si Windows pregunta si permitís que Node.js use la red, elegí **Redes privadas** y **Permitir**. Si los celulares no cargan la página, revisá que estén en la misma wifi que la PC (no en datos móviles).

### Publicarlo en internet (Render)

Así tus amigos pueden entrar desde cualquier lado, no solo desde tu wifi. El proyecto ya trae la configuración (`render.yaml`): no hace falta tocar código ni poner claves.

1. Creá una cuenta gratis en <https://render.com> (podés entrar con tu cuenta de GitHub).
2. En el panel de Render tocá **New +** → **Blueprint**.
3. Conectá tu cuenta de GitHub y elegí este repositorio.
4. Render lee `render.yaml` y muestra el servicio **juego-cartas-online**. Tocá **Apply** (o **Deploy Blueprint**).
5. Esperá unos minutos a que diga **Live**. Arriba aparece la dirección pública, algo como `https://juego-cartas-online.onrender.com`.
6. Abrí esa dirección, tocá **Crear sala online** y mandá el link.

Cada vez que se sube un cambio a la rama principal, Render lo vuelve a publicar solo.

**Railway** (alternativa): en <https://railway.app> → **New Project** → **Deploy from GitHub repo** → elegí el repositorio. Railway detecta Node.js y usa `npm start`. Después, en **Settings → Networking**, tocá **Generate Domain** para tener la dirección pública.

> **Aviso sobre los planes gratuitos.** Algunos planes gratis (como el de Render) **apagan el servidor después de un rato sin uso** (unos 15 minutos). La primera visita después de eso puede tardar **hasta un minuto** en cargar mientras se vuelve a prender. Además, las salas se guardan solo en memoria: si el servidor se apaga o se reinicia, **las salas abiertas se pierden** y hay que crear una nueva.

### Configuración del servidor (opcional)

Se cambian con variables de entorno (en Render: **Environment**). Ninguna es secreta.

| Variable | Qué hace | Por defecto |
|---|---|---|
| `PORT` | Puerto (Render y Railway lo ponen solos) | 3000 |
| `MAX_SALAS` | Salas abiertas al mismo tiempo | 50 |
| `SALA_INACTIVA_MINUTOS` | Una sala sin actividad se borra sola | 120 |
| `MENSAJES_POR_SEGUNDO` | Mensajes por segundo por jugador (el resto se rechaza) | 3 |

### Seguridad y datos

- El **servidor es la autoridad**: las reglas corren solo ahí. Los celulares mandan su texto y reciben el estado.
- Se guarda **solo el nombre elegido**, en memoria, mientras dura la sala. No hay cuentas ni base de datos.
- Todo texto de los jugadores (nombres y mensajes) se limpia en el servidor (espacios, caracteres invisibles, máximo 20 caracteres para el nombre y 100 para el mensaje) y se muestra siempre como texto, nunca como código.
- Límites: 10 jugadores por sala (más quedan en la lista de espera), 40 pantallas conectadas por sala, máximo de salas configurable y de mensajes por segundo por jugador.
- Solo el navegador que creó la sala puede manejarla (guarda una clave en ese navegador).
- El servidor sirve únicamente las páginas, `css/` y `js/`: nunca el código del servidor, el conector, el `.env` ni las dependencias.

## Cómo abrir el juego (solo con el simulador)

No necesita instalar nada: abrí `index.html` con doble clic (Chrome, Edge o Firefox).
A la derecha aparece el **Simulador de chat** para probar todo sin live.

### Parámetros opcionales en la dirección

Se agregan al final de la dirección del juego, después de `index.html`: el primero con `?` y los demás con `&`.
Por ejemplo: `index.html?dev=0&chat=8080`.

| Parámetro | Qué hace | Por defecto |
|---|---|---|
| `dev=0` | Oculta el simulador (para la transmisión) | visible |
| `chat=8080` | Recibe el chat del live desde el conector (también acepta `chat=ws://localhost:8080`) | sin chat real |
| `cafecito=0` | Oculta el cartel de Cafecito y desactiva `!cafecito` | visible |
| `objetivo` | Puntos para ganar | 10 |
| `turno` | Segundos por turno | 15 |
| `inscripcion` | Segundos de inscripción | 60 |
| `max` | Lugares en la mesa | 10 |
| `espera=0` | Desactiva la lista de espera | activada |

Todos los valores (puntos, tiempos, link de Cafecito) están en `js/config.js`.

## Cómo probarlo con el simulador (sin conector)

El panel **Simulador de chat** (derecha; se abre/cierra con el botón 🛠 o la tecla **D**) permite:

1. **Simular 12 usuarios (!jugar):** abre la inscripción y anota a 12 usuarios. Los primeros 10 se sientan y los otros 2 ven el aviso de *Mesa llena* y quedan en la lista de espera. Con la mesa llena la partida arranca sola a los 3 segundos.
2. **Simular 3 usuarios** y **Empezar ya:** para una partida corta.
3. Escribir cualquier mensaje con cualquier **usuario** (nombre libre) y **Enviar** (o Enter). Al empezar cada turno el usuario del turno queda preseleccionado, así que alcanza con escribir la predicción.
4. **Jugada aleatoria del turno** / **“joker” del turno:** juega por el jugador al que le toca.
5. **Bots responden solos:** cada jugador contesta solo con una predicción al azar (a veces no contesta, para probar el reloj y la eliminación).
6. Clic en un nombre de la lista de usuarios para elegirlo.
7. El registro de chat muestra qué hizo el juego con cada mensaje (`inscripto`, `prediccion`, `invalida`, `ignorado`…).

## Jugar con el chat de tu live de TikTok (paso a paso, en Windows)

Lo vas a hacer una sola vez (pasos 1 a 4). Después, para cada live, solo los pasos 5 a 7.

### 1. Instalar Node.js

1. Entrá a <https://nodejs.org> y descargá la versión **LTS** (el botón verde de la izquierda).
2. Abrí el archivo descargado y apretá **Siguiente** en todo (las opciones que vienen marcadas están bien).
3. Para comprobarlo: apretá la tecla **Windows**, escribí `cmd` y Enter. En la ventana negra escribí `node -v` y Enter. Tiene que aparecer un número como `v22.x.x`. Ya podés cerrar esa ventana.

### 2. Descargar el juego

1. En la página del repositorio en GitHub, apretá el botón verde **Code** → **Download ZIP**.
2. Hacé clic derecho en el ZIP → **Extraer todo...** y elegí una carpeta fácil de encontrar (por ejemplo, Documentos).

### 3. Instalar las dependencias

1. Abrí la carpeta del juego (la que tiene `index.html`).
2. Hacé clic en la barra de dirección de la carpeta (arriba), borrá lo que dice, escribí `cmd` y Enter. Se abre una ventana negra ya ubicada en la carpeta del juego.
3. Escribí este comando y Enter (tarda un minuto, solo hay que hacerlo una vez):
   ```bash
   npm install
   ```

### 4. Configurar tu usuario de TikTok

1. En la misma ventana negra escribí este comando y Enter (copia el archivo de ejemplo):
   ```bash
   copy .env.example .env
   ```
2. Después este otro, que abre el archivo con el Bloc de notas:
   ```bash
   notepad .env
   ```
3. Cambiá `usuario_de_ejemplo` por tu nombre de usuario de TikTok **sin @** (el que aparece en `tiktok.com/@tu_usuario`). Por ejemplo: `TIKTOK_USUARIO=tu_usuario`.
4. Si querés que en pantalla aparezca el `@usuario` de cada jugador en lugar de su apodo, cambiá `MOSTRAR_NOMBRE=apodo` por `MOSTRAR_NOMBRE=usuario`.
5. Guardá (Ctrl+G o Ctrl+S) y cerrá el Bloc de notas.

El archivo `.env` queda solo en tu PC: **no se sube a GitHub**.

### 5. Antes de cada live: prender el conector

1. Empezá tu live en TikTok (el conector solo se conecta si ya estás en vivo; si no, espera y reintenta solo cada 30 segundos).
2. Abrí la ventana negra en la carpeta del juego (paso 3.2) y escribí:
   ```bash
   npm run conector
   ```
3. Cuando diga **¡Conectado con el live de @tu_usuario!**, los comentarios ya llegan al juego. **Dejá esa ventana abierta** durante todo el live (minimizada está bien). Para apagarlo: Ctrl+C o cerrar la ventana.

Si se corta, se reconecta solo y lo avisa en esa ventana.

### 6. Abrir el juego conectado al chat

1. Abrí `index.html` con doble clic.
2. Hacé clic en la barra de dirección del navegador, andá al final y agregá `?dev=0&chat=8080`. Queda algo como:
   `file:///C:/Users/vos/Documents/juego-cartas/index.html?dev=0&chat=8080`
3. Apretá Enter. Con `dev=0` no se ve el simulador (es lo que va a ver el público).

Para probar antes que todo funcione, abrilo con `?chat=8080` (sin `dev=0`): abajo a la derecha aparece un indicador **Chat: conectado / desconectado**.

### 7. Capturar el juego en la transmisión

**TikTok LIVE Studio**

1. Poné el navegador con el juego en pantalla completa (tecla **F11**) o maximizado.
2. En LIVE Studio, agregá una fuente → **Captura de ventana** (o **Captura de pantalla**) y elegí la ventana del navegador.
3. Ajustá el tamaño en la escena horizontal (16:9).

**OBS Studio**

- Opción A: **Fuente → Captura de ventana** y elegí el navegador.
- Opción B: **Fuente → Navegador**, **sin** marcar "Archivo local", y en **URL** pegá la dirección completa del paso 6 (con `?dev=0&chat=8080`). Ancho **1920**, alto **1080**.

Para conducir el juego (abrir la inscripción, nueva partida) usá los botones de la pantalla del juego.

### Probar el conector sin estar en vivo

```bash
npm run chat:prueba
```

Simula un chat con usuarios falsos (se anotan con `!jugar`, juegan su turno, charlan, piden `!cafecito` y a veces mandan ráfagas de mensajes). Abrí el juego con `?chat=8080` y apretá **Abrir inscripción**.
Con `npm run chat:prueba-cortes` además simula que no estás en vivo al principio y que la conexión se corta cada tanto.

### Si algo no anda

| Mensaje / problema | Qué hacer |
|---|---|
| `Falta configurar tu usuario de TikTok` | Revisá el paso 4 (el archivo se tiene que llamar `.env`, sin `.txt`). |
| `no está en vivo ahora (o el usuario está mal escrito)` | Empezá el live, o revisá el usuario en `.env`. El conector reintenta solo. |
| `El puerto 8080 ya está en uso` | Quedó otro conector abierto: cerralo. O poné `PUERTO=8081` en `.env` y abrí el juego con `chat=8081`. |
| El indicador dice **desconectado** | El conector no está corriendo (paso 5) o el número de `chat=` no coincide con el puerto. |
| `Chat muy movido: se descartaron N mensajes` | Normal con mucho chat: se pasan como máximo 15 mensajes por segundo (el jugador del turno nunca se descarta). Se cambia con `MAX_MENSAJES_POR_SEGUNDO` en `.env`. |
| Dejó de conectar de un día para el otro | Puede ser un cambio de TikTok que rompió la librería no oficial. Probá actualizarla con `npm install tiktok-live-connector@latest`. |

### Qué datos usa del chat

- Solo **comentarios de texto**. Regalos, likes y seguidores se ignoran.
- Cada jugador se identifica por su **nombre de usuario único** de TikTok (el apodo puede repetirse o cambiar). En pantalla se muestra el apodo o el usuario, según `MOSTRAR_NOMBRE`.
- Los textos se limpian: se recortan espacios, se quitan caracteres invisibles y se limitan a 100 caracteres.
- El conector no guarda nada y solo escucha en tu PC (`localhost`).

## Cafecito

- Cartel chico abajo a la izquierda: **☕ Invitame un cafecito · cafecito.app/facubicho**.
- En la pantalla del ganador: **¿Te gustó? Invitame un cafecito** con el link y un código QR. El QR se genera en la página con una librería incluida en `js/vendor/qrcode.js` (no se carga nada de internet).
- Comando de chat `!cafecito`: muestra el link en el panel de avisos, como máximo una vez por minuto en total.
- El link se cambia en `js/config.js` (`cafecito.url`). Para ocultar todo: `?cafecito=0`.

## Reglas implementadas

- **Mazo:** 52 cartas + 2 Jokers (54). Cada turno se saca de un mazo completo recién mezclado.
  - **Joker derecho** (siempre al derecho): es el que suma.
  - **Joker de cabeza** (siempre rotado 180°): es el que resta.
- **Inscripción:** `!jugar`. Máximo 10 por orden de llegada; del 11 en adelante, *Mesa llena* (lista de espera o espectador). Cuenta regresiva de 60 s o hasta llenar la mesa. Mínimo 2 jugadores (si no se llega, se extiende la inscripción). `!salir` para dejar la mesa o la lista de espera. `!cafecito` muestra el link de Cafecito.
- **Turnos:** en el orden en que se anotaron, siempre en el mismo sentido. 15 s por turno. Solo cuenta el jugador del turno y su primera predicción válida; las inválidas o ambiguas se ignoran y puede reintentar mientras haya tiempo.
- **Sin respuesta:** pierde el turno. Con 2 turnos seguidos sin responder queda eliminado (el contador se reinicia al contestar a tiempo). Si hay lista de espera entra el siguiente (al final del orden).
- **Puntos:** color 1, palo 2, número 3, acumulativos (pleno = 6). Solo cuenta lo anunciado.
  - Decir un palo implica su color (diamantes/corazones = rojo, picas/tréboles = negro): “diamantes” acertado suma 2 + 1 = 3 (color + palo) y “5 de diamantes” acertado es pleno (6).
- **Joker:** anunció “joker” y sale el derecho → +10 y gana. Anunció “joker” y sale el de cabeza → −10 y queda eliminado. No lo anunció y sale el derecho → +9. No lo anunció y sale el de cabeza → −9 (no queda eliminado). Anunció “joker” y sale una carta normal → 0.
  - El puntaje puede quedar por debajo de 0 y se muestra con el signo menos (se puede cambiar con `permitirPuntajeNegativo` en `js/config.js`).
- **Ganar:** el primero en llegar a 10 o más (no existe pasarse). Si queda un solo jugador, gana.

### Textos que entiende

Sin distinguir mayúsculas ni tildes: `5 de diamantes`, `cinco diamantes`, `5♦`, `rey de picas`, `K♠`, `rojo`, `picas`, `7`, `as`, `jota`/`j`, `reina`/`q`, `rey`/`k`, `joker`/`comodín`.
Se rechazan las predicciones ambiguas (`5 o 6`, `rojo negro`), contradictorias (`rojo picas`), con números fuera de 1–13, o “joker” mezclado con otra cosa.

## Estructura del código

```
index.html               Página (escenario 16:9 + panel del simulador)
css/estilos.css          Estilos: mesa verde, cartas, animación, Cafecito
js/config.js             Configuración (puntaje objetivo, tiempos, puntos, link de Cafecito)
js/mazo.js               Mazo de 54 cartas y extracción
js/interprete.js         Interpretación del texto del chat
js/puntuacion.js         Cálculo de puntos y reglas del Joker
js/juego.js              Motor del juego (fases, turnos, eliminaciones, ganador, !cafecito). Sin interfaz.
js/chat.js               Entrada única del chat: onChatMessage(usuario, texto, nombreVisible)
js/chat-ws.js            Cliente del conector (?chat=...): reenvía cada comentario a onChatMessage
js/ui.js                 Interfaz (solo dibuja el estado del motor)
js/simulador.js          Panel de desarrollo para simular el chat
js/app.js                Arranque y parámetros de la dirección
js/vendor/qrcode.js      Generador de QR (qrcode-generator, licencia MIT)
conector/index.js        Servidor del conector (npm run conector / npm run chat:prueba)
conector/config.js       Lectura de .env y parámetros
conector/fuente-tiktok.js  Conexión con el chat de TikTok LIVE (TikTok-Live-Connector)
conector/fuente-prueba.js  Chat de prueba con usuarios falsos
conector/limpieza.js     Limpieza de textos y datos del comentario
conector/limitador.js    Límite de mensajes por segundo
conector/reconexion.js   Reconexión con espera creciente
conector/puente.js       Limpia, limita y reenvía los comentarios al juego
conector/servidor-ws.js  WebSocket local (127.0.0.1) hacia la página
jugador.html             Pantalla del jugador del modo sala online (celular)
css/jugador.css          Estilos de la pantalla del jugador
js/jugador.js            Pantalla del jugador: entrar, anotarse, predecir
js/jugador-rapidos.js    Botones rápidos (Rojo, Negro, ♥ ♦ ♠ ♣, Joker)
js/sala-conexion.js      Conexión con el servidor de salas y "motor remoto" para la mesa del anfitrión
js/sala-anfitrion.js     Pantalla del anfitrión: crear sala, link, QR, conectados
servidor/index.js        Servidor del modo sala online (npm run servidor / npm start)
servidor/app.js          HTTP (páginas) + WebSocket (/ws) en el mismo puerto
servidor/salas.js        Salas: nombres, límites, expiración, una partida por sala
servidor/conexiones.js   Mensajes entre las pantallas y las salas
servidor/estaticos.js    Archivos que se sirven (solo páginas, css/ y js/)
servidor/motor.js        Carga en Node el mismo motor de reglas de la página
render.yaml              Configuración para publicar en Render
tests/                   Tests automáticos (node:test)
```

Todo mensaje entra al juego por una sola función:

```js
onChatMessage(usuario, texto, nombreVisible);
```

`usuario` identifica al jugador (en TikTok, el nombre de usuario único) y `nombreVisible` (opcional) es lo que se muestra.

## Tests

Requieren Node 20 o superior y haber corrido `npm install` una vez:

```bash
npm test
```

Cubren el modo sala online (crear sala, unirse, nombres repetidos, límite de 10 y espectadores, turnos y tiempo, desconexión y reconexión, limpieza de textos, límite de mensajes, expiración de salas, archivos servidos y una partida completa con varios clientes simulados), las reglas del juego (puntuación, Joker, victoria, turnos, eliminación, lista de espera, interpretación del texto, límite de 10 jugadores), el comando `!cafecito` y su límite de una vez por minuto, la identificación por usuario único, y el conector sin conectarse a TikTok: limpieza de textos, límite de mensajes por segundo, reconexión, configuración y reenvío de punta a punta (WebSocket → página → juego).
