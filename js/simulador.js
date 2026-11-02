/*
 * Simulador de chat para probar el juego sin estar en vivo.
 * Todo lo que envía pasa por onChatMessage(usuario, texto), igual que el chat real.
 */
(function (global) {
  'use strict';
  const AL10 = (global.AL10 = global.AL10 || {});
  const $ = (id) => document.getElementById(id);

  const NOMBRES_SIM = [
    'ana', 'bruno', 'carla', 'diego', 'eli', 'facu', 'gabi', 'hugo',
    'ines', 'juan', 'kari', 'lucho', 'meli', 'nico', 'oli'
  ];

  const PREDICCIONES = [
    'rojo', 'negro', 'picas', 'corazones', 'diamantes', 'tréboles',
    '5 de diamantes', 'cinco diamantes', '5♦', 'rey de picas', 'K♠', 'reina corazones',
    '7', 'as', 'jota de tréboles', '10♥', 'rojo 3', 'negro 8', 'joker', 'Q♣', '2 de picas'
  ];

  function crearSimulador(juego, onChatMessage) {
    const panel = $('panel-dev');
    const inputUsuario = $('sim-usuario');
    const inputMensaje = $('sim-mensaje');
    let botsActivos = false;
    let usuariosConocidos = [];

    function enviar(usuario, texto) {
      if (!usuario || !texto) return;
      onChatMessage(usuario, texto);
    }

    function enviarDelFormulario() {
      enviar(inputUsuario.value.trim(), inputMensaje.value.trim());
      inputMensaje.value = '';
      inputMensaje.focus();
    }

    function simularUsuarios(cantidad) {
      if (juego.fase !== 'inscripcion') juego.abrirInscripcion();
      NOMBRES_SIM.slice(0, cantidad).forEach((n, i) => {
        setTimeout(() => enviar(n, '!jugar'), i * 150);
      });
    }

    function aleatorio(lista) { return lista[Math.floor(Math.random() * lista.length)]; }

    function jugadaDelTurno(texto) {
      const actual = juego.jugadorActual();
      if (!actual || juego.subfase !== 'turno') return;
      enviar(actual.nombre, texto || aleatorio(PREDICCIONES));
    }

    // Registro de chat del simulador
    onChatMessage.escuchar(function (usuario, texto, resultado) {
      const cont = $('sim-chat');
      const div = document.createElement('div');
      const acc = resultado && resultado.accion;
      div.className = 'sim-msg ' + (acc === 'ignorado' ? 'ignorado' : acc === 'invalida' ? 'invalida' : 'tomado');
      div.innerHTML = '<b></b> <span></span> <em></em>';
      div.children[0].textContent = '@' + usuario + ':';
      div.children[1].textContent = texto;
      div.children[2].textContent = '(' + (acc || '') + ')';
      cont.prepend(div);
      while (cont.children.length > 60) cont.lastChild.remove();
      if (usuariosConocidos.indexOf(usuario) < 0) usuariosConocidos.push(usuario);
      dibujarUsuarios();
    });

    function dibujarUsuarios() {
      const actual = juego.jugadorActual();
      const enMesa = juego.jugadores.map((j) => j.nombre);
      const nombres = Array.from(new Set(enMesa.concat(juego.espera, usuariosConocidos)));
      const cont = $('sim-usuarios');
      cont.innerHTML = '';
      nombres.forEach((n) => {
        const b = document.createElement('button');
        b.className = 'sim-usuario' + (actual && actual.nombre === n ? ' turno' : '') + (enMesa.indexOf(n) >= 0 ? ' en-mesa' : '');
        b.textContent = n;
        b.addEventListener('click', () => { inputUsuario.value = n; inputMensaje.focus(); });
        cont.appendChild(b);
      });
    }

    // Bots: cuando le toca a alguien, responde solo (a veces no contesta, para probar el reloj)
    juego.on(function (tipo, datos) {
      dibujarUsuarios();
      if (tipo === 'turno') {
        // el usuario del turno queda preseleccionado en el formulario
        inputUsuario.value = datos.nombre;
        if (botsActivos) {
          const numeroTurno = datos.numeroTurno;
          if (Math.random() < 0.15) return; // no contesta
          const demora = 1000 + Math.random() * (juego.config.segundosTurno * 1000 - 2500);
          setTimeout(() => {
            if (juego.numeroTurno !== numeroTurno) return;
            jugadaDelTurno();
          }, Math.max(500, demora));
        }
      }
    });

    $('sim-enviar').addEventListener('click', enviarDelFormulario);
    inputMensaje.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') enviarDelFormulario(); });
    $('sim-abrir').addEventListener('click', () => juego.abrirInscripcion());
    $('sim-12').addEventListener('click', () => simularUsuarios(12));
    $('sim-3').addEventListener('click', () => simularUsuarios(3));
    $('sim-empezar').addEventListener('click', () => juego.iniciarPartida());
    $('sim-aleatoria').addEventListener('click', () => jugadaDelTurno());
    $('sim-joker').addEventListener('click', () => jugadaDelTurno('joker'));
    $('sim-bots').addEventListener('change', (ev) => { botsActivos = ev.target.checked; });

    function alternar(mostrar) {
      const abierto = typeof mostrar === 'boolean' ? mostrar : !panel.classList.contains('abierto');
      panel.classList.toggle('abierto', abierto);
      document.body.classList.toggle('dev-abierto', abierto);
      window.dispatchEvent(new Event('resize'));
    }
    $('btn-dev').addEventListener('click', () => alternar());
    document.addEventListener('keydown', (ev) => {
      const t = ev.target.tagName;
      if ((ev.key === 'd' || ev.key === 'D') && t !== 'INPUT' && t !== 'TEXTAREA') alternar();
    });

    dibujarUsuarios();
    return { alternar: alternar, enviar: enviar, simularUsuarios: simularUsuarios };
  }

  AL10.crearSimulador = crearSimulador;
})(typeof window !== 'undefined' ? window : globalThis);
