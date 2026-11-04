const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { levantar } = require('./ayuda-servidor');

function pedir(app, ruta) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: app.puerto, path: ruta, method: 'GET' }, (res) => {
      let cuerpo = '';
      res.on('data', (d) => { cuerpo += d; });
      res.on('end', () => resolve({ estado: res.statusCode, headers: res.headers, cuerpo }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('sirve las páginas y los archivos del juego', async (t) => {
  const app = await levantar();
  t.after(() => app.cerrar());
  const inicio = await pedir(app, '/');
  assert.equal(inicio.estado, 200);
  assert.match(inicio.headers['content-type'], /text\/html/);
  assert.match(inicio.cuerpo, /Adiviná y llegá a/);
  assert.match(inicio.headers['content-security-policy'], /script-src 'self'/);
  assert.equal((await pedir(app, '/jugador.html')).estado, 200);
  assert.equal((await pedir(app, '/js/juego.js')).estado, 200);
  assert.equal((await pedir(app, '/css/jugador.css')).estado, 200);
  assert.equal((await pedir(app, '/js/vendor/qrcode.js')).estado, 200);
  const salud = await pedir(app, '/api/salud');
  const d = JSON.parse(salud.cuerpo);
  assert.equal(d.ok, true);
  assert.equal(d.salas, 0);
  // desde la misma PC informa las direcciones de la wifi (para el link de los celulares)
  assert.ok(Array.isArray(d.direccionesLocales));
  d.direccionesLocales.forEach((x) => assert.match(x, /^http:\/\/\d+\.\d+\.\d+\.\d+:\d+$/));
});

test('no sirve nada fuera de las páginas, css/ y js/', async (t) => {
  const app = await levantar();
  t.after(() => app.cerrar());
  for (const ruta of ['/servidor/app.js', '/conector/config.js', '/.env', '/package.json', '/node_modules/ws/package.json',
    '/js/../package.json', '/js/%2e%2e/package.json', '/js/..%2fpackage.json', '/css/', '/tests/ayuda.js', '/js/.oculto.js', '/README.md']) {
    assert.equal((await pedir(app, ruta)).estado, 404, ruta);
  }
});

test('el link corto /s/ABCD lleva a la pantalla del jugador', async (t) => {
  const app = await levantar();
  t.after(() => app.cerrar());
  const r = await pedir(app, '/s/abcd');
  assert.equal(r.estado, 302);
  assert.equal(r.headers.location, '/jugador.html?sala=ABCD');
  assert.equal((await pedir(app, '/s/ABIO')).estado, 404); // I y O no se usan en los códigos
});
