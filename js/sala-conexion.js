/*
 * Conexión de una pantalla (anfitrión o jugador) con el servidor de salas, por WebSocket.
 * Si se corta (wifi, celular bloqueado), reintenta sola con espera creciente.
 * Cada vez que (re)conecta llama a alAbrir(enviar) para volver a entrar a la sala.
 */
(function (global) {
  'use strict';
  const AL10 = (global.AL10 = global.AL10 || {});

  function urlServidorSalas(loc) {
    const l = loc || global.location;
    return (l.protocol === 'https:' ? 'wss://' : 'ws://') + l.host + '/ws';
  }

  function crearConexionSala(opciones) {
    const o = opciones || {};
    const WS = o.WebSocketImpl || global.WebSocket;
    const programar = o.programar || setTimeout;
    const esperaInicialMs = o.esperaInicialMs || 800;
    const esperaMaxMs = o.esperaMaxMs || 8000;
    const alAbrir = o.alAbrir || function () {};
    const alMensaje = o.alMensaje || function () {};
    const alCambio = o.alCambio || function () {};

    let ws = null;
    let espera = esperaInicialMs;
    let cerrado = false;
    let conectado = false;

    function enviar(obj) {
      if (ws && ws.readyState === 1) { ws.send(JSON.stringify(obj)); return true; }
      return false;
    }

    function conectar() {
      if (cerrado) return;
      try { ws = new WS(o.url); } catch (e) { reintentar(); return; }
      ws.onopen = () => {
        espera = esperaInicialMs;
        conectado = true;
        alCambio(true);
        alAbrir(enviar);
      };
      ws.onmessage = (ev) => {
        let m;
        try { m = JSON.parse(String(ev.data)); } catch (e) { return; }
        if (m && typeof m === 'object') alMensaje(m, enviar);
      };
      ws.onclose = () => {
        if (conectado) alCambio(false);
        conectado = false;
        reintentar();
      };
      ws.onerror = () => {};
    }

    function reintentar() {
      if (cerrado) return;
      programar(conectar, espera);
      espera = Math.min(espera * 2, esperaMaxMs);
    }

    conectar();
    return {
      enviar,
      get conectado() { return conectado; },
      cerrar() { cerrado = true; if (ws) ws.close(); }
    };
  }

  /**
   * "Motor remoto": imita lo que la interfaz (js/ui.js) usa del motor del juego,
   * pero con el estado que manda el servidor. Así la mesa del anfitrión se dibuja igual que siempre.
   */
  function crearJuegoRemoto(enviarAccion, ahora) {
    const reloj = { ahora: ahora || (() => Date.now()) };
    const oyentes = [];
    let est = null;
    let recibidoEn = 0;

    const remoto = {
      config: null,
      reloj,
      on(fn) { oyentes.push(fn); },
      actualizar(estado) {
        est = estado;
        recibidoEn = reloj.ahora();
        if (!remoto.config) remoto.config = estado.config;
      },
      emitir(tipo, datos) { oyentes.forEach((fn) => { try { fn(tipo, datos || {}, remoto); } catch (e) { console.error(e); } }); },
      get listo() { return !!est; },
      get fase() { return est ? est.fase : 'espera'; },
      get subfase() { return est ? est.subfase : null; },
      get numeroTurno() { return est ? est.numeroTurno : 0; },
      get jugadores() { return est ? est.jugadores : []; },
      get espera() { return est ? est.espera : []; },
      get finEn() { return est && est.restanteMs ? recibidoEn + est.restanteMs : null; },
      jugadorActual() { return (est && est.jugadores.find((j) => j.esTurno)) || null; },
      estado() { return Object.assign({}, est, { finEn: remoto.finEn, ahora: reloj.ahora() }); },
      abrirInscripcion() { enviarAccion('abrirInscripcion'); },
      iniciarPartida() { enviarAccion('empezar'); }
    };
    return remoto;
  }

  AL10.urlServidorSalas = urlServidorSalas;
  AL10.crearConexionSala = crearConexionSala;
  AL10.crearJuegoRemoto = crearJuegoRemoto;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { urlServidorSalas, crearConexionSala, crearJuegoRemoto };
  }
})(typeof window !== 'undefined' ? window : globalThis);
