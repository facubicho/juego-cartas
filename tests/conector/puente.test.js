const test = require('node:test');
const assert = require('node:assert/strict');
const { crearPuente } = require('../../conector/puente');
const { crearLimitador } = require('../../conector/limitador');

const ev = (uniqueId, nickname, comment) => ({ user: { uniqueId, nickname }, comment });

function armar(opciones) {
  const enviados = [];
  const descartados = [];
  let t = 0;
  const limitador = crearLimitador({ maxPorSegundo: (opciones && opciones.max) || 3, ahora: () => t });
  const puente = crearPuente(Object.assign({
    enviar: (m) => enviados.push(m), limitador, alDescartar: (c) => descartados.push(c), mostrar: 'apodo', largoMaximo: 100
  }, opciones));
  return { puente, enviados, descartados, avanzar: (ms) => { t += ms; } };
}

test('reenvía cada comentario limpio al juego', () => {
  const { puente, enviados } = armar();
  puente.procesar(ev('ana_1', 'Ana', '   5   de diamantes '));
  assert.deepEqual(enviados, [{ tipo: 'chat', usuario: 'ana_1', nombre: 'Ana', texto: '5 de diamantes' }]);
});

test('respeta la opción de mostrar el usuario en vez del apodo', () => {
  const { puente, enviados } = armar({ mostrar: 'usuario' });
  puente.procesar(ev('ana_1', 'Ana', 'rojo'));
  assert.equal(enviados[0].nombre, 'ana_1');
});

test('ignora lo que no es comentario de texto', () => {
  const { puente, enviados } = armar();
  assert.equal(puente.procesar({ user: { uniqueId: 'a' }, giftId: 1 }), null);
  assert.equal(puente.procesar(ev('a', 'A', '   ')), null);
  assert.equal(enviados.length, 0);
});

test('descarta el exceso de mensajes por segundo', () => {
  const { puente, enviados, descartados, avanzar } = armar({ max: 3 });
  for (let i = 0; i < 10; i++) puente.procesar(ev('u' + i, 'U', 'hola'));
  assert.equal(enviados.length, 3);
  assert.equal(descartados.length, 7);
  avanzar(1000);
  puente.procesar(ev('x', 'X', 'rojo'));
  assert.equal(enviados.length, 4);
});

test('el jugador del turno nunca se descarta aunque el chat esté saturado', () => {
  const { puente, enviados } = armar({ max: 2 });
  puente.marcarTurno('Ana_1'); // sin importar mayúsculas
  for (let i = 0; i < 10; i++) puente.procesar(ev('u' + i, 'U', 'spam'));
  puente.procesar(ev('ana_1', 'Ana', 'rey de picas'));
  assert.equal(enviados.at(-1).texto, 'rey de picas');
  puente.marcarTurno(null);
  puente.procesar(ev('ana_1', 'Ana', 'otra'));
  assert.equal(enviados.at(-1).texto, 'rey de picas');
});
