const test = require('node:test');
const assert = require('node:assert/strict');
const { crearJuego } = require('./ayuda');

test('el jugador se identifica por su usuario único y se muestra el apodo', () => {
  const ctx = crearJuego();
  ctx.juego.abrirInscripcion();
  ctx.juego.recibirMensaje('ana_123', '!jugar', 'Ana ✨');
  ctx.juego.recibirMensaje('beto.x', '!jugar', 'Beto');
  assert.deepEqual(ctx.juego.jugadores.map((j) => j.nombre), ['Ana ✨', 'Beto']);
  ctx.juego.iniciarPartida();
  // juega con su usuario único aunque cambie el apodo
  assert.equal(ctx.juego.recibirMensaje('ana_123', 'rojo', 'Ana nuevo apodo').accion, 'prediccion');
});

test('dos personas con el mismo apodo son jugadores distintos', () => {
  const ctx = crearJuego();
  ctx.juego.abrirInscripcion();
  ctx.juego.recibirMensaje('juan1', '!jugar', 'Juan');
  ctx.juego.recibirMensaje('juan2', '!jugar', 'Juan');
  assert.equal(ctx.juego.jugadores.length, 2);
});

test('un apodo igual al del jugador del turno no puede jugar por él', () => {
  const ctx = crearJuego();
  ctx.juego.abrirInscripcion();
  ctx.juego.recibirMensaje('juan1', '!jugar', 'Juan');
  ctx.juego.recibirMensaje('otro', '!jugar', 'Otro');
  ctx.juego.iniciarPartida();
  assert.equal(ctx.juego.recibirMensaje('impostor', 'rojo', 'Juan').accion, 'ignorado');
});

test('cambiar el apodo no permite anotarse dos veces ni en la lista de espera', () => {
  const ctx = crearJuego({ config: { maxJugadores: 2 } });
  ctx.juego.abrirInscripcion();
  ctx.juego.recibirMensaje('a', '!jugar', 'A');
  ctx.juego.recibirMensaje('b', '!jugar', 'B');
  ctx.juego.recibirMensaje('c', '!jugar', 'Ce');
  assert.equal(ctx.juego.recibirMensaje('c', '!jugar', 'Ce otra vez').accion, 'ignorado');
  assert.equal(ctx.juego.recibirMensaje('A', '!jugar', 'A2').accion, 'ignorado');
  assert.deepEqual(ctx.juego.espera, ['Ce']);
});

test('!salir de la lista de espera funciona por usuario único', () => {
  const ctx = crearJuego({ config: { maxJugadores: 1 } });
  ctx.juego.abrirInscripcion();
  ctx.juego.recibirMensaje('a', '!jugar', 'A');
  ctx.juego.recibirMensaje('b', '!jugar', 'Be');
  ctx.juego.recibirMensaje('b', '!salir', 'Otro apodo');
  assert.deepEqual(ctx.juego.espera, []);
});
