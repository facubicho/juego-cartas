/*
 * Interpreta el texto del chat como una predicción.
 * Acepta mayúsculas/minúsculas, con o sin tildes, números y palabras,
 * palos en palabras o símbolos (♥ ♦ ♠ ♣) y colores (rojo/negro).
 *
 * Resultado válido:
 *   { valida: true, joker, numero, palo, color, colorPorPalo }
 *   - Anunciar un palo implica su color (diamantes => rojo): colorPorPalo = true.
 * Resultado inválido:
 *   { valida: false, motivo: 'vacia' | 'ambigua' | 'contradictoria' | 'fueraDeRango' }
 */
(function (global) {
  'use strict';
  const AL10 = (global.AL10 = global.AL10 || {});

  const VALORES = new Map(Object.entries({
    as: 1, ace: 1, uno: 1,
    dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
    j: 11, jota: 11, once: 11,
    q: 12, reina: 12, dama: 12, doce: 12,
    k: 13, rey: 13, trece: 13
  }));

  const PALOS = new Map(Object.entries({
    corazon: 'corazones', corazones: 'corazones',
    diamante: 'diamantes', diamantes: 'diamantes',
    pica: 'picas', picas: 'picas',
    trebol: 'treboles', treboles: 'treboles'
  }));

  const COLORES = new Map(Object.entries({
    rojo: 'rojo', roja: 'rojo', rojos: 'rojo', rojas: 'rojo',
    negro: 'negro', negra: 'negro', negros: 'negro', negras: 'negro'
  }));

  const JOKER = new Set(['joker', 'jokers', 'jocker', 'comodin', 'comodines', 'guason']);

  const COLOR_DE_PALO = { corazones: 'rojo', diamantes: 'rojo', picas: 'negro', treboles: 'negro' };

  const SIMBOLOS = [
    [/[♥♡❤]/g, ' corazones '],
    [/[♦♢]/g, ' diamantes '],
    [/[♠♤]/g, ' picas '],
    [/[♣♧]/g, ' treboles ']
  ];

  function normalizar(texto) {
    let s = String(texto == null ? '' : texto);
    SIMBOLOS.forEach(function (par) { s = s.replace(par[0], par[1]); });
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ︎️]/g, '');
  }

  function tokenizar(texto) {
    return normalizar(texto).split(/[^a-z0-9]+/).filter(Boolean);
  }

  function invalida(motivo) {
    return { valida: false, motivo: motivo };
  }

  function interpretarPrediccion(texto) {
    const numeros = new Set();
    const palos = new Set();
    const colores = new Set();
    let joker = false;
    let fueraDeRango = false;

    tokenizar(texto).forEach(function (tk) {
      if (JOKER.has(tk)) { joker = true; return; }
      if (/^\d+$/.test(tk)) {
        const n = parseInt(tk, 10);
        if (n >= 1 && n <= 13) numeros.add(n); else fueraDeRango = true;
        return;
      }
      if (VALORES.has(tk)) { numeros.add(VALORES.get(tk)); return; }
      if (PALOS.has(tk)) { palos.add(PALOS.get(tk)); return; }
      if (COLORES.has(tk)) { colores.add(COLORES.get(tk)); return; }
      // Cualquier otra palabra ("de", "creo", "que"...) se ignora.
    });

    if (fueraDeRango) return invalida('fueraDeRango');

    if (joker) {
      if (numeros.size || palos.size || colores.size) return invalida('ambigua');
      return { valida: true, joker: true, numero: null, palo: null, color: null, colorPorPalo: false };
    }

    if (numeros.size > 1 || palos.size > 1 || colores.size > 1) return invalida('ambigua');

    const numero = numeros.size ? Array.from(numeros)[0] : null;
    const palo = palos.size ? Array.from(palos)[0] : null;
    const colorDicho = colores.size ? Array.from(colores)[0] : null;

    if (numero === null && palo === null && colorDicho === null) return invalida('vacia');

    const colorDelPalo = palo ? COLOR_DE_PALO[palo] : null;
    if (colorDicho && colorDelPalo && colorDicho !== colorDelPalo) return invalida('contradictoria');

    return {
      valida: true,
      joker: false,
      numero: numero,
      palo: palo,
      color: colorDicho || colorDelPalo,
      colorPorPalo: !colorDicho && !!colorDelPalo
    };
  }

  const NOMBRE_NUMERO = { 1: 'As', 11: 'J', 12: 'Q', 13: 'K' };
  const NOMBRE_PALO = { corazones: 'Corazones', diamantes: 'Diamantes', picas: 'Picas', treboles: 'Tréboles' };

  function describirPrediccion(p) {
    if (!p || !p.valida) return '';
    if (p.joker) return 'Joker';
    const partes = [];
    if (p.numero !== null) partes.push(NOMBRE_NUMERO[p.numero] || String(p.numero));
    if (p.palo) partes.push((partes.length ? 'de ' : '') + NOMBRE_PALO[p.palo]);
    if (p.color && !p.palo) partes.push(p.color === 'rojo' ? 'Rojo' : 'Negro');
    return partes.join(' ');
  }

  AL10.normalizar = normalizar;
  AL10.interpretarPrediccion = interpretarPrediccion;
  AL10.describirPrediccion = describirPrediccion;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { normalizar, tokenizar, interpretarPrediccion, describirPrediccion };
  }
})(typeof window !== 'undefined' ? window : globalThis);
