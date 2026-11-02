/*
 * Límite de mensajes por segundo (ventana deslizante de 1 segundo).
 * Lo que excede el límite se descarta para que el juego no se sature.
 */
'use strict';

function crearLimitador(opciones) {
  const o = opciones || {};
  const max = o.maxPorSegundo || 15;
  const ahora = o.ahora || Date.now;
  let marcas = [];
  let descartados = 0;

  return {
    /** true si el mensaje puede pasar; false si hay que descartarlo. */
    permitir() {
      const t = ahora();
      marcas = marcas.filter((m) => t - m < 1000);
      if (marcas.length >= max) {
        descartados++;
        return false;
      }
      marcas.push(t);
      return true;
    },
    /** Devuelve cuántos se descartaron desde la última consulta y reinicia la cuenta. */
    tomarDescartados() {
      const n = descartados;
      descartados = 0;
      return n;
    }
  };
}

module.exports = { crearLimitador };
