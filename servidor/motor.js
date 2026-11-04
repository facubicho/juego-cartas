/*
 * Carga en Node el mismo motor de reglas que usa la página (js/*.js), sin tocarlo.
 * Esos archivos se registran en globalThis.AL10 y también exportan con module.exports.
 */
'use strict';

require('../js/config.js');
require('../js/mazo.js');
require('../js/interprete.js');
require('../js/puntuacion.js');
require('../js/juego.js');
require('../js/chat.js');

module.exports = globalThis.AL10;
