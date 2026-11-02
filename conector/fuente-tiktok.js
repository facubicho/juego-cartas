/*
 * Fuente de comentarios real: el chat de un live de TikTok, usando TikTok-Live-Connector.
 * (Librería no oficial: puede dejar de funcionar si TikTok cambia algo.)
 */
'use strict';

async function crearFuenteTikTok(opciones) {
  const o = opciones || {};
  const alComentario = o.alComentario || function () {};
  const alCorte = o.alCorte || function () {};
  const alError = o.alError || function () {};

  // La librería es un módulo ES: se carga con import().
  const lib = await import('tiktok-live-connector');
  let conexion = null;
  let conectado = false;

  async function cerrarAnterior() {
    if (!conexion) return;
    const vieja = conexion;
    conexion = null;
    conectado = false;
    vieja.removeAllListeners();
    try { await vieja.disconnect(); } catch (e) { /* ya estaba cerrada */ }
  }

  return {
    async conectar() {
      await cerrarAnterior();
      const c = new lib.TikTokLiveConnection(o.usuario, {
        processInitialData: false,     // no traer comentarios viejos al conectar
        enableExtendedGiftInfo: false  // los regalos se ignoran en esta etapa
      });
      conexion = c;
      // Solo comentarios de texto: regalos, likes y seguidores no se escuchan.
      c.on(lib.WebcastEvent.CHAT, (data) => alComentario(data));
      c.on(lib.ControlEvent.DISCONNECTED, (info) => {
        if (conexion !== c || !conectado) return;
        conectado = false;
        alCorte(info || {});
      });
      c.on(lib.ControlEvent.ERROR, (err) => { if (conectado) alError(err); }); // los fallos al conectar los informa el reintento
      try {
        const estado = await c.connect();
        conectado = true;
        return estado;
      } catch (err) {
        // Sin live (o usuario mal escrito) TikTok no devuelve la sala: se reintenta cada tanto.
        if (err instanceof lib.UserOfflineError || /room ?id|offline|not live|isn't online/i.test(String(err && err.message))) {
          err.noEnVivo = true;
        }
        await cerrarAnterior();
        throw err;
      }
    },
    desconectar: cerrarAnterior
  };
}

module.exports = { crearFuenteTikTok };
