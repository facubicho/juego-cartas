const test = require('node:test');
const assert = require('node:assert/strict');
const { crearReconectador } = require('../../conector/reconexion');

/** Temporizador falso: guarda lo programado y lo ejecuta a pedido. */
function relojFalso() {
  const pendientes = [];
  return {
    programar: (fn, ms) => { const t = { fn, ms }; pendientes.push(t); return t; },
    cancelar: (t) => { const i = pendientes.indexOf(t); if (i >= 0) pendientes.splice(i, 1); },
    pendientes,
    async correr() { const t = pendientes.shift(); t.fn(); await new Promise((r) => setImmediate(r)); }
  };
}
const esperar = () => new Promise((r) => setImmediate(r));

test('si conecta a la primera, no programa reintentos', async () => {
  const r = relojFalso();
  let conectados = 0;
  const rec = crearReconectador({ conectar: async () => {}, alConectar: () => conectados++, programar: r.programar, cancelar: r.cancelar });
  await rec.iniciar();
  assert.equal(conectados, 1);
  assert.equal(r.pendientes.length, 0);
});

test('reintenta con espera creciente (2 s, 4 s, 8 s...) hasta el máximo', async () => {
  const r = relojFalso();
  const esperas = [];
  const rec = crearReconectador({
    conectar: async () => { throw new Error('sin red'); },
    esperaInicialMs: 2000, esperaMaxMs: 20000,
    alEsperar: (i) => esperas.push(i.ms),
    programar: r.programar, cancelar: r.cancelar
  });
  await rec.iniciar();
  for (let i = 0; i < 5; i++) await r.correr();
  assert.deepEqual(esperas, [2000, 4000, 8000, 16000, 20000, 20000]);
});

test('al conectar se reinicia la espera', async () => {
  const r = relojFalso();
  const esperas = [];
  let fallar = 2;
  const rec = crearReconectador({
    conectar: async () => { if (fallar-- > 0) throw new Error('x'); },
    alEsperar: (i) => esperas.push(i.ms),
    programar: r.programar, cancelar: r.cancelar
  });
  await rec.iniciar();     // falla -> 2 s
  await r.correr();        // falla -> 4 s
  await r.correr();        // conecta
  assert.equal(rec.fallos, 0);
  rec.seCorto();           // se corta -> arranca de nuevo en 2 s
  assert.deepEqual(esperas, [2000, 4000, 2000]);
});

test('si se corta la conexión, vuelve a conectar solo', async () => {
  const r = relojFalso();
  let conexiones = 0;
  const rec = crearReconectador({ conectar: async () => { conexiones++; }, programar: r.programar, cancelar: r.cancelar });
  await rec.iniciar();
  rec.seCorto('corte');
  assert.equal(r.pendientes.length, 1);
  await r.correr();
  assert.equal(conexiones, 2);
});

test('si el usuario no está en vivo, reintenta cada tanto con espera fija', async () => {
  const r = relojFalso();
  const avisos = [];
  const rec = crearReconectador({
    conectar: async () => { const e = new Error('offline'); e.noEnVivo = true; throw e; },
    esperaNoEnVivoMs: 30000,
    alEsperar: (i) => avisos.push(i),
    programar: r.programar, cancelar: r.cancelar
  });
  await rec.iniciar();
  await r.correr();
  await r.correr();
  assert.deepEqual(avisos.map((a) => a.ms), [30000, 30000, 30000]);
  assert.ok(avisos.every((a) => a.noEnVivo));
});

test('no programa dos reintentos a la vez', async () => {
  const r = relojFalso();
  const rec = crearReconectador({ conectar: async () => {}, programar: r.programar, cancelar: r.cancelar });
  await rec.iniciar();
  rec.seCorto(); rec.seCorto(); rec.seCorto();
  assert.equal(r.pendientes.length, 1);
});

test('detener cancela los reintentos pendientes', async () => {
  const r = relojFalso();
  const rec = crearReconectador({ conectar: async () => { throw new Error('x'); }, programar: r.programar, cancelar: r.cancelar });
  await rec.iniciar();
  assert.equal(r.pendientes.length, 1);
  rec.detener();
  assert.equal(r.pendientes.length, 0);
  rec.seCorto();
  assert.equal(r.pendientes.length, 0);
  await esperar();
});
