const test = require('node:test');
const assert = require('node:assert/strict');
const { limpiarTexto, extraerComentario } = require('../../conector/limpieza');

test('recorta espacios y junta los repetidos', () => {
  assert.equal(limpiarTexto('   5   de    diamantes  '), '5 de diamantes');
  assert.equal(limpiarTexto('\trojo\n'), 'rojo');
});

test('limita el largo a 100 caracteres por defecto', () => {
  const largo = 'a'.repeat(300);
  assert.equal(limpiarTexto(largo).length, 100);
  assert.equal(limpiarTexto(largo, 20).length, 20);
});

test('cuenta caracteres, no bytes (emojis y símbolos enteros)', () => {
  const s = limpiarTexto('♦'.repeat(150));
  assert.equal(Array.from(s).length, 100);
  assert.equal(limpiarTexto('🔥🔥🔥', 2), '🔥🔥');
});

test('quita caracteres invisibles y de control', () => {
  assert.equal(limpiarTexto('ro\u200Bjo'), 'ro jo');
  assert.equal(limpiarTexto('\u202Erojo\u0007'), 'rojo');
  assert.equal(limpiarTexto('\uFEFF!jugar'), '!jugar');
});

test('textos vacíos o que no son texto quedan vacíos', () => {
  assert.equal(limpiarTexto('     '), '');
  assert.equal(limpiarTexto(undefined), '');
  assert.equal(limpiarTexto(123), '');
  assert.equal(limpiarTexto({}), '');
});

const ev = (uniqueId, nickname, comment) => ({ user: { uniqueId, nickname }, comment });

test('extrae usuario único, apodo y texto (formato de la librería v2)', () => {
  assert.deepEqual(extraerComentario(ev('ana_123', 'Ana ✨', '  5♦  '), { mostrar: 'apodo' }),
    { usuario: 'ana_123', nombre: 'Ana ✨', texto: '5♦' });
});

test('mostrar "usuario" usa el nombre de usuario único en pantalla', () => {
  assert.equal(extraerComentario(ev('ana_123', 'Ana', 'rojo'), { mostrar: 'usuario' }).nombre, 'ana_123');
});

test('si no hay apodo se muestra el usuario', () => {
  assert.equal(extraerComentario(ev('ana_123', '   ', 'rojo'), { mostrar: 'apodo' }).nombre, 'ana_123');
});

test('acepta el formato viejo de la librería (uniqueId en el evento)', () => {
  assert.deepEqual(extraerComentario({ uniqueId: 'beto', nickname: 'Beto', comment: 'picas' }),
    { usuario: 'beto', nombre: 'Beto', texto: 'picas' });
});

test('limita el largo del comentario y del apodo', () => {
  const c = extraerComentario(ev('x', 'N'.repeat(80), 'z'.repeat(500)), { largoMaximo: 100 });
  assert.equal(c.texto.length, 100);
  assert.equal(c.nombre.length, 30);
});

test('descarta eventos sin usuario, sin texto o que no son comentarios', () => {
  assert.equal(extraerComentario(ev('', 'Ana', 'rojo')), null);
  assert.equal(extraerComentario(ev('ana', 'Ana', '   ')), null);
  assert.equal(extraerComentario({ user: { uniqueId: 'ana' }, giftId: 5 }), null); // un regalo
  assert.equal(extraerComentario(null), null);
  assert.equal(extraerComentario('hola'), null);
});
