// Utilidades compartidas por los tests: carga los módulos y provee un reloj falso.
require('../js/config.js');
require('../js/mazo.js');
require('../js/interprete.js');
require('../js/puntuacion.js');
require('../js/juego.js');
require('../js/chat.js');

const AL10 = globalThis.AL10;

function crearRelojFalso() {
  let t = 0;
  let id = 0;
  let timers = [];
  return {
    ahora: () => t,
    setTimeout(fn, ms) { timers.push({ id: ++id, en: t + ms, fn }); return id; },
    clearTimeout(i) { timers = timers.filter((x) => x.id !== i); },
    avanzar(ms) {
      const fin = t + ms;
      for (;;) {
        timers.sort((a, b) => a.en - b.en);
        const sig = timers[0];
        if (!sig || sig.en > fin) break;
        timers.shift();
        t = sig.en;
        sig.fn();
      }
      t = fin;
    },
    pendientes: () => timers.length
  };
}

const carta = (valor, palo) => ({
  tipo: 'normal', valor, palo,
  color: palo === 'corazones' || palo === 'diamantes' ? 'rojo' : 'negro'
});
const JOKER_DERECHO = { tipo: 'joker', variante: 'derecho' };
const JOKER_CABEZA = { tipo: 'joker', variante: 'cabeza' };

/** Juego con reloj falso y cartas predefinidas (cola). */
function crearJuego(opciones) {
  const o = opciones || {};
  const reloj = crearRelojFalso();
  const cola = (o.cartas || []).slice();
  const juego = new AL10.Juego({
    config: o.config,
    reloj,
    sacarCarta: () => (cola.length ? cola.shift() : carta(2, 'treboles'))
  });
  const eventos = [];
  juego.on((tipo, datos) => eventos.push({ tipo, datos }));
  return { juego, reloj, cola, eventos, ponerCartas: (...cs) => cola.push(...cs) };
}

/** Abre inscripción, anota a los nombres y arranca la partida. */
function partidaCon(nombres, opciones) {
  const ctx = crearJuego(opciones);
  ctx.juego.abrirInscripcion();
  nombres.forEach((n) => ctx.juego.recibirMensaje(n, '!jugar'));
  ctx.juego.iniciarPartida();
  return ctx;
}

module.exports = { AL10, crearRelojFalso, crearJuego, partidaCon, carta, JOKER_DERECHO, JOKER_CABEZA };
