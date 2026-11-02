/*
 * Limpieza de los comentarios que llegan del chat de TikTok.
 * Solo se usan comentarios de texto: regalos, likes y seguidores no pasan por acá.
 */
'use strict';

// Caracteres de control e invisibles que pueden romper la pantalla o el intérprete.
const INVISIBLES = /[\u0000-\u001F\u007F-\u009F\u200B\u200C\u200E\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069\uFEFF]/g;

/** Recorta espacios, quita caracteres invisibles y limita el largo (en caracteres, no bytes). */
function limpiarTexto(texto, largoMaximo) {
  if (typeof texto !== 'string') return '';
  const max = largoMaximo || 100;
  let s = texto.replace(INVISIBLES, ' ').replace(/\s+/g, ' ').trim();
  const caracteres = Array.from(s); // respeta emojis y símbolos como ♦
  if (caracteres.length > max) s = caracteres.slice(0, max).join('').trim();
  return s;
}

/**
 * Convierte un evento de chat de TikTok-Live-Connector en { usuario, nombre, texto }.
 *  - usuario: el nombre de usuario único (uniqueId); identifica al jugador.
 *  - nombre: lo que se muestra: el apodo (nickname) o el nombre de usuario, según `mostrar`.
 * Devuelve null si no es un comentario de texto utilizable.
 */
function extraerComentario(evento, opciones) {
  const o = opciones || {};
  if (!evento || typeof evento !== 'object') return null;
  const u = evento.user && typeof evento.user === 'object' ? evento.user : evento; // v2 y v1 de la librería
  const usuario = limpiarTexto(u.uniqueId, 64).replace(/^@/, '').replace(/\s/g, '');
  if (!usuario) return null;
  const texto = limpiarTexto(evento.comment, o.largoMaximo || 100);
  if (!texto) return null;
  const apodo = limpiarTexto(u.nickname, o.largoNombre || 30);
  const nombre = o.mostrar === 'usuario' ? usuario : (apodo || usuario);
  return { usuario: usuario, nombre: nombre, texto: texto };
}

module.exports = { limpiarTexto, extraerComentario };
