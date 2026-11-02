/*
 * Punto único de entrada del chat.
 *
 * Todo mensaje (del simulador o del chat de TikTok LIVE) entra por
 *     onChatMessage(usuario, texto, nombreVisible)
 * que lo pasa al motor del juego.
 *   - usuario: identificador único (en TikTok, el nombre de usuario único).
 *   - nombreVisible (opcional): lo que se muestra en pantalla; si falta, se muestra el usuario.
 * El chat real de TikTok llega por js/chat-ws.js, que llama a esta misma función.
 */
(function (global) {
  'use strict';
  const AL10 = (global.AL10 = global.AL10 || {});

  function crearConectorChat(juego) {
    const oyentes = [];

    function onChatMessage(usuario, texto, nombreVisible) {
      const resultado = juego.recibirMensaje(usuario, texto, nombreVisible);
      oyentes.forEach(function (fn) {
        try { fn(usuario, texto, resultado, nombreVisible); } catch (e) { console.error(e); }
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
