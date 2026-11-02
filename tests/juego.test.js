const test = require('node:test');
const assert = require('node:assert/strict');
const { AL10, crearJuego, partidaCon, carta, JOKER_DERECHO, JOKER_CABEZA } = require('./ayuda');

const NOMBRES = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9', 'u10', 'u11', 'u12'];

function turnoDe(juego) {
  return juego.jugadorActual() && juego.jugadorActual().nombre;
}

/** Hace jugar al jugador del turno y deja pasar la pausa de revelación. */
function jugar(ctx, texto) {
  const nombre = turnoDe(ctx.juego);
  const r = ctx.juego.recibirMensaje(nombre, texto);
  ctx.reloj.avanzar(ctx.juego.config.pausaRevelacionMs);
  return r;
}

function dejarPasarTurno(ctx) {
  ctx.reloj.avanzar(ctx.juego.config.segundosTurno * 1000);
  ctx.reloj.avanzar(ctx.juego.config.pausaTiempoAgotadoMs);
}

/* ---------- Inscripción ---------- */

test('límite de 10 jugadores: del 11 en adelante, mesa llena (lista de espera)', () => {
  const ctx = crearJuego();
  ctx.juego.abrirInscripcion();
  const res = NOMBRES.map((n) => ctx.juego.recibirMensaje(n, '!jugar'));
  assert.equal(ctx.juego.jugadores.length, 10);
  assert.deepEqual(res.slice(0, 10).map((r) => r.accion), Array(10).fill('inscripto'));
  assert.equal(res[10].accion, 'enEspera');
  assert.equal(res[11].accion, 'enEspera');
  assert.deepEqual(ctx.juego.espera, ['u11', 'u12']);
  const llenas = ctx.eventos.filter((e) => e.tipo === 'mesaLlena');
  assert.deepEqual(llenas.map((e) => e.datos.nombre), ['u11', 'u12']);
});

test('límite de 10 jugadores sin lista de espera: quedan de espectadores', () => {
  const ctx = crearJuego({ config: { listaDeEspera: false } });
  ctx.juego.abrirInscripcion();
  const res = NOMBRES.map((n) => ctx.juego.recibirMensaje(n, '!jugar'));
  assert.equal(ctx.juego.jugadores.length, 10);
  assert.equal(res[10].accion, 'espectador');
  assert.equal(ctx.juego.espera.length, 0);
});

test('con la mesa llena la partida arranca sola', () => {
  const ctx = crearJuego();
  ctx.juego.abrirInscripcion();
  NOMBRES.slice(0, 10).forEach((n) => ctx.juego.recibirMensaje(n, '!jugar'));
  assert.equal(ctx.juego.fase, 'inscripcion');
  ctx.reloj.avanzar(ctx.juego.config.pausaMesaLlenaMs);
  assert.equal(ctx.juego.fase, 'jugando');
});

test('no se puede anotar dos veces (ni cambiando mayúsculas)', () => {
  const ctx = crearJuego();
  ctx.juego.abrirInscripcion();
  ctx.juego.recibirMensaje('Ana', '!jugar');
  assert.equal(ctx.juego.recibirMensaje('ana', '!jugar').accion, 'ignorado');
  assert.equal(ctx.juego.recibirMensaje('@ANA', '!JUGAR').accion, 'ignorado');
  assert.equal(ctx.juego.jugadores.length, 1);
});

test('mínimo 2 jugadores: con 1 no arranca y se extiende la inscripción', () => {
  const ctx = crearJuego();
  ctx.juego.abrirInscripcion();
  ctx.juego.recibirMensaje('solo', '!jugar');
  assert.equal(ctx.juego.iniciarPartida(), false);
  ctx.reloj.avanzar(ctx.juego.config.segundosInscripcion * 1000);
  assert.equal(ctx.juego.fase, 'inscripcion');
  assert.ok(ctx.eventos.some((e) => e.tipo === 'faltanJugadores'));
  ctx.juego.recibirMensaje('otro', '!jugar');
  ctx.reloj.avanzar(ctx.juego.config.segundosInscripcion * 1000);
  assert.equal(ctx.juego.fase, 'jugando');
});

