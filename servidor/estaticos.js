/*
 * Sirve los archivos de la página (index.html, jugador.html, css/ y js/).
 * Solo esos: nunca el código del servidor, el conector, el .env ni node_modules.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { codigoValido } = require('./salas');

const RAIZ = path.resolve(__dirname, '..');
const PAGINAS = { '/': 'index.html', '/index.html': 'index.html', '/jugador.html': 'jugador.html' };
const CARPETAS = ['css', 'js'];

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8'
};

const SEGURIDAD = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
    "connect-src 'self' ws: wss:; frame-ancestors 'self'; base-uri 'none'; form-action 'self'"
};

function responder(res, estado, cuerpo, tipo, extra) {
  res.writeHead(estado, Object.assign({ 'Content-Type': tipo || 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' }, SEGURIDAD, extra || {}));
  res.end(cuerpo);
}

/** Devuelve la ruta del archivo a servir, o null si no está permitido. */
function resolverRuta(pathname) {
  let p;
  try { p = decodeURIComponent(pathname); } catch (e) { return null; }
  if (p.includes('\0') || p.includes('\\')) return null;
  if (PAGINAS[p]) return path.join(RAIZ, PAGINAS[p]);
  const partes = p.split('/').filter(Boolean);
  if (partes.length < 2 || !CARPETAS.includes(partes[0])) return null;
  if (partes.some((x) => x === '..' || x === '.' || x.startsWith('.'))) return null;
  const archivo = path.resolve(RAIZ, ...partes);
  const carpeta = path.join(RAIZ, partes[0]) + path.sep;
  if (!archivo.startsWith(carpeta)) return null;
  if (!TIPOS[path.extname(archivo).toLowerCase()]) return null;
  return archivo;
}

function servirEstatico(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return responder(res, 405, 'Método no permitido');
  const url = new URL(req.url, 'http://local');

  // Link corto para los celulares: /s/ABCD -> pantalla del jugador de esa sala
  const corto = url.pathname.match(/^\/s\/([A-Za-z]{4})\/?$/);
  if (corto) {
    const codigo = corto[1].toUpperCase();
    if (!codigoValido(codigo)) return responder(res, 404, 'No encontrado');
    res.writeHead(302, Object.assign({ Location: '/jugador.html?sala=' + codigo }, SEGURIDAD));
    return res.end();
  }

  const archivo = resolverRuta(url.pathname);
  if (!archivo) return responder(res, 404, 'No encontrado');
  fs.stat(archivo, (err, info) => {
    if (err || !info.isFile()) return responder(res, 404, 'No encontrado');
    const tipo = TIPOS[path.extname(archivo).toLowerCase()];
    res.writeHead(200, Object.assign({ 'Content-Type': tipo, 'Content-Length': info.size, 'Cache-Control': 'no-cache' }, SEGURIDAD));
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(archivo).pipe(res);
  });
}

module.exports = { servirEstatico, resolverRuta, responder, RAIZ };
