/*
 * Punto único de entrada del chat.
 *
 * Todo mensaje (del simulador hoy, de TikTok LIVE mañana) entra por
 *     onChatMessage(usuario, texto)
 * que lo pasa al motor del juego. Para conectar el chat real alcanza con
 * llamar a esta función por cada comentario recibido.
 */
(function (global) {
  'use strict';
  const AL10 = (global.AL10 = global.AL10 || {});

  function crearConectorChat(juego) {
    const oyentes = [];

    function onChatMessage(usuario, texto) {
      const resultado = juego.recibirMensaje(usuario, texto);
      oyentes.forEach(function (fn) {
        try { fn(usuario, texto, resultado); } catch (e) { console.error(e); }
      });
      return resultado;
    }

    /** Para mostrar el chat en el simulador (no afecta la lógica). */
    onChatMessage.escuchar = function (fn) { oyentes.push(fn); };

    return onChatMessage;
  }

  AL10.crearConectorChat = crearConectorChat;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { crearConectorChat };
  }
})(typeof window !== 'undefined' ? window : globalThis);
