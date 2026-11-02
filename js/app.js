/*
 * Arranque: arma el juego, la interfaz, el conector de chat y el simulador.
 *
 * Parámetros opcionales en la URL:
 *   ?objetivo=10  puntaje para ganar
 *   ?turno=10     segundos por turno
 *   ?inscripcion=60  segundos de inscripción
 *   ?max=10       jugadores en la mesa
 *   ?espera=0     desactiva la lista de espera
 *   ?dev=0        oculta el simulador (para capturar en OBS)
 */
(function (global) {
  'use strict';
  const AL10 = global.AL10;
  const params = new URLSearchParams(location.search);

  function numero(nombre) {
    const v = parseInt(params.get(nombre), 10);
    return Number.isFinite(v) && v > 0 ? v : undefined;
  }

  const cambios = {};
  if (numero('objetivo')) cambios.puntajeObjetivo = numero('objetivo');
  if (numero('turno')) cambios.segundosTurno = numero('turno');
  if (numero('inscripcion')) cambios.segundosInscripcion = numero('inscripcion');
  if (numero('max')) cambios.maxJugadores = numero('max');
  if (params.get('espera') === '0') cambios.listaDeEspera = false;

  const juego = new AL10.Juego({ config: cambios });
  const onChatMessage = AL10.crearConectorChat(juego);

  // Entrada única del chat: el conector de TikTok solo tiene que llamar a esta función.
  global.onChatMessage = onChatMessage;
  global.juego = juego;

  AL10.crearUI(juego);

  const devActivo = params.get('dev') !== '0';
  if (devActivo) {
    const sim = AL10.crearSimulador(juego, onChatMessage);
    sim.alternar(true);
  } else {
    document.body.classList.add('sin-dev');
  }

  // Escala el escenario 1920x1080 al espacio disponible.
  function escalar() {
    const panel = document.body.classList.contains('dev-abierto') ? document.getElementById('panel-dev').offsetWidth : 0;
    const ancho = window.innerWidth - panel;
    const alto = window.innerHeight;
    const escala = Math.min(ancho / 1920, alto / 1080);
    document.documentElement.style.setProperty('--escala', escala);
    document.documentElement.style.setProperty('--ancho-panel', panel + 'px');
  }
  window.addEventListener('resize', escalar);
  escalar();
})(window);
