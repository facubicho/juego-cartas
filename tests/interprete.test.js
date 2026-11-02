const test = require('node:test');
const assert = require('node:assert/strict');
const { AL10 } = require('./ayuda');

const p = (t) => AL10.interpretarPrediccion(t);

function esperar(texto, { numero = null, palo = null, color = null, joker = false } = {}) {
  const r = p(texto);
  assert.equal(r.valida, true, `"${texto}" debería ser válida (${r.motivo})`);
  assert.equal(r.numero, numero, `número de "${texto}"`);
  assert.equal(r.palo, palo, `palo de "${texto}"`);
  assert.equal(r.color, color, `color de "${texto}"`);
  assert.equal(r.joker, joker, `joker de "${texto}"`);
}

test('"5 de diamantes", "cinco diamantes" y "5♦" significan lo mismo', () => {
  for (const t of ['5 de diamantes', 'cinco diamantes', '5♦', '5♦️', '5 DIAMANTES', 'Cinco de Diamantes']) {
    esperar(t, { numero: 5, palo: 'diamantes', color: 'rojo' });
  }
});

test('"rey picas" y variantes de figuras', () => {
  esperar('rey picas', { numero: 13, palo: 'picas', color: 'negro' });
  esperar('rey de picas', { numero: 13, palo: 'picas', color: 'negro' });
  esperar('K♠', { numero: 13, palo: 'picas', color: 'negro' });
  esperar('reina de corazones', { numero: 12, palo: 'corazones', color: 'rojo' });
  esperar('q♥', { numero: 12, palo: 'corazones', color: 'rojo' });
  esperar('jota de tréboles', { numero: 11, palo: 'treboles', color: 'negro' });
  esperar('J trebol', { numero: 11, palo: 'treboles', color: 'negro' });
  esperar('as', { numero: 1 });
  esperar('AS de corazones', { numero: 1, palo: 'corazones', color: 'rojo' });
  esperar('10♣', { numero: 10, palo: 'treboles', color: 'negro' });
  esperar('diez', { numero: 10 });
});

test('solo color, solo palo, solo número', () => {
  esperar('rojo', { color: 'rojo' });
  esperar('NEGRO', { color: 'negro' });
  esperar('picas', { palo: 'picas', color: 'negro' });
  esperar('♥', { palo: 'corazones', color: 'rojo' });
  esperar('tréboles', { palo: 'treboles', color: 'negro' });
  esperar('treboles', { palo: 'treboles', color: 'negro' });
  esperar('7', { numero: 7 });
  esperar('siete', { numero: 7 });
});

test('combinaciones de color y número', () => {
  esperar('rojo 7', { numero: 7, color: 'rojo' });
  esperar('creo que un 3 negro', { numero: 3, color: 'negro' });
});

test('el palo implica el color (colorPorPalo)', () => {
  assert.equal(p('picas').colorPorPalo, true);
  assert.equal(p('negro picas').colorPorPalo, false);
  assert.equal(p('rojo').colorPorPalo, false);
});

test('"joker" y sinónimos', () => {
  esperar('joker', { joker: true });
  esperar('JOKER!!', { joker: true });
  esperar('comodín', { joker: true });
});

test('predicciones inválidas o ambiguas se rechazan', () => {
  assert.equal(p('hola').valida, false);
  assert.equal(p('').valida, false);
  assert.equal(p('!jugar').valida, false);
  assert.equal(p('5 o 6').motivo, 'ambigua');
  assert.equal(p('picas o corazones').motivo, 'ambigua');
  assert.equal(p('rojo negro').motivo, 'ambigua');
  assert.equal(p('rojo picas').motivo, 'contradictoria');
  assert.equal(p('joker rojo').motivo, 'ambigua');
  assert.equal(p('15').motivo, 'fueraDeRango');
  assert.equal(p('0').motivo, 'fueraDeRango');
});
