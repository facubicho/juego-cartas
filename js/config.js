/*
 * Configuración del juego "Adiviná y llegá a 10".
 * Todos los números ajustables están acá. También se pueden cambiar
 * desde la URL (ver README): ?objetivo=15&turno=12&inscripcion=30
 */
(function (global) {
  'use strict';
  const AL10 = (global.AL10 = global.AL10 || {});

  const CONFIG_BASE = {
    puntajeObjetivo: 10,          // puntos para ganar (10 o más)
    maxJugadores: 10,             // lugares en la mesa
    minJugadores: 2,              // mínimo para empezar
    segundosInscripcion: 60,      // cuenta regresiva de inscripción
    segundosTurno: 15,            // reloj de cada turno
    turnosSinResponderParaEliminar: 2,
    listaDeEspera: true,          // si alguien sale o es eliminado, entra el siguiente
    permitirPuntajeNegativo: true, // false: el puntaje nunca baja de 0
    pausaRevelacionMs: 4000,      // tiempo mostrando la carta dada vuelta
    pausaTiempoAgotadoMs: 2000,   // pausa luego de "se acabó el tiempo"
    pausaMesaLlenaMs: 3000,       // pausa antes de arrancar cuando se llena la mesa
    comandoJugar: '!jugar',
    comandoSalir: '!salir',
    comandoCafecito: '!cafecito',
    segundosEntreCafecitos: 60,   // !cafecito responde como máximo una vez por minuto (en total)
    cafecito: {
      activo: true,               // se puede ocultar con ?cafecito=0
      url: 'https://cafecito.app/facubicho'
    },
    puntos: {
      color: 1,
      palo: 2,
      numero: 3,
      jokerAnunciadoDerecho: 10,  // y gana la partida
      jokerAnunciadoCabeza: -10,  // y queda eliminado
      jokerNoAnunciadoDerecho: 9, // sale el Joker derecho sin haberlo anunciado
      jokerNoAnunciadoCabeza: -9  // sale el Joker de cabeza sin haberlo anunciado (no elimina)
    }
  };

  function crearConfig(cambios) {
    const c = cambios || {};
    return Object.assign({}, CONFIG_BASE, c, {
      puntos: Object.assign({}, CONFIG_BASE.puntos, c.puntos || {}),
      cafecito: Object.assign({}, CONFIG_BASE.cafecito, c.cafecito || {})
    });
  }

  AL10.CONFIG_BASE = CONFIG_BASE;
  AL10.crearConfig = crearConfig;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG_BASE, crearConfig };
  }
})(typeof window !== 'undefined' ? window : globalThis);
