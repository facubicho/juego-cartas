/*
 * Puntuación de una predicción contra la carta que salió.
 *
 *  - Color 1, Palo 2, Número 3 (acumulativos, pleno = 6).
 *  - Solo se puntúa lo anunciado (anunciar un palo implica su color).
 *  - Joker anunciado + Joker derecho: +10 y gana.
 *  - Joker anunciado + Joker de cabeza: -10 y queda eliminado.
 *  - No anunció Joker y sale cualquier Joker: +9.
 *  - Anunció Joker y sale carta normal: 0.
 *
 * Devuelve { puntos, aciertos: {color, palo, numero} (true/false/null = no anunciado),
 *            pleno, efecto: null | 'gana' | 'eliminado', jokerSorpresa }
 */
(function (global) {
  'use strict';
  const AL10 = (global.AL10 = global.AL10 || {});

  function puntosBase() {
    return (AL10.CONFIG_BASE && AL10.CONFIG_BASE.puntos) || {
      color: 1, palo: 2, numero: 3, jokerAnunciadoDerecho: 10, jokerAnunciadoCabeza: -10, jokerNoAnunciado: 9
    };
  }

  function calcularPuntos(prediccion, carta, tablaPuntos) {
    const P = tablaPuntos || puntosBase();
    const sinAciertos = { color: null, palo: null, numero: null };

    if (carta.tipo === 'joker') {
      if (prediccion.joker) {
        if (carta.variante === 'derecho') {
          return { puntos: P.jokerAnunciadoDerecho, aciertos: sinAciertos, pleno: false, efecto: 'gana', jokerSorpresa: false };
        }
        return { puntos: P.jokerAnunciadoCabeza, aciertos: sinAciertos, pleno: false, efecto: 'eliminado', jokerSorpresa: false };
      }
      return { puntos: P.jokerNoAnunciado, aciertos: sinAciertos, pleno: false, efecto: null, jokerSorpresa: true };
    }

    if (prediccion.joker) {
      return { puntos: 0, aciertos: sinAciertos, pleno: false, efecto: null, jokerSorpresa: false };
    }

    const aciertos = {
      color: prediccion.color ? prediccion.color === carta.color : null,
      palo: prediccion.palo ? prediccion.palo === carta.palo : null,
      numero: prediccion.numero !== null && prediccion.numero !== undefined ? prediccion.numero === carta.valor : null
    };

    let puntos = 0;
    if (aciertos.color) puntos += P.color;
    if (aciertos.palo) puntos += P.palo;
    if (aciertos.numero) puntos += P.numero;

    return {
      puntos: puntos,
      aciertos: aciertos,
      pleno: !!(aciertos.color && aciertos.palo && aciertos.numero),
      efecto: null,
      jokerSorpresa: false
    };
  }

  AL10.calcularPuntos = calcularPuntos;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { calcularPuntos };
  }
})(typeof window !== 'undefined' ? window : globalThis);
