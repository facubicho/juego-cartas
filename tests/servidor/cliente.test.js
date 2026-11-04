const test = require('node:test');
const assert = require('node:assert/strict');
const { crearJuegoRemoto } = require('../../js/sala-conexion.js');
const { completarPrediccion } = require('../../js/jugador-rapidos.js');
const AL10 = require('../../servidor/motor');

test('motor remoto: la mesa del anfitrión lee el estado que manda el servidor', () => {
  let t = 1000;
  const acciones = [];
  const r = crearJuegoRemoto((a) => acciones.push(a), () => t);
  const estado = { fase: 'jugando', subfase: 'turno', config: { segundosTurno: 15 }, jugadores: [{ clave: 'j1', nombre: 'Ana', esTurno: true }], espera: [], numeroTurno: 3, restanteMs: 15000 };
  r.actualizar(estado);
  assert.equal(r.fase, 'jugando');
  assert.equal(r.jugadorActual().nombre, 'Ana');
  assert.equal(r.finEn, 16000);
  t = 6000;
  assert.equal(r.estado().finEn - r.reloj.ahora(), 10000); // el reloj sigue corriendo en la pantalla
  const eventos = [];
  r.on((tipo, datos) => eventos.push([tipo, datos.x]));
  r.emitir('turno', { x: 1 });
  assert.deepEqual(eventos, [['turno', 1]]);
  r.abrirInscripcion();
  r.iniciarPartida();
  assert.deepEqual(acciones, ['abrirInscripcion', 'empezar']);
});

test('botones rápidos: completan el texto y el resultado lo entiende el intérprete', () => {
  const casos = [
    ['', 'color', 'rojo', 'rojo'],
    ['5', 'palo', '♦', '5 ♦'],
    ['5 ♦', 'color', 'negro', '5 negro'],
    ['rojo 7', 'palo', '♠', '7 ♠'],
    ['rojo 7', 'palo', '♥', 'rojo 7 ♥'],
    ['5 de diamantes', 'palo', '♣', '5 de ♣'],
    ['rey de picas', 'joker', 'joker', 'joker'],
    ['joker', 'color', 'negro', 'negro']
  ];
  for (const [antes, tipo, valor, despues] of casos) {
    const r = completarPrediccion(antes, tipo, valor);
    assert.equal(r, despues, antes + ' + ' + valor);
    assert.equal(AL10.interpretarPrediccion(r).valida, true, r);
  }
});
