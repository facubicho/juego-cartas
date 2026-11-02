const test = require('node:test');
const assert = require('node:assert/strict');
const { leerEnv, cargarConfig, normalizarUsuario } = require('../../conector/config');

test('lee el archivo .env (comentarios, comillas, espacios)', () => {
  const r = leerEnv('# comentario\nTIKTOK_USUARIO=mi_usuario\n  PUERTO = 9000  \nMOSTRAR_NOMBRE="usuario" # al final\n\nmal\n');
  assert.deepEqual(r, { TIKTOK_USUARIO: 'mi_usuario', PUERTO: '9000', MOSTRAR_NOMBRE: 'usuario' });
});

test('valores por defecto', () => {
  const c = cargarConfig({ textoEnv: '', env: {}, argv: [] });
  assert.deepEqual(c, { usuario: '', puerto: 8080, mostrar: 'apodo', maxPorSegundo: 15, largoMaximo: 100, prueba: false, cortes: false });
});

test('prioridad: línea de comandos > variables de entorno > archivo .env', () => {
  const textoEnv = 'TIKTOK_USUARIO=del_archivo\nPUERTO=8081';
  assert.equal(cargarConfig({ textoEnv, env: {}, argv: [] }).usuario, 'del_archivo');
  assert.equal(cargarConfig({ textoEnv, env: { TIKTOK_USUARIO: 'del_entorno' }, argv: [] }).usuario, 'del_entorno');
  assert.equal(cargarConfig({ textoEnv, env: { TIKTOK_USUARIO: 'del_entorno' }, argv: ['--usuario=de_comando'] }).usuario, 'de_comando');
  assert.equal(cargarConfig({ textoEnv, env: {}, argv: ['--prueba'] }).prueba, true);
});

test('acepta @usuario o la dirección del live', () => {
  assert.equal(normalizarUsuario('@mi.usuario'), 'mi.usuario');
  assert.equal(normalizarUsuario('https://www.tiktok.com/@mi_usuario/live'), 'mi_usuario');
  assert.equal(normalizarUsuario('con espacios'), '');
});

test('valores raros vuelven a algo razonable', () => {
  const c = cargarConfig({ textoEnv: 'PUERTO=abc\nMOSTRAR_NOMBRE=cualquiera\nMAX_MENSAJES_POR_SEGUNDO=0', env: {}, argv: [] });
  assert.equal(c.puerto, 8080);
  assert.equal(c.mostrar, 'apodo');
  assert.equal(c.maxPorSegundo, 1);
});
