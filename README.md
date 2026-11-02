# Adiviná y llegá a 10

Juego web de cartas pensado para mostrarse en un live de TikTok (pantalla 16:9, para capturar con OBS o TikTok LIVE Studio).
Esta primera versión trae el juego completo y un **simulador de chat** para probarlo sin estar en vivo.

## Cómo abrir el juego

No necesita instalar nada: es HTML + CSS + JavaScript puro.

- **Opción rápida:** abrí `index.html` con doble clic (Chrome, Edge o Firefox).
- **Opción servidor local** (recomendada para OBS):
  ```bash
  npx serve .
  ```
  o
  ```bash
  python3 -m http.server 8000
  ```
  y abrí `http://localhost:8000`.

### Para el live (OBS / TikTok LIVE Studio)

Agregá una fuente **Navegador** con la URL del juego y `?dev=0` al final para ocultar el simulador, en 1920×1080:

```
http://localhost:8000/index.html?dev=0
```

El escenario siempre mide 1920×1080 y se escala para entrar en la ventana.

### Parámetros opcionales en la URL

| Parámetro | Qué hace | Por defecto |
|---|---|---|
| `objetivo` | Puntos para ganar | 10 |
| `turno` | Segundos por turno | 10 |
| `inscripcion` | Segundos de inscripción | 60 |
| `max` | Lugares en la mesa | 10 |
| `espera=0` | Desactiva la lista de espera | activada |
| `dev=0` | Oculta el simulador | visible |

Ejemplo: `index.html?objetivo=15&turno=12&inscripcion=30`.
Todos los valores (incluida la tabla de puntos) están en `js/config.js`.

## Cómo probarlo con el simulador

El panel **Simulador de chat** (derecha; se abre/cierra con el botón 🛠 o la tecla **D**) permite:

1. **Simular 12 usuarios (!jugar):** abre la inscripción y anota a 12 usuarios. Los primeros 10 se sientan y los otros 2 ven el aviso de *Mesa llena* y quedan en la lista de espera. Con la mesa llena la partida arranca sola a los 3 segundos.
2. **Simular 3 usuarios** y **Empezar ya:** para una partida corta.
3. Escribir cualquier mensaje con cualquier **usuario** (nombre libre) y **Enviar** (o Enter). Al empezar cada turno el usuario del turno queda preseleccionado, así que alcanza con escribir la predicción.
4. **Jugada aleatoria del turno** / **“joker” del turno:** juega por el jugador al que le toca.
5. **Bots responden solos:** cada jugador contesta solo con una predicción al azar (a veces no contesta, para probar el reloj y la eliminación).
6. Clic en un nombre de la lista de usuarios para elegirlo.
7. El registro de chat muestra qué hizo el juego con cada mensaje (`inscripto`, `prediccion`, `invalida`, `ignorado`…).

## Reglas implementadas

- **Mazo:** 52 cartas + 2 Jokers (54). Cada turno se saca de un mazo completo recién mezclado.
  - **Joker derecho** (siempre al derecho): es el que suma.
  - **Joker de cabeza** (siempre rotado 180°): es el que resta.
- **Inscripción:** `!jugar`. Máximo 10 por orden de llegada; del 11 en adelante, *Mesa llena* (lista de espera o espectador). Cuenta regresiva de 60 s o hasta llenar la mesa. Mínimo 2 jugadores (si no se llega, se extiende la inscripción). `!salir` para dejar la mesa o la lista de espera.
- **Turnos:** en el orden en que se anotaron, siempre en el mismo sentido. 10 s por turno. Solo cuenta el jugador del turno y su primera predicción válida; las inválidas o ambiguas se ignoran y puede reintentar mientras haya tiempo.
- **Sin respuesta:** pierde el turno. Con 2 turnos seguidos sin responder queda eliminado (el contador se reinicia al contestar a tiempo). Si hay lista de espera entra el siguiente (al final del orden).
- **Puntos:** color 1, palo 2, número 3, acumulativos (pleno = 6). Solo cuenta lo anunciado.
  - Decir un palo implica su color (diamantes/corazones = rojo, picas/tréboles = negro): “diamantes” acertado suma 2 + 1 = 3 (color + palo) y “5 de diamantes” acertado es pleno (6).
- **Joker:** anunció “joker” y sale el derecho → +10 y gana. Anunció “joker” y sale el de cabeza → −10 y queda eliminado. No lo anunció y sale cualquiera → +9. Anunció “joker” y sale una carta normal → 0.
- **Ganar:** el primero en llegar a 10 o más (no existe pasarse). Si queda un solo jugador, gana.

### Textos que entiende

Sin distinguir mayúsculas ni tildes: `5 de diamantes`, `cinco diamantes`, `5♦`, `rey de picas`, `K♠`, `rojo`, `picas`, `7`, `as`, `jota`/`j`, `reina`/`q`, `rey`/`k`, `joker`/`comodín`.
Se rechazan las predicciones ambiguas (`5 o 6`, `rojo negro`), contradictorias (`rojo picas`), con números fuera de 1–13, o “joker” mezclado con otra cosa.

## Estructura del código

```
index.html          Página (escenario 16:9 + panel del simulador)
css/estilos.css     Estilos: mesa verde, cartas, animación de vuelta
js/config.js        Configuración (puntaje objetivo, tiempos, puntos…)
js/mazo.js          Mazo de 54 cartas y extracción
js/interprete.js    Interpretación del texto del chat
js/puntuacion.js    Cálculo de puntos y reglas del Joker
js/juego.js         Motor del juego (fases, turnos, eliminaciones, ganador). Sin interfaz.
js/chat.js          Entrada única del chat: onChatMessage(usuario, texto)
js/ui.js            Interfaz (solo dibuja el estado del motor)
js/simulador.js     Panel de desarrollo para simular el chat
js/app.js           Arranque
tests/              Tests automáticos (node:test)
```

### Conectar el chat real (próxima etapa)

Todo mensaje entra por una única función global:

```js
onChatMessage(usuario, texto);
```

El conector de TikTok LIVE solo tiene que llamarla por cada comentario; la lógica no se toca.

## Tests

Requiere Node 18 o superior (no hay dependencias que instalar):

```bash
npm test
```

Cubren: puntuación de todos los casos, reglas del Joker, victoria con 10 o más (incluido 8 + 6), orden de turnos, eliminación tras 2 turnos sin responder, lista de espera, interpretación del texto y límite de 10 jugadores.
