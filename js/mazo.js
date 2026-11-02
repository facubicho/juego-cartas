/*
 * Mazo: baraja francesa de 52 cartas + 2 Jokers (54).
 * Cada extracción usa un mazo completo recién mezclado (las cartas vuelven siempre).
 */
(function (global) {
  'use strict';
  const AL10 = (global.AL10 = global.AL10 || {});

  const PALOS = [
    { id: 'corazones', nombre: 'Corazones', simbolo: '♥', color: 'rojo' },
    { id: 'diamantes', nombre: 'Diamantes', simbolo: '♦', color: 'rojo' },
    { id: 'picas', nombre: 'Picas', simbolo: '♠', color: 'negro' },
    { id: 'treboles', nombre: 'Tréboles', simbolo: '♣', color: 'negro' }
  ];
  const PALO_POR_ID = {};
  PALOS.forEach(function (p) { PALO_POR_ID[p.id] = p; });

  const LETRA_VALOR = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
  const NOMBRE_VALOR = { 1: 'As', 11: 'J', 12: 'Q', 13: 'K' };

  function crearMazo() {
    const cartas = [];
    PALOS.forEach(function (p) {
      for (let v = 1; v <= 13; v++) {
        cartas.push({ tipo: 'normal', palo: p.id, valor: v, color: p.color, id: etiquetaValor(v) + p.simbolo });
      }
    });
    // Los dos Jokers tienen orientación fija.
    cartas.push({ tipo: 'joker', variante: 'derecho', id: 'JOKER-DERECHO' }); // suma
    cartas.push({ tipo: 'joker', variante: 'cabeza', id: 'JOKER-CABEZA' });   // resta
    return cartas;
  }

  function mezclar(cartas, rng) {
    const r = rng || Math.random;
    const copia = cartas.slice();
    for (let i = copia.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = copia[i]; copia[i] = copia[j]; copia[j] = t;
    }
    return copia;
  }

  function sacarCarta(rng) {
    return mezclar(crearMazo(), rng)[0];
  }

  function etiquetaValor(v) {
    return LETRA_VALOR[v] || String(v);
  }

  function describirCarta(carta) {
    if (!carta) return '';
    if (carta.tipo === 'joker') return carta.variante === 'derecho' ? 'Joker derecho' : 'Joker de cabeza';
    return (NOMBRE_VALOR[carta.valor] || carta.valor) + ' de ' + PALO_POR_ID[carta.palo].nombre;
  }

  AL10.PALOS = PALOS;
  AL10.PALO_POR_ID = PALO_POR_ID;
  AL10.crearMazo = crearMazo;
  AL10.mezclar = mezclar;
  AL10.sacarCarta = sacarCarta;
  AL10.etiquetaValor = etiquetaValor;
  AL10.describirCarta = describirCarta;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PALOS, PALO_POR_ID, crearMazo, mezclar, sacarCarta, etiquetaValor, describirCarta };
  }
})(typeof window !== 'undefined' ? window : globalThis);
