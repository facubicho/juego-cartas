/*
 * Pruebas de punta a punta: servidor real + varios clientes WebSocket simulados.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { levantar, cliente, hasta, crearSalaCon, jugador } = require('./ayuda-servidor');

const carta = (valor, palo) => ({ tipo: 'normal', valor, palo, color: palo === 'corazones' || palo === 'diamantes' ? 'rojo' : 'negro' });
const JOKER_DERECHO = { tipo: 'joker', variante: 'derecho' };

function mazo(cartas) {
  const cola = cartas.slice();
  return () => (cola.length ? cola.shift() : carta(2, 'treboles'));
}

async function anotarTodos(jugadores) {
  for (const j of jugadores) {
    const p = j.esperar((m) => m.tipo === 'resultado');
    j.enviar({ tipo: 'mensaje', texto: '!jugar' });
    j.anotado = await p;
  }
}

test('partida completa en una sala: anfitrión + 3 celulares hasta un ganador', async (t) => {
  const app = await levantar({ sacarCarta: mazo([carta(5, 'diamantes'), carta(2, 'treboles'), JOKER_DERECHO]) });
  t.after(() => app.cerrar());
  const { anfitrion, codigo } = await crearSalaCon(app);
  const [ana, beto, caro] = await Promise.all(['Ana', 'Beto', 'Caro'].map((n) => jugador(app, codigo, n)));
  assert.equal(ana.respuesta.tipo, 'bienvenida');
  assert.equal(ana.respuesta.yo.nombre, 'Ana');

  // el anfitrión ve a los 3 conectados
  await hasta(() => anfitrion.estado().sala.personas.filter((p) => p.conectado).length === 3, 2000, '3 conectados');

  anfitrion.enviar({ tipo: 'accion', accion: 'abrirInscripcion' });
  await anfitrion.esperarCualquiera((m) => m.evento === 'inscripcionAbierta');
  await anotarTodos([ana, beto, caro]);
  assert.deepEqual([ana, beto, caro].map((j) => j.anotado.accion), ['inscripto', 'inscripto', 'inscripto']);

  anfitrion.enviar({ tipo: 'accion', accion: 'empezar' });
  const turno = (nombre) => hasta(() => { const e = anfitrion.estado(); return e.subfase === 'turno' && e.jugadorActual === nombre; }, 3000, 'turno de ' + nombre);

  // Turno 1: Ana dice "rojo" y sale el 5♦ (+1). El orden es el de inscripción.
  await turno('Ana');
  beto.enviar({ tipo: 'mensaje', texto: 'negro' }); // no es su turno: se ignora
  assert.equal((await beto.esperar((m) => m.tipo === 'resultado')).accion, 'ignorado');
  ana.enviar({ tipo: 'mensaje', texto: 'rojo' });
  assert.equal((await ana.esperar((m) => m.tipo === 'resultado')).accion, 'prediccion');
  const rev = await anfitrion.esperarCualquiera((m) => m.evento === 'revelacion');
  assert.equal(rev.datos.resultado.puntos, 1);
  // todos los celulares reciben el evento
  await Promise.all([ana, beto, caro].map((j) => j.esperarCualquiera((m) => m.evento === 'revelacion')));

  // Turno 2: Beto dice "7" y sale 2♣ (0)
  await turno('Beto');
  beto.enviar({ tipo: 'mensaje', texto: '7' });
  // Turno 3: Caro no contesta: se acaba el tiempo
  await turno('Caro');
  await caro.esperarCualquiera((m) => m.evento === 'tiempoAgotado', 2000);
  // Turno 4: Ana anuncia joker y sale el Joker derecho: gana
  await turno('Ana');
  ana.enviar({ tipo: 'mensaje', texto: 'joker' });
  const fin = await anfitrion.esperarCualquiera((m) => m.evento === 'partidaTerminada', 3000);
  assert.equal(fin.datos.ganador, 'Ana');
  assert.equal(fin.estado.fase, 'terminada');
  for (const j of [ana, beto, caro]) {
    const f = await j.esperarCualquiera((m) => m.evento === 'partidaTerminada');
    assert.equal(f.estado.ganador, 'Ana');
  }
  assert.deepEqual(fin.estado.resumen.map((f) => [f.nombre, f.puntos]), [['Ana', 11], ['Beto', 0], ['Caro', 0]]);

  // Nueva inscripción
  anfitrion.enviar({ tipo: 'accion', accion: 'abrirInscripcion' });
  await hasta(() => anfitrion.estado().fase === 'inscripcion');
  await Promise.all([anfitrion, ana, beto, caro].map((c) => c.cerrar()));
});

test('nombres repetidos: el segundo tiene que elegir otro', async (t) => {
  const app = await levantar();
  t.after(() => app.cerrar());
  const { anfitrion, codigo } = await crearSalaCon(app);
  const a = await jugador(app, codigo, 'Lucía');
  const b = await jugador(app, codigo, 'lucia');
  assert.equal(a.respuesta.tipo, 'bienvenida');
  assert.deepEqual(b.respuesta, { tipo: 'error', error: 'nombreRepetido' });
  const p = b.esperar((m) => m.tipo === 'bienvenida');
  b.enviar({ tipo: 'unirse', codigo, nombre: 'Lucía B', dispositivo: 'disp-lucia-b-0000' });
  assert.equal((await p).yo.nombre, 'Lucía B');
  await Promise.all([anfitrion, a, b].map((c) => c.cerrar()));
});

test('sala inexistente y código mal escrito', async (t) => {
  const app = await levantar();
  t.after(() => app.cerrar());
  const a = await jugador(app, 'ZZZZ', 'Ana');
  assert.deepEqual(a.respuesta, { tipo: 'error', error: 'salaNoExiste' });
  const b = await jugador(app, '<script>', 'Ana');
  assert.deepEqual(b.respuesta, { tipo: 'error', error: 'salaNoExiste' });
  await Promise.all([a.cerrar(), b.cerrar()]);
});

test('límite de 10 jugadores: el resto queda de espectador en la lista de espera', async (t) => {
  const app = await levantar();
  t.after(() => app.cerrar());
  const { anfitrion, codigo } = await crearSalaCon(app);
  const nombres = Array.from({ length: 12 }, (_, i) => 'Jugador' + (i + 1));
  const js = [];
  for (const n of nombres) js.push(await jugador(app, codigo, n));
  anfitrion.enviar({ tipo: 'accion', accion: 'abrirInscripcion' });
  await anfitrion.esperarCualquiera((m) => m.evento === 'inscripcionAbierta');
  await anotarTodos(js);
  assert.deepEqual(js.map((j) => j.anotado.accion), Array(10).fill('inscripto').concat(['enEspera', 'enEspera']));
  const e = await hasta(() => { const x = anfitrion.estado(); return x.jugadores.length === 10 && x.espera.length === 2 && x; });
  assert.deepEqual(e.espera, ['Jugador11', 'Jugador12']);
  assert.deepEqual(e.esperaIds, [js[10].respuesta.yo.id, js[11].respuesta.yo.id]);
  await Promise.all([anfitrion, ...js].map((c) => c.cerrar()));
});

test('turnos y tiempo: sin respuesta pierde el turno; 2 seguidos y queda eliminado', async (t) => {
  const app = await levantar();
  t.after(() => app.cerrar());
  const { anfitrion, codigo } = await crearSalaCon(app);
  const [a, b, c] = await Promise.all(['A', 'B', 'C'].map((n) => jugador(app, codigo, n)));
  anfitrion.enviar({ tipo: 'accion', accion: 'abrirInscripcion' });
  await anfitrion.esperarCualquiera((m) => m.evento === 'inscripcionAbierta');
  await anotarTodos([a, b, c]);
  anfitrion.enviar({ tipo: 'accion', accion: 'empezar' });
  // B y C contestan siempre; A nunca
  for (const j of [b, c]) {
    j.ws.on('message', (d) => {
      const m = JSON.parse(String(d));
      if (m.evento === 'turno' && m.datos.nombre === j.respuesta.yo.nombre) j.enviar({ tipo: 'mensaje', texto: 'rojo' });
    });
  }
  const elim = await anfitrion.esperarCualquiera((m) => m.evento === 'jugadorEliminado', 5000, 'eliminación');
  assert.equal(elim.datos.nombre, 'A');
  assert.equal(elim.datos.motivo, 'sinResponder');
  assert.equal(anfitrion.mensajes.filter((m) => m.evento === 'tiempoAgotado').length, 2);
  // el reloj llega con el tiempo restante del turno (no con la hora del servidor)
  const turno = anfitrion.mensajes.find((m) => m.evento === 'turno');
  assert.ok(turno.estado.restanteMs > 0 && turno.estado.restanteMs <= 400);
  await Promise.all([anfitrion, a, b, c].map((x) => x.cerrar()));
});

test('desconexión y reconexión con el mismo dispositivo: recupera su lugar y puntos', async (t) => {
  const app = await levantar({ sacarCarta: mazo([carta(5, 'diamantes')]) });
  t.after(() => app.cerrar());
  const { anfitrion, codigo } = await crearSalaCon(app);
  const ana = await jugador(app, codigo, 'Ana', 'celular-de-ana-123');
  const beto = await jugador(app, codigo, 'Beto');
  anfitrion.enviar({ tipo: 'accion', accion: 'abrirInscripcion' });
  await anfitrion.esperarCualquiera((m) => m.evento === 'inscripcionAbierta');
  await anotarTodos([ana, beto]);
  anfitrion.enviar({ tipo: 'accion', accion: 'empezar' });
  await hasta(() => anfitrion.estado().jugadorActual === 'Ana' && anfitrion.estado().subfase === 'turno');
  ana.enviar({ tipo: 'mensaje', texto: '5 de diamantes' }); // +6
  await hasta(() => anfitrion.estado().jugadores[0].puntos === 6);
  const idAna = ana.respuesta.yo.id;

  await ana.cerrar();
  await hasta(() => anfitrion.estado().sala.personas.find((p) => p.id === idAna).conectado === false, 2000, 'Ana desconectada');
  assert.equal(anfitrion.estado().jugadores[0].clave, idAna); // sigue en la mesa

  const vuelta = await jugador(app, codigo, 'Cualquier nombre', 'celular-de-ana-123');
  assert.equal(vuelta.respuesta.recuperado, true);
  assert.equal(vuelta.respuesta.yo.id, idAna);
  assert.equal(vuelta.respuesta.yo.nombre, 'Ana');
  await hasta(() => anfitrion.estado().sala.personas.find((p) => p.id === idAna).conectado === true);
  assert.equal(anfitrion.estado().jugadores[0].puntos, 6);
  // y puede volver a jugar en su turno
  await hasta(() => anfitrion.estado().jugadorActual === 'Ana' && anfitrion.estado().subfase === 'turno', 3000);
  const p = vuelta.esperar((m) => m.tipo === 'resultado');
  vuelta.enviar({ tipo: 'mensaje', texto: 'rojo' });
  assert.equal((await p).accion, 'prediccion');
  await Promise.all([anfitrion, vuelta, beto].map((x) => x.cerrar()));
});

test('el anfitrión vuelve con su token; nadie más puede manejar la sala', async (t) => {
  const app = await levantar();
  t.after(() => app.cerrar());
  const { anfitrion, codigo, token } = await crearSalaCon(app);
  await anfitrion.cerrar();
  const intruso = await cliente(app);
  let p = intruso.esperar((m) => m.tipo === 'error');
  intruso.enviar({ tipo: 'anfitrion', codigo, token: 'x'.repeat(32) });
  assert.equal((await p).error, 'noAutorizado');
  const jug = await jugador(app, codigo, 'Ana');
  p = jug.esperar((m) => m.tipo === 'error');
  jug.enviar({ tipo: 'accion', accion: 'abrirInscripcion' });
  assert.equal((await p).error, 'noAutorizado');
  const vuelve = await cliente(app);
  p = vuelve.esperar((m) => m.tipo === 'estado');
  vuelve.enviar({ tipo: 'anfitrion', codigo, token });
  assert.equal((await p).estado.sala.codigo, codigo);
  await Promise.all([intruso, jug, vuelve].map((x) => x.cerrar()));
});

test('límite de mensajes: el exceso se rechaza con "limite"', async (t) => {
  const app = await levantar({ mensajesPorSegundo: 3 });
  t.after(() => app.cerrar());
  const { anfitrion, codigo } = await crearSalaCon(app);
  const a = await jugador(app, codigo, 'Ana');
  for (let i = 0; i < 8; i++) a.enviar({ tipo: 'mensaje', texto: 'hola ' + i });
  await hasta(() => a.mensajes.filter((m) => m.tipo === 'resultado').length === 8);
  const acc = a.mensajes.filter((m) => m.tipo === 'resultado').map((m) => m.accion);
  assert.equal(acc.filter((x) => x === 'limite').length, 5);
  await Promise.all([anfitrion, a].map((x) => x.cerrar()));
});

test('textos limpios: nombres con HTML llegan como texto, mensajes cortados a 100', async (t) => {
  const app = await levantar({ sacarCarta: mazo([carta(5, 'diamantes')]) });
  t.after(() => app.cerrar());
  const { anfitrion, codigo } = await crearSalaCon(app);
  const malo = await jugador(app, codigo, '<img src=x onerror=alert(1)>');
  assert.equal(malo.respuesta.yo.nombre, '<img src=x onerror=a'); // 20 caracteres, sin interpretar (se escapa al mostrar)
  const otro = await jugador(app, codigo, 'Beto');
  anfitrion.enviar({ tipo: 'accion', accion: 'abrirInscripcion' });
  await anfitrion.esperarCualquiera((m) => m.evento === 'inscripcionAbierta');
  await anotarTodos([malo, otro]);
  anfitrion.enviar({ tipo: 'accion', accion: 'empezar' });
  await hasta(() => anfitrion.estado().subfase === 'turno');
  malo.enviar({ tipo: 'mensaje', texto: '   rojo   ' + 'a'.repeat(500) });
  const rev = await anfitrion.esperarCualquiera((m) => m.evento === 'revelacion');
  assert.equal(rev.datos.texto.length, 100);
  assert.ok(rev.datos.texto.startsWith('rojo a'));
  await Promise.all([anfitrion, malo, otro].map((x) => x.cerrar()));
});

test('mensajes raros o gigantes no rompen el servidor', async (t) => {
  const app = await levantar();
  t.after(() => app.cerrar());
  const c = await cliente(app);
  c.ws.send('esto no es JSON');
  c.ws.send(JSON.stringify(null));
  c.ws.send(JSON.stringify({ tipo: 'mensaje', texto: 'sin sala' }));
  const cerrado = new Promise((r) => c.ws.once('close', r));
  c.ws.send('x'.repeat(10000)); // supera el máximo de 4 KB: el servidor corta esa conexión
  await cerrado;
  const sano = await cliente(app);
  const p = sano.esperar((m) => m.tipo === 'salaCreada');
  sano.enviar({ tipo: 'crearSala' });
  assert.ok(await p);
  await sano.cerrar();
});

test('expiración: al borrarse la sala, las pantallas reciben "salaCerrada"', async (t) => {
  const app = await levantar();
  t.after(() => app.cerrar());
  const { anfitrion, codigo } = await crearSalaCon(app);
  const a = await jugador(app, codigo, 'Ana');
  const sala = app.gestor.obtener(codigo);
  sala.ultimaActividad -= app.gestor.opciones.inactividadMs; // simula 2 horas sin uso
  app.gestor.limpiarInactivas();
  assert.equal((await a.esperarCualquiera((m) => m.tipo === 'salaCerrada')).motivo, 'inactiva');
  await anfitrion.esperarCualquiera((m) => m.tipo === 'salaCerrada');
  assert.equal(app.gestor.obtener(codigo), null);
});

test('varias salas a la vez, cada una con su partida', async (t) => {
  const app = await levantar();
  t.after(() => app.cerrar());
  const s1 = await crearSalaCon(app);
  const s2 = await crearSalaCon(app);
  assert.notEqual(s1.codigo, s2.codigo);
  s1.anfitrion.enviar({ tipo: 'accion', accion: 'abrirInscripcion' });
  await hasta(() => s1.anfitrion.estado().fase === 'inscripcion');
  assert.equal(s2.anfitrion.estado().fase, 'espera');
  assert.equal(s2.anfitrion.mensajes.some((m) => m.evento === 'inscripcionAbierta'), false);
  await Promise.all([s1.anfitrion.cerrar(), s2.anfitrion.cerrar()]);
});
