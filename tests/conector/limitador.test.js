const test = require('node:test');
const assert = require('node:assert/strict');
const { crearLimitador } = require('../../conector/limitador');

function reloj() {
  let t = 0;
  return { ahora: () => t, avanzar: (ms) => { t += ms; } };
}

test('deja pasar hasta el máximo por segundo y descarta el exceso', () => {
  const r = reloj();
  const l = crearLimitador({ maxPorSegundo: 5, ahora: r.ahora });
  const resultados = Array.from({ length: 8 }, () => l.permitir());
  assert.deepEqual(resultados, [true, true, true, true, true, false, false, false]);
  assert.equal(l.tomarDescartados(), 3);
  assert.equal(l.tomarDescartados(), 0);
});

test('al pasar un segundo vuelve a dejar pasar', () => {
  const r = reloj();
  const l = crearLimitador({ maxPorSegundo: 2, ahora: r.ahora });
  l.permitir(); l.permitir();
  assert.equal(l.permitir(), false);
  r.avanzar(999);
  assert.equal(l.permitir(), false);
  r.avanzar(1);
  assert.equal(l.permitir(), true);
});

test('es una ventana deslizante (no se resetea de golpe)', () => {
  const r = reloj();
  const l = crearLimitador({ maxPorSegundo: 2, ahora: r.ahora });
  l.permitir();          // t=0
  r.avanzar(600);
  l.permitir();          // t=600
  r.avanzar(500);        // t=1100: venció el de t=0
  assert.equal(l.permitir(), true);
  assert.equal(l.permitir(), false); // el de t=600 sigue contando
});

test('ráfaga de 1000 mensajes en un segundo: solo pasa el máximo', () => {
  const r = reloj();
  const l = crearLimitador({ maxPorSegundo: 15, ahora: r.ahora });
  let pasaron = 0;
  for (let i = 0; i < 1000; i++) if (l.permitir()) pasaron++;
  assert.equal(pasaron, 15);
});
