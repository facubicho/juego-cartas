const test = require('node:test');
const assert = require('node:assert/strict');
const { crearJuego, partidaCon } = require('./ayuda');

test('!cafecito muestra el link (evento cafecito)', () => {
  const ctx = crearJuego();
  const r = ctx.juego.recibirMensaje('ana', '!cafecito');
  assert.equal(r.accion, 'cafecito');
  const ev = ctx.eventos.find((e) => e.tipo === 'cafecito');
  assert.equal(ev.datos.url, 'https://cafecito.app/facubicho');
  assert.equal(ev.datos.nombre, 'ana');
});

test('!cafecito funciona en cualquier fase y sin estar anotado', () => {
  const ctx = partidaCon(['a', 'b']);
  assert.equal(ctx.juego.recibirMensaje('espectador', '!CAFECITO').accion, 'cafecito');
});

test('el mismo jugador no puede repetirlo seguido', () => {
  const ctx = crearJuego();
  ctx.juego.recibirMensaje('ana', '!cafecito');
  ctx.reloj.avanzar(5000);
  const r = ctx.juego.recibirMensaje('ana', '!cafecito');
  assert.equal(r.accion, 'ignorado');
  assert.equal(r.motivo, 'cafecitoReciente');
});

test('máximo una vez por minuto en total (otro jugador tampoco puede)', () => {
  const ctx = crearJuego();
  ctx.juego.recibirMensaje('ana', '!cafecito');
  ctx.reloj.avanzar(59999);
  assert.equal(ctx.juego.recibirMensaje('beto', '!cafecito').accion, 'ignorado');
  ctx.reloj.avanzar(1);
  assert.equal(ctx.juego.recibirMensaje('beto', '!cafecito').accion, 'cafecito');
  assert.equal(ctx.eventos.filter((e) => e.tipo === 'cafecito').length, 2);
});

test('el límite no se reinicia al abrir una nueva inscripción', () => {
  const ctx = crearJuego();
  ctx.juego.recibirMensaje('ana', '!cafecito');
  ctx.juego.abrirInscripcion();
  assert.equal(ctx.juego.recibirMensaje('beto', '!cafecito').accion, 'ignorado');
});

test('!cafecito en el propio turno no cuenta como predicción ni corta el turno', () => {
  const ctx = partidaCon(['a', 'b']);
  assert.equal(ctx.juego.recibirMensaje('a', '!cafecito').accion, 'cafecito');
  assert.equal(ctx.juego.subfase, 'turno');
  assert.equal(ctx.juego.jugadorActual().nombre, 'a');
  assert.equal(ctx.juego.recibirMensaje('a', 'rojo').accion, 'prediccion');
});

test('con el cartel desactivado (?cafecito=0) el comando se ignora', () => {
  const ctx = crearJuego({ config: { cafecito: { activo: false } } });
  assert.equal(ctx.juego.recibirMensaje('ana', '!cafecito').accion, 'ignorado');
  assert.equal(ctx.eventos.filter((e) => e.tipo === 'cafecito').length, 0);
});

test('el link se cambia desde la configuración', () => {
  const ctx = crearJuego({ config: { cafecito: { url: 'https://cafecito.app/otro' } } });
  ctx.juego.recibirMensaje('ana', '!cafecito');
  assert.equal(ctx.eventos.find((e) => e.tipo === 'cafecito').datos.url, 'https://cafecito.app/otro');
});
