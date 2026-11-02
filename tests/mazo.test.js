const test = require('node:test');
const assert = require('node:assert/strict');
const { AL10 } = require('./ayuda');

test('el mazo tiene 54 cartas: 52 + 2 Jokers distintos', () => {
  const m = AL10.crearMazo();
  assert.equal(m.length, 54);
  assert.equal(m.filter((c) => c.tipo === 'normal').length, 52);
  const jokers = m.filter((c) => c.tipo === 'joker').map((c) => c.variante).sort();
  assert.deepEqual(jokers, ['cabeza', 'derecho']);
  assert.equal(new Set(m.map((c) => c.id)).size, 54);
});

test('valores 1 a 13 en los 4 palos', () => {
  const m = AL10.crearMazo().filter((c) => c.tipo === 'normal');
  for (const palo of ['corazones', 'diamantes', 'picas', 'treboles']) {
    const vals = m.filter((c) => c.palo === palo).map((c) => c.valor).sort((a, b) => a - b);
    assert.deepEqual(vals, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  }
});

test('cada extracción usa el mazo completo (las cartas vuelven siempre)', () => {
  const ids = new Set();
  for (let i = 0; i < 20000; i++) ids.add(AL10.sacarCarta().id);
  assert.equal(ids.size, 54); // aparecen todas, incluidos ambos Jokers
});

test('mezclar no pierde ni duplica cartas', () => {
  const m = AL10.mezclar(AL10.crearMazo());
  assert.equal(new Set(m.map((c) => c.id)).size, 54);
});
