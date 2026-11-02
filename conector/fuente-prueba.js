/*
 * Chat de prueba: usuarios falsos que escriben como si fuera un live de TikTok.
 * Genera eventos con la misma forma que la librería ({ user: { uniqueId, nickname }, comment }).
 *
 *  - Cada 20 segundos, 12 usuarios escriben !jugar (para probar la mesa llena
 *    sin importar cuándo se abra la inscripción; los repetidos el juego los ignora).
 *  - Cuando la página avisa de quién es el turno, ese usuario casi siempre contesta.
 *  - Hay charla de espectadores, textos con espacios de más o muy largos, !cafecito
 *    y ráfagas de muchos mensajes para probar el límite por segundo.
 *  - Con { cortes: true }: el primer intento simula "no está en vivo" y cada tanto se corta.
 */
'use strict';

const USUARIOS = [
  ['juli.gamer', 'Juli ✨'], ['tomi_77', 'Tomi'], ['la.vale', 'Vale 💜'], ['nachito', 'Nacho'],
  ['flor.ok', 'Flor'], ['martu_b', 'Martu'], ['pepe.cartas', 'Pepe 🃏'], ['sofi.live', 'Sofi'],
  ['lean_10', 'Lean'], ['caro.rp', 'Caro'], ['mati.ar', 'Mati'], ['agus_z', 'Agus'],
  ['espectador1', 'Mirón'], ['ruidoso', 'Ruidoso 📢']
];

const PREDICCIONES = [
  'rojo', 'negro', 'picas', 'corazones', 'diamantes', 'tréboles', '5 de diamantes', 'cinco diamantes',
  '5♦', 'rey de picas', 'K♠', 'reina corazones', '7', 'as', 'jota de tréboles', '10♥', 'rojo 3',
  'negro 8', 'joker', 'Q♣', '   rojo   ', 'creo que un 7 negro'
];

const CHARLA = [
  'hola!!', 'jajaja', 'vamos!!', 'qué suerte', 'saludos desde Córdoba', '🔥🔥🔥', 'me encanta',
  'buenas', 'otra partida!', 'dale que sale', 'spam '.repeat(60)
];

function crearFuentePrueba(opciones) {
  const o = opciones || {};
  const alComentario = o.alComentario || function () {};
  const alCorte = o.alCorte || function () {};
  const programar = o.programar || setTimeout;
  const cancelar = o.cancelar || clearTimeout;
  const azar = o.azar || Math.random;
  const cortes = !!o.cortes;

  let timers = [];
  let activo = false;
  let intentos = 0;

  const elegir = (lista) => lista[Math.floor(azar() * lista.length)];
  const evento = (u, texto) => ({ user: { uniqueId: u[0], nickname: u[1] }, comment: texto });

  function despues(ms, fn) {
    const id = programar(() => { timers = timers.filter((t) => t !== id); if (activo) fn(); }, ms);
    timers.push(id);
  }

  function detenerTodo() {
    activo = false;
    timers.forEach((t) => cancelar(t));
    timers = [];
  }

  function charlaContinua() {
    const r = azar();
    const u = elegir(USUARIOS);
    if (r < 0.55) alComentario(evento(u, elegir(PREDICCIONES)));
    else if (r < 0.9) alComentario(evento(u, elegir(CHARLA)));
    else if (r < 0.95) alComentario(evento(u, '!cafecito'));
    else alComentario(evento(u, '!jugar'));
    despues(400 + azar() * 1200, charlaContinua);
  }

  function oleadaJugar() {
    USUARIOS.slice(0, 12).forEach((u, i) => despues(800 + i * 500, () => alComentario(evento(u, '!jugar'))));
    despues(20000, oleadaJugar);
  }

  function rafaga() {
    for (let i = 0; i < 40; i++) alComentario(evento(elegir(USUARIOS), elegir(CHARLA)));
    despues(25000 + azar() * 20000, rafaga);
  }

  return {
    async conectar() {
      intentos++;
      if (cortes && intentos === 1) {
        const err = new Error('El usuario de prueba no está en vivo');
        err.noEnVivo = true;
        throw err;
      }
      detenerTodo();
      activo = true;
      oleadaJugar();
      despues(3000, charlaContinua);
      despues(20000, rafaga);
      if (cortes) despues(45000, () => { detenerTodo(); alCorte({ reason: 'corte simulado' }); });
    },
    async desconectar() { detenerTodo(); },
    /** La página avisó de quién es el turno: casi siempre contesta (a veces no, para probar el reloj). */
    alTurno(usuario) {
      const u = USUARIOS.find((x) => x[0].toLowerCase() === String(usuario).toLowerCase());
      if (!u || !activo || azar() < 0.15) return;
      despues(1500 + azar() * 4500, () => alComentario(evento(u, elegir(PREDICCIONES))));
    }
  };
}

module.exports = { crearFuentePrueba, USUARIOS };
