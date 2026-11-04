const test = require('node:test');
const assert = require('node:assert/strict');
const { GestorSalas, codigoValido, ALFABETO } = require('../../servidor/salas');

function reloj() { let t = 1000; return { ahora: () => t, avanzar: (ms) => { t += ms; } }; }

test('crear sala: código de 4 letras sin letras confusas y token del anfitrión', () => {
  const g = new GestorSalas();
  const s = g.crear();
  assert.match(s.codigo, /^[A-Z]{4}$/);
  assert.ok(codigoValido(s.codigo));
  assert.ok(!/[IO]/.test(ALFABETO));
  assert.match(s.tokenAnfitrion, /^[0-9a-f]{32}$/);
  assert.equal(g.obtener(s.codigo.toLowerCase()), s);
  assert.equal(g.obtener('????'), null);
});

test('los códigos no se repiten y cada sala tiene su propia partida', () => {
  const g = new GestorSalas();
  const salas = Array.from({ length: 40 }, () => g.crear());
  assert.equal(new Set(salas.map((s) => s.codigo)).size, 40);
  assert.notEqual(salas[0].juego, salas[1].juego);
  salas[0].juego.abrirInscripcion();
  assert.equal(salas[0].juego.fase, 'inscripcion');
  assert.equal(salas[1].juego.fase, 'espera');
  g.cerrarTodas();
});

test('máximo de salas simultáneas configurable', () => {
  const g = new GestorSalas({ maxSalas: 2 });
  g.crear(); g.crear();
  assert.deepEqual(g.crear(), { error: 'demasiadasSalas' });
});

test('unirse: limpia el nombre y lo corta en 20 caracteres', () => {
  const s = new GestorSalas().crear();
  const r = s.unirse('   Ana\u200B   María   con un nombre larguísimo  ', 'dispositivo-1');
  assert.equal(r.jugador.nombre.length <= 20, true);
  assert.equal(r.jugador.nombre, 'Ana María con un nom');
  assert.equal(s.unirse('   ', 'dispositivo-2').error, 'nombreInvalido');
  assert.equal(s.unirse(123, 'dispositivo-3').error, 'nombreInvalido');
});

test('nombres repetidos: no se permiten (sin importar mayúsculas, tildes ni espacios)', () => {
  const s = new GestorSalas().crear();
  assert.ok(s.unirse('José', 'dispositivo-1').jugador);
  assert.equal(s.unirse('jose', 'dispositivo-2').error, 'nombreRepetido');
  assert.equal(s.unirse('  JOSÉ ', 'dispositivo-3').error, 'nombreRepetido');
  assert.ok(s.unirse('José 2', 'dispositivo-4').jugador);
});

test('el mismo dispositivo recupera su lugar (y su nombre)', () => {
  const s = new GestorSalas().crear();
  const a = s.unirse('Ana', 'dispositivo-1');
  const b = s.unirse('Otro nombre', 'dispositivo-1');
  assert.equal(b.recuperado, true);
  assert.equal(b.jugador.id, a.jugador.id);
  assert.equal(b.jugador.nombre, 'Ana');
  assert.equal(s.unirse('Ana', 'x').error, 'dispositivoInvalido');
});

test('los mensajes pasan por onChatMessage con el id del jugador y su nombre visible', () => {
  const s = new GestorSalas().crear();
  const a = s.unirse('Ana', 'dispositivo-1').jugador;
  s.accionAnfitrion('abrirInscripcion');
  assert.equal(s.mensaje(a, '!jugar').accion, 'inscripto');
  assert.equal(s.juego.jugadores[0].clave, a.id);
  assert.equal(s.juego.jugadores[0].nombre, 'Ana');
  s.cerrar();
});

test('límite de mensajes por segundo por jugador', () => {
  const r = reloj();
  const s = new GestorSalas({ ahora: r.ahora, mensajesPorSegundo: 3 }).crear();
  const a = s.unirse('Ana', 'dispositivo-1').jugador;
  const resultados = Array.from({ length: 5 }, () => s.mensaje(a, 'hola').accion);
  assert.deepEqual(resultados, ['ignorado', 'ignorado', 'ignorado', 'limite', 'limite']);
  r.avanzar(1000);
  assert.equal(s.mensaje(a, 'hola').accion, 'ignorado');
});

test('limpieza de mensajes: invisibles, espacios y largo máximo de 100', () => {
  const s = new GestorSalas().crear();
  const a = s.unirse('Ana', 'dispositivo-1').jugador;
  const recibidos = [];
  s.juego.recibirMensaje = (u, t, n) => { recibidos.push([u, t, n]); return { accion: 'ignorado' }; };
  s.onChatMessage = (u, t, n) => s.juego.recibirMensaje(u, t, n);
  s.mensaje(a, '   rojo\u0007   ' + 'x'.repeat(300));
  assert.equal(recibidos[0][1].length, 100);
  assert.ok(recibidos[0][1].startsWith('rojo x'));
  assert.equal(s.mensaje(a, '   ').accion, 'ignorado');
  assert.equal(recibidos.length, 1);
});

test('expiración: las salas sin actividad se borran solas', () => {
  const r = reloj();
  const cerradas = [];
  const g = new GestorSalas({ ahora: r.ahora, inactividadMs: 2 * 60 * 60 * 1000, alCerrar: (s, motivo) => cerradas.push([s.codigo, motivo]) });
  const vieja = g.crear();
  r.avanzar(60 * 60 * 1000);
  const nueva = g.crear();
  r.avanzar(60 * 60 * 1000); // vieja: 2 h sin actividad; nueva: 1 h
  assert.deepEqual(g.limpiarInactivas(), [vieja.codigo]);
  assert.equal(g.obtener(vieja.codigo), null);
  assert.equal(g.obtener(nueva.codigo), nueva);
  assert.deepEqual(cerradas, [[vieja.codigo, 'inactiva']]);
  assert.equal(vieja.cerrada, true);
});

test('la actividad (mensajes, entradas) mantiene viva la sala', () => {
  const r = reloj();
  const g = new GestorSalas({ ahora: r.ahora, inactividadMs: 1000 });
  const s = g.crear();
  r.avanzar(900);
  s.unirse('Ana', 'dispositivo-1');
  r.avanzar(900);
  assert.deepEqual(g.limpiarInactivas(), []);
  r.avanzar(100);
  assert.deepEqual(g.limpiarInactivas(), [s.codigo]);
});

test('el estado para las pantallas trae el reloj restante y la gente de la sala', () => {
  const s = new GestorSalas().crear();
  s.unirse('Ana', 'dispositivo-1');
  s.accionAnfitrion('abrirInscripcion');
  const e = s.estado();
  assert.ok(e.restanteMs > 59000 && e.restanteMs <= 60000);
  assert.equal(e.finEn, undefined);
  assert.deepEqual(e.sala.personas.map((p) => [p.nombre, p.conectado]), [['Ana', false]]);
  assert.doesNotThrow(() => JSON.stringify(e));
  s.cerrar();
});