test('al terminar la cuenta regresiva con 2 o más, arranca la partida', () => {
  const ctx = crearJuego();
  ctx.juego.abrirInscripcion();
  ctx.juego.recibirMensaje('a', '!jugar');
  ctx.juego.recibirMensaje('b', '!jugar');
  ctx.reloj.avanzar(59999);
  assert.equal(ctx.juego.fase, 'inscripcion');
  ctx.reloj.avanzar(1);
  assert.equal(ctx.juego.fase, 'jugando');
});

/* ---------- Turnos ---------- */

test('el orden de turnos es el orden de ingreso y vuelve a empezar', () => {
  const ctx = partidaCon(['carla', 'ana', 'bruno']);
  const orden = [];
  for (let i = 0; i < 7; i++) {
    orden.push(turnoDe(ctx.juego));
    jugar(ctx, '7'); // la carta por defecto es 2♣: 0 puntos
  }
  assert.deepEqual(orden, ['carla', 'ana', 'bruno', 'carla', 'ana', 'bruno', 'carla']);
});

test('solo el jugador del turno puede jugar; los demás se ignoran', () => {
  const ctx = partidaCon(['a', 'b']);
  assert.equal(ctx.juego.recibirMensaje('b', 'rojo').accion, 'ignorado');
  assert.equal(ctx.juego.recibirMensaje('espectador', 'rojo').accion, 'ignorado');
  assert.equal(turnoDe(ctx.juego), 'a');
});

test('solo cuenta la primera predicción válida del turno', () => {
  const ctx = partidaCon(['a', 'b'], { cartas: [carta(5, 'diamantes'), carta(5, 'diamantes')] });
  assert.equal(ctx.juego.recibirMensaje('a', 'rojo').accion, 'prediccion');
  assert.equal(ctx.juego.recibirMensaje('a', '5 de diamantes').accion, 'ignorado');
  assert.equal(ctx.juego.jugadores[0].puntos, 1);
});

test('una predicción inválida se ignora y puede reintentar mientras haya tiempo', () => {
  const ctx = partidaCon(['a', 'b'], { cartas: [carta(5, 'diamantes')] });
  assert.equal(ctx.juego.recibirMensaje('a', 'hola qué tal').accion, 'invalida');
  assert.equal(ctx.juego.recibirMensaje('a', 'rojo picas').accion, 'invalida');
  ctx.reloj.avanzar(5000);
  assert.equal(ctx.juego.recibirMensaje('a', 'cinco diamantes').accion, 'prediccion');
  assert.equal(ctx.juego.jugadores[0].puntos, 6);
});

test('si se acaba el tiempo pierde el turno sin puntos y sigue el siguiente', () => {
  const ctx = partidaCon(['a', 'b']);
  ctx.reloj.avanzar(10000);
  assert.equal(ctx.juego.subfase, 'pausa');
  assert.equal(ctx.juego.recibirMensaje('a', 'rojo').accion, 'ignorado'); // ya tarde
  ctx.reloj.avanzar(ctx.juego.config.pausaTiempoAgotadoMs);
  assert.equal(turnoDe(ctx.juego), 'b');
  assert.equal(ctx.juego.jugadores[0].puntos, 0);
  assert.equal(ctx.juego.jugadores[0].sinResponder, 1);
});

test('eliminación tras 2 turnos seguidos sin responder', () => {
  const ctx = partidaCon(['a', 'b', 'c']);
  dejarPasarTurno(ctx);       // a no responde (1)
  jugar(ctx, '7');            // b
  jugar(ctx, '7');            // c
  assert.equal(turnoDe(ctx.juego), 'a');
  dejarPasarTurno(ctx);       // a no responde (2) -> eliminado
  assert.deepEqual(ctx.juego.jugadores.map((j) => j.nombre), ['b', 'c']);
  assert.equal(turnoDe(ctx.juego), 'b');
  const elim = ctx.eventos.find((e) => e.tipo === 'jugadorEliminado');
  assert.equal(elim.datos.nombre, 'a');
  assert.equal(elim.datos.motivo, 'sinResponder');
});

test('el contador de turnos sin responder se reinicia al contestar a tiempo', () => {
  const ctx = partidaCon(['a', 'b']);
  dejarPasarTurno(ctx);  // a: 1
  jugar(ctx, '7');       // b
  jugar(ctx, '7');       // a contesta -> 0
  assert.equal(ctx.juego.jugadores[0].sinResponder, 0);
  jugar(ctx, '7');       // b
  dejarPasarTurno(ctx);  // a: 1 (no eliminado)
  assert.equal(ctx.juego.jugadores.length, 2);
  assert.equal(ctx.juego.jugadores[0].sinResponder, 1);
});

