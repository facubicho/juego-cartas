/*
 * Prueba de punta a punta sin TikTok:
 * eventos de chat -> puente -> WebSocket local -> cliente de la página -> onChatMessage -> juego.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const WebSocket = require('ws');
const { AL10, crearJuego, carta } = require('../ayuda');
const { crearServidorWs } = require('../../conector/servidor-ws');
const { crearPuente } = require('../../conector/puente');
const { crearLimitador } = require('../../conector/limitador');

const ev = (uniqueId, nickname, comment) => ({ user: { uniqueId, nickname }, comment });

function hasta(condicion, ms = 2000) {
  return new Promise((resolve, reject) => {
    const inicio = Date.now();
    (function revisar() {
      if (condicion()) return resolve();
      if (Date.now() - inicio > ms) return reject(new Error('tiempo agotado'));
      setTimeout(revisar, 10);
    })();
  });
}

test('los comentarios llegan al juego por onChatMessage (como el simulador)', async (t) => {
  const recibidosPorServidor = [];
  let puente;
  const servidor = await crearServidorWs({
    puerto: 0,
    alMensaje: (m) => { recibidosPorServidor.push(m); if (m.tipo === 'turno') puente.marcarTurno(m.usuario); }
  });
  t.after(() => servidor.cerrar());
  puente = crearPuente({ enviar: (m) => servidor.difundir(m), limitador: crearLimitador({ maxPorSegundo: 50 }), mostrar: 'apodo' });

  const ctx = crearJuego({ cartas: [carta(5, 'diamantes')] });
  const onChatMessage = AL10.crearConectorChat(ctx.juego);
  const estados = [];
  const cliente = AL10.crearClienteChat({
    url: 'ws://127.0.0.1:' + servidor.puerto, WebSocketImpl: WebSocket, onChatMessage, alEstado: (e) => estados.push(e)
  });
  t.after(() => cliente.cerrar());
  await hasta(() => cliente.estado().servidor === 'conectado' && servidor.cantidadClientes() === 1);

  servidor.difundirEstado({ tiktok: 'conectado', usuario: 'chat de prueba' });
  await hasta(() => cliente.estado().tiktok === 'conectado');

  ctx.juego.abrirInscripcion();
  puente.procesar(ev('ana_1', 'Ana ✨', '  !jugar '));
  puente.procesar(ev('beto_2', 'Beto', '!jugar'));
  await hasta(() => ctx.juego.jugadores.length === 2);
  assert.deepEqual(ctx.juego.jugadores.map((j) => j.nombre), ['Ana ✨', 'Beto']);

  ctx.juego.iniciarPartida();
  // la página le avisa al conector de quién es el turno
  cliente.enviar({ tipo: 'turno', usuario: ctx.juego.jugadorActual().clave });
  await hasta(() => recibidosPorServidor.some((m) => m.tipo === 'turno'));
  assert.equal(recibidosPorServidor.at(-1).usuario, 'ana_1');

  puente.procesar(ev('ana_1', 'Ana ✨', '5♦'));
  await hasta(() => ctx.juego.jugadores[0].puntos === 6);
});

test('mensajes mal formados se ignoran sin romper', async (t) => {
  const servidor = await crearServidorWs({ puerto: 0 });
  t.after(() => servidor.cerrar());
  const llamadas = [];
  const cliente = AL10.crearClienteChat({
    url: 'ws://127.0.0.1:' + servidor.puerto, WebSocketImpl: WebSocket, onChatMessage: (...a) => llamadas.push(a)
  });
  t.after(() => cliente.cerrar());
  await hasta(() => servidor.cantidadClientes() === 1);
  servidor.difundir({ tipo: 'chat', usuario: 5, texto: 'x' });
  servidor.difundir({ tipo: 'otro' });
  servidor.difundir({ tipo: 'chat', usuario: 'ok', texto: 'rojo', nombre: 'Ok' });
  await hasta(() => llamadas.length === 1);
  assert.deepEqual(llamadas[0], ['ok', 'rojo', 'Ok']);
});

test('la página se reconecta sola si el conector se reinicia', async (t) => {
  let servidor = await crearServidorWs({ puerto: 0 });
  const puerto = servidor.puerto;
  const cliente = AL10.crearClienteChat({
    url: 'ws://127.0.0.1:' + puerto, WebSocketImpl: WebSocket, onChatMessage: () => {}, esperaInicialMs: 50, esperaMaxMs: 100
  });
  t.after(() => { cliente.cerrar(); return servidor.cerrar(); });
  await hasta(() => cliente.estado().servidor === 'conectado');
  await servidor.cerrar();
  await hasta(() => cliente.estado().servidor === 'desconectado');
  servidor = await crearServidorWs({ puerto });
  await hasta(() => cliente.estado().servidor === 'conectado', 3000);
});

test('normalizarUrlChat acepta ws://, wss:// o un número de puerto', () => {
  assert.equal(AL10.normalizarUrlChat('ws://localhost:8080'), 'ws://localhost:8080');
  assert.equal(AL10.normalizarUrlChat('8081'), 'ws://localhost:8081');
  assert.equal(AL10.normalizarUrlChat('wss://ejemplo.com/chat'), 'wss://ejemplo.com/chat');
  assert.equal(AL10.normalizarUrlChat('http://x'), null);
  assert.equal(AL10.normalizarUrlChat(''), null);
});

test('el chat de prueba genera comentarios con el formato de TikTok', () => {
  const { crearFuentePrueba } = require('../../conector/fuente-prueba');
  const timers = [];
  const eventos = [];
  const f = crearFuentePrueba({ alComentario: (e) => eventos.push(e), programar: (fn, ms) => { timers.push(fn); return fn; }, cancelar: () => {} });
  return f.conectar().then(() => {
    for (let i = 0; i < 12; i++) timers.shift()(); // los 12 !jugar
    assert.equal(eventos.length, 12);
    assert.ok(eventos.every((e) => e.user.uniqueId && e.user.nickname && e.comment === '!jugar'));
  });
});
