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
 *   ?cafecito=0   oculta el cartel de Cafecito (y desactiva !cafecito)
 *   ?chat=ws://localhost:8080   recibe el chat de TikTok desde el conector (también acepta ?chat=8080)
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
  if (params.get('cafecito') === '0') cambios.cafecito = { activo: false };

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

  // Chat real (TikTok LIVE) a través del conector local: solo si se pidió con ?chat=...
  const urlChat = params.has('chat') ? AL10.normalizarUrlChat(params.get('chat')) : null;
  if (params.has('chat') && !urlChat) {
    console.warn('Parámetro ?chat inválido. Usá por ejemplo ?chat=ws://localhost:8080');
  }
  if (urlChat) {
    const indicador = document.getElementById('indicador-chat');
    indicador.hidden = !devActivo; // el indicador solo se ve con el simulador activo
    const TEXTOS = {
      conectado: 'conectado',
      conectando: 'conectando…',
      noEnVivo: 'no está en vivo',
      reconectando: 'reconectando…'
    };
    const cliente = AL10.crearClienteChat({
      url: urlChat,
      onChatMessage: onChatMessage,
      alEstado: (e) => {
        let texto, clase;
        if (e.servidor !== 'conectado') {
          texto = 'Chat: desconectado (¿está abierto el conector?)';
          clase = 'mal';
        } else {
          const t = e.tiktok || 'conectando';
          texto = 'Chat ' + (e.usuario ? (e.usuario === 'chat de prueba' ? 'de prueba' : '@' + e.usuario) : '') + ': ' + (TEXTOS[t] || t);
          clase = t === 'conectado' ? 'ok' : 'medio';
        }
        indicador.textContent = texto;
        indicador.className = 'indicador-chat ' + clase;
      }
    });
    // Avisa al conector de quién es el turno: ese jugador nunca se descarta por el límite de mensajes.
    const avisarTurno = () => {
      const actual = juego.jugadorActual();
      cliente.enviar({ tipo: 'turno', usuario: actual && juego.subfase === 'turno' ? actual.clave : null });
    };
    juego.on((tipo) => { if (tipo === 'turno' || tipo === 'revelacion' || tipo === 'tiempoAgotado' || tipo === 'partidaTerminada') avisarTurno(); });
    global.clienteChat = cliente;
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