test('el eliminado deja su lugar y entra el primero de la lista de espera', () => {
  const ctx = crearJuego();
  ctx.juego.abrirInscripcion();
  ['a', 'b', 'c'].forEach((n) => ctx.juego.recibirMensaje(n, '!jugar'));
  ctx.juego.iniciarPartida();
  ctx.juego.recibirMensaje('d', '!jugar'); // partida en curso -> espera
  assert.deepEqual(ctx.juego.espera, ['d']);
  dejarPasarTurno(ctx); jugar(ctx, '7'); jugar(ctx, '7'); dejarPasarTurno(ctx); // a eliminado
  assert.deepEqual(ctx.juego.jugadores.map((j) => j.nombre), ['b', 'c', 'd']);
  assert.deepEqual(ctx.juego.espera, []);
  assert.equal(turnoDe(ctx.juego), 'b');
  jugar(ctx, '7'); jugar(ctx, '7');
  assert.equal(turnoDe(ctx.juego), 'd');
});

test('si queda un solo jugador, gana', () => {
  const ctx = partidaCon(['a', 'b'], { config: { listaDeEspera: false } });
  dejarPasarTurno(ctx);  // a: 1
  jugar(ctx, '7');       // b
  dejarPasarTurno(ctx);  // a: 2 -> eliminado, queda b
  assert.equal(ctx.juego.fase, 'terminada');
  assert.equal(ctx.juego.ganador.nombre, 'b');
  assert.equal(ctx.juego.motivoFin, 'ultimo');
});

test('!salir durante el propio turno pasa al siguiente', () => {
  const ctx = partidaCon(['a', 'b', 'c']);
  ctx.juego.recibirMensaje('a', '!salir');
  assert.equal(turnoDe(ctx.juego), 'b');
  assert.equal(ctx.juego.jugadores.length, 2);
});

/* ---------- Puntaje y victoria ---------- */

test('gana el primero que llega a 10 o más (8 + 6 = 14 también gana)', () => {
  const ctx = partidaCon(['a', 'b'], {
    cartas: [carta(5, 'diamantes'), carta(2, 'treboles'), carta(5, 'diamantes')]
  });
  ctx.juego.jugadores[0].puntos = 8;
  jugar(ctx, 'rojo 7');          // a: +1 -> 9 (no gana todavía)
  assert.equal(ctx.juego.fase, 'jugando');
  jugar(ctx, '7');               // b: 0
  ctx.juego.recibirMensaje('a', '5 de diamantes'); // a: +6 -> 15
  assert.equal(ctx.juego.jugadores[0].puntos, 15);
  ctx.reloj.avanzar(ctx.juego.config.pausaRevelacionMs);
  assert.equal(ctx.juego.fase, 'terminada');
  assert.equal(ctx.juego.ganador.nombre, 'a');
  assert.equal(ctx.juego.motivoFin, 'puntos');
});

test('8 + 6 = 14 gana (pasarse no existe)', () => {
  const ctx = partidaCon(['a', 'b'], { cartas: [carta(13, 'picas')] });
  ctx.juego.jugadores[0].puntos = 8;
  jugar(ctx, 'rey de picas');
  assert.equal(ctx.juego.fase, 'terminada');
  assert.equal(ctx.juego.ganador.nombre, 'a');
  assert.equal(ctx.juego.ganador.puntos, 14);
});

test('llegar exacto a 10 también gana', () => {
  const ctx = partidaCon(['a', 'b'], { cartas: [carta(4, 'corazones')] });
  ctx.juego.jugadores[0].puntos = 7;
  jugar(ctx, '4');
  assert.equal(ctx.juego.ganador.nombre, 'a');
});

test('con 9 puntos no gana', () => {
  const ctx = partidaCon(['a', 'b'], { cartas: [carta(4, 'corazones')] });
  ctx.juego.jugadores[0].puntos = 6;
  jugar(ctx, '4');
  assert.equal(ctx.juego.jugadores[0].puntos, 9);
  assert.equal(ctx.juego.fase, 'jugando');
});

