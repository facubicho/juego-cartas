/*
 * Cliente del conector de chat (se activa abriendo el juego con ?chat=ws://localhost:8080).
 * Recibe los comentarios del live por WebSocket y los pasa a onChatMessage(usuario, texto, nombre),
 * igual que el simulador. Si el conector se cierra, reintenta conectarse solo.
 *
 * Mensajes que recibe:  { tipo: 'chat', usuario, nombre, texto }
 *                       { tipo: 'estado', tiktok: 'conectando'|'conectado'|'noEnVivo'|'reconectando', usuario }
 * Mensajes que envía:   { tipo: 'turno', usuario }  (para que el jugador del turno nunca se descarte)
 */
(function (global) {
  'use strict';
  const AL10 = (global.AL10 = global.AL10 || {});

  /** Acepta "ws://host:puerto", "wss://..." o solo un número de puerto. */
  function normalizarUrlChat(valor) {
    const v = String(valor || '').trim();
    if (/^\d{1,5}$/.test(v)) return 'ws://localhost:' + v;
    if (/^wss?:\/\/[^\s]+$/i.test(v)) return v;
    return null;
  }

  function crearClienteChat(opciones) {
    const o = opciones || {};
    const WS = o.WebSocketImpl || global.WebSocket;
    const onChatMessage = o.onChatMessage;
    const alEstado = o.alEstado || function () {};
    const programar = o.programar || setTimeout;
    const cancelar = o.cancelar || clearTimeout;
    const esperaInicialMs = o.esperaInicialMs || 1000;
    const esperaMaxMs = o.esperaMaxMs || 15000;

    let ws = null;
    let espera = esperaInicialMs;
    let timer = null;
    let cerrado = false;
    const estado = { servidor: 'desconectado', tiktok: null, usuario: null };

    function avisar() { alEstado(Object.assign({}, estado)); }

    function manejar(datos) {
      let m;
      try { m = JSON.parse(String(datos)); } catch (e) { return; }
      if (!m || typeof m !== 'object') return;
      if (m.tipo === 'chat' && typeof m.usuario === 'string' && typeof m.texto === 'string') {
        onChatMessage(m.usuario, m.texto, typeof m.nombre === 'string' ? m.nombre : undefined);
      } else if (m.tipo === 'estado') {
        estado.tiktok = m.tiktok || null;
        estado.usuario = m.usuario || null;
        avisar();
      }
    }

    function reintentar() {
      if (cerrado || timer !== null) return;
      timer = programar(() => { timer = null; conectar(); }, espera);
      espera = Math.min(espera * 2, esperaMaxMs);
    }

    function conectar() {
      if (cerrado) return;
      try {
        ws = new WS(o.url);
      } catch (e) {
        reintentar();
        return;
      }
      ws.onopen = () => {
        espera = esperaInicialMs;
        estado.servidor = 'conectado';
        avisar();
      };
      ws.onmessage = (ev) => manejar(ev.data);
      ws.onclose = () => {
        const estaba = estado.servidor === 'conectado';
        estado.servidor = 'desconectado';
        estado.tiktok = null;
        if (estaba) avisar();
        reintentar();
      };
      ws.onerror = () => { /* después llega onclose */ };
    }

    conectar();
    avisar();

    return {
      enviar(obj) {
        if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
      },
      estado() { return Object.assign({}, estado); },
      cerrar() {
        cerrado = true;
        if (timer !== null) cancelar(timer);
        timer = null;
        if (ws) ws.close();
      }
    };
  }

  AL10.normalizarUrlChat = normalizarUrlChat;
  AL10.crearClienteChat = crearClienteChat;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { normalizarUrlChat, crearClienteChat };
  }
})(typeof window !== 'undefined' ? window : globalThis);
