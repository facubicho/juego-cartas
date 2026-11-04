/*
 * Botones rápidos de la pantalla del jugador: completan el texto de la predicción.
 *  - Rojo / Negro: pone ese color (saca otro color o un palo que no combine).
 *  - ♥ ♦ ♠ ♣: pone ese palo (saca otro palo o un color que no combine).
 *  - Joker: deja solo "joker".
 * Se puede seguir escribiendo libre: "5" + ♦ queda "5 ♦".
 */
(function (global) {
  'use strict';
  const AL10 = (global.AL10 = global.AL10 || {});

  const RE_COLOR = /\b(rojos?|rojas?|negros?|negras?)\b/gi;
  const RE_PALO = /(♥️?|♦️?|♠️?|♣️?|\bcoraz[oó]n(es)?\b|\bdiamantes?\b|\bpicas?\b|\btr[eé]bol(es)?\b)/gi;
  const RE_JOKER = /\b(jokers?|comod[ií]n(es)?)\b/gi;
  const COLOR_DE_SIMBOLO = { '♥': 'rojo', '♦': 'rojo', '♠': 'negro', '♣': 'negro' };

  function colorDePalo(texto) {
    const s = texto.charAt(0);
    if (COLOR_DE_SIMBOLO[s]) return COLOR_DE_SIMBOLO[s];
    return /^(coraz|diam)/i.test(texto) ? 'rojo' : 'negro';
  }
  function colorDePalabra(texto) { return /^roj/i.test(texto) ? 'rojo' : 'negro'; }
  function ordenar(t) { return t.replace(/\s+/g, ' ').trim(); }

  function completarPrediccion(texto, tipo, valor) {
    let t = String(texto || '');
    if (tipo === 'joker') return 'joker';
    t = t.replace(RE_JOKER, ' ');
    if (tipo === 'color') {
      t = t.replace(RE_COLOR, ' ');
      t = t.replace(RE_PALO, (m) => (colorDePalo(m) === valor ? m : ' '));
      return ordenar(t + ' ' + valor);
    }
    if (tipo === 'palo') {
      t = t.replace(RE_PALO, ' ');
      t = t.replace(RE_COLOR, (m) => (colorDePalabra(m) === COLOR_DE_SIMBOLO[valor] ? m : ' '));
      return ordenar(t + ' ' + valor);
    }
    return ordenar(t);
  }

  AL10.completarPrediccion = completarPrediccion;
  if (typeof module !== 'undefined' && module.exports) module.exports = { completarPrediccion };
})(typeof window !== 'undefined' ? window : globalThis);