test('el puntaje objetivo es configurable', () => {
  const ctx = partidaCon(['a', 'b'], { config: { puntajeObjetivo: 20 }, cartas: [carta(13, 'picas')] });
  ctx.juego.jugadores[0].puntos = 8;
  jugar(ctx, 'rey de picas');
  assert.equal(ctx.juego.fase, 'jugando');
});

/* ---------- Joker en la partida ---------- */

test('anuncia joker y sale el Joker derecho: +10 y gana aunque tenga pocos puntos', () => {
  const ctx = partidaCon(['a', 'b', 'c'], { cartas: [JOKER_DERECHO] });
  jugar(ctx, 'joker');
  assert.equal(ctx.juego.fase, 'terminada');
  assert.equal(ctx.juego.ganador.nombre, 'a');
  assert.equal(ctx.juego.ganador.puntos, 10);
  assert.equal(ctx.juego.motivoFin, 'joker');
});

test('anuncia joker y sale el Joker de cabeza: -10 y queda eliminado, los demás siguen', () => {
  const ctx = partidaCon(['a', 'b', 'c'], { cartas: [JOKER_CABEZA] });
  ctx.juego.jugadores[0].puntos = 4;
  jugar(ctx, 'joker');
  assert.equal(ctx.juego.fase, 'jugando');
  assert.deepEqual(ctx.juego.jugadores.map((j) => j.nombre), ['b', 'c']);
  const elim = ctx.juego.eliminados.find((e) => e.nombre === 'a');
  assert.equal(elim.puntos, -6);
  assert.equal(elim.motivo, 'jokerDeCabeza');
  assert.equal(turnoDe(ctx.juego), 'b');
});

test('Joker de cabeza con 2 jugadores: el otro gana por quedar solo', () => {
  const ctx = partidaCon(['a', 'b'], { cartas: [JOKER_CABEZA], config: { listaDeEspera: false } });
  jugar(ctx, 'joker');
  assert.equal(ctx.juego.fase, 'terminada');
  assert.equal(ctx.juego.ganador.nombre, 'b');
});

test('no anunció joker y sale cualquiera: +9 (sin ganar ni eliminar)', () => {
  const ctx = partidaCon(['a', 'b'], { cartas: [JOKER_CABEZA, JOKER_DERECHO] });
  jugar(ctx, 'rojo');
  jugar(ctx, '5 de picas');
  assert.equal(ctx.juego.jugadores[0].puntos, 9);
  assert.equal(ctx.juego.jugadores[1].puntos, 9);
  assert.equal(ctx.juego.fase, 'jugando');
});

test('Joker sorpresa puede hacer ganar si llega a 10', () => {
  const ctx = partidaCon(['a', 'b'], { cartas: [JOKER_DERECHO] });
  ctx.juego.jugadores[0].puntos = 1;
  jugar(ctx, 'negro');
  assert.equal(ctx.juego.ganador.nombre, 'a');
});

test('anuncia joker y sale carta normal: 0 puntos', () => {
  const ctx = partidaCon(['a', 'b'], { cartas: [carta(5, 'diamantes')] });
  jugar(ctx, 'joker');
  assert.equal(ctx.juego.jugadores[0].puntos, 0);
  assert.equal(ctx.juego.fase, 'jugando');
});

/* ---------- Conector de chat ---------- */

test('todo entra por onChatMessage(usuario, texto)', () => {
  const ctx = crearJuego({ cartas: [carta(5, 'diamantes')] });
  const onChatMessage = AL10.crearConectorChat(ctx.juego);
  ctx.juego.abrirInscripcion();
  onChatMessage('ana', '!jugar');
  onChatMessage('beto', '!jugar');
  ctx.juego.iniciarPartida();
  assert.equal(onChatMessage('ana', '5♦').accion, 'prediccion');
  assert.equal(ctx.juego.jugadores[0].puntos, 6);
});

test('nueva inscripción reinicia todo', () => {
  const ctx = partidaCon(['a', 'b'], { cartas: [JOKER_DERECHO] });
  jugar(ctx, 'joker');
  assert.equal(ctx.juego.fase, 'terminada');
  ctx.juego.abrirInscripcion();
  assert.equal(ctx.juego.fase, 'inscripcion');
  assert.equal(ctx.juego.jugadores.length, 0);
  assert.equal(ctx.juego.ganador, null);
});
