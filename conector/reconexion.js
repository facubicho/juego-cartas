/*
 * Reconexión automática con espera creciente (2 s, 4 s, 8 s... hasta un máximo).
 * Si el usuario no está en vivo se reintenta cada tanto con una espera fija.
 */
'use strict';

function crearReconectador(opciones) {
  const o = opciones || {};
  const conectar = o.conectar;
  const esperaInicialMs = o.esperaInicialMs || 2000;
  const esperaMaxMs = o.esperaMaxMs || 60000;
  const esperaNoEnVivoMs = o.esperaNoEnVivoMs || 30000;
  const programar = o.programar || setTimeout;
  const cancelar = o.cancelar || clearTimeout;
  const alConectar = o.alConectar || function () {};
  const alEsperar = o.alEsperar || function () {};

  let fallos = 0;
  let timer = null;
  let detenido = false;
  let conectando = false;

  function esperaSiguiente(noEnVivo) {
    if (noEnVivo) return esperaNoEnVivoMs;
    return Math.min(esperaInicialMs * Math.pow(2, fallos), esperaMaxMs);
  }

  function programarReintento(error, motivo) {
    if (detenido || timer !== null || conectando) return null;
    const noEnVivo = !!(error && error.noEnVivo);
    const ms = esperaSiguiente(noEnVivo);
    if (!noEnVivo) fallos++;
    alEsperar({ ms: ms, noEnVivo: noEnVivo, error: error || null, motivo: motivo, intento: fallos });
    timer = programar(() => { timer = null; intentar(); }, ms);
    return ms;
  }

  async function intentar() {
    if (detenido || conectando) return;
    conectando = true;
    try {
      await conectar();
      conectando = false;
      fallos = 0;
      if (!detenido) alConectar();
    } catch (error) {
      conectando = false;
      programarReintento(error, 'fallo');
    }
  }

  return {
    iniciar: intentar,
    /** Avisar que la conexión se cortó: se reintenta con espera creciente. */
    seCorto(info) { return programarReintento(null, info || 'corte'); },
    detener() {
      detenido = true;
      if (timer !== null) cancelar(timer);
      timer = null;
    },
    get fallos() { return fallos; },
    get esperando() { return timer !== null; }
  };
}

module.exports = { crearReconectador };
