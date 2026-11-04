const test = require('node:test');
const assert = require('node:assert/strict');
const { AL10, carta, JOKER_DERECHO, JOKER_CABEZA } = require('./ayuda');

const puntos = (texto, c) => AL10.calcularPuntos(AL10.interpretarPrediccion(texto), c);

const CINCO_DIAMANTES = carta(5, 'diamantes');

test('color acertado: 1 punto', () => {
  assert.equal(puntos('rojo', CINCO_DIAMANTES).puntos, 1);
  assert.equal(puntos('negro', CINCO_DIAMANTES).puntos, 0);
});

test('palo acertado: 2 puntos + 1 del color implícito = 3', () => {
  const r = puntos('diamantes', CINCO_DIAMANTES);
  assert.equal(r.puntos, 3);
  assert.deepEqual(r.aciertos, { color: true, palo: true, numero: null });
});

test('palo errado pero del mismo color: solo 1 (color)', () => {
  const r = puntos('corazones', CINCO_DIAMANTES);
  assert.equal(r.puntos, 1);
  assert.deepEqual(r.aciertos, { color: true, palo: false, numero: null });
});

test('palo errado y de otro color: 0', () => {
  assert.equal(puntos('picas', CINCO_DIAMANTES).puntos, 0);
});

test('número acertado: 3 puntos', () => {
  assert.equal(puntos('5', CINCO_DIAMANTES).puntos, 3);
  assert.equal(puntos('6', CINCO_DIAMANTES).puntos, 0);
});

test('color + número = 4', () => {
  assert.equal(puntos('rojo 5', CINCO_DIAMANTES).puntos, 4);
  assert.equal(puntos('negro 5', CINCO_DIAMANTES).puntos, 3);
  assert.equal(puntos('rojo 6', CINCO_DIAMANTES).puntos, 1);
});

test('color + palo = 3', () => {
  assert.equal(puntos('rojo diamantes', CINCO_DIAMANTES).puntos, 3);
});

test('pleno (color + palo + número) = 6', () => {
  for (const t of ['5 de diamantes', 'cinco diamantes', '5♦', 'rojo 5 de diamantes']) {
    const r = puntos(t, CINCO_DIAMANTES);
    assert.equal(r.puntos, 6, t);
    assert.equal(r.pleno, true, t);
  }
});

test('número acertado y palo errado del mismo color = 4', () => {
  assert.equal(puntos('5 de corazones', CINCO_DIAMANTES).puntos, 4);
});

test('número acertado y palo de otro color = 3', () => {
  assert.equal(puntos('5 de picas', CINCO_DIAMANTES).puntos, 3);
});

test('figuras: rey de picas', () => {
  assert.equal(puntos('rey de picas', carta(13, 'picas')).puntos, 6);
  assert.equal(puntos('rey', carta(13, 'treboles')).puntos, 3);
  assert.equal(puntos('as', carta(1, 'corazones')).puntos, 3);
});

test('solo se puntúa lo anunciado', () => {
  // dice solo "rojo" y sale el 5♦: suma 1 (no se le cuenta el número ni el palo)
  const r = puntos('rojo', CINCO_DIAMANTES);
  assert.equal(r.puntos, 1);
  assert.deepEqual(r.aciertos, { color: true, palo: null, numero: null });
});

test('Joker anunciado + Joker derecho: +10 y gana', () => {
  const r = puntos('joker', JOKER_DERECHO);
  assert.equal(r.puntos, 10);
  assert.equal(r.efecto, 'gana');
});

test('Joker anunciado + Joker de cabeza: -10 y eliminado', () => {
  const r = puntos('joker', JOKER_CABEZA);
  assert.equal(r.puntos, -10);
  assert.equal(r.efecto, 'eliminado');
});

test('no anunció Joker y sale el Joker derecho: +9', () => {
  for (const t of ['rojo', '5 de diamantes', 'picas', '7']) {
    const r = puntos(t, JOKER_DERECHO);
    assert.equal(r.puntos, 9, t);
    assert.equal(r.efecto, null);
    assert.equal(r.jokerSorpresa, true);
  }
});

test('no anunció Joker y sale el Joker de cabeza: -9 (sin eliminación)', () => {
  for (const t of ['rojo', '5 de diamantes', 'picas', '7']) {
    const r = puntos(t, JOKER_CABEZA);
    assert.equal(r.puntos, -9, t);
    assert.equal(r.efecto, null);
    assert.equal(r.jokerSorpresa, true);
  }
});

test('anunció Joker y sale carta normal: 0', () => {
  const r = puntos('joker', CINCO_DIAMANTES);
  assert.equal(r.puntos, 0);
  assert.equal(r.efecto, null);
});
