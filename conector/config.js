/*
 * Configuración del conector.
 * Se lee, en este orden de prioridad:
 *   1. parámetros de la línea de comandos (--usuario=xxx, --puerto=8080, --prueba)
 *   2. variables de entorno
 *   3. el archivo .env de la carpeta del proyecto (no se sube a GitHub; ver .env.example)
 *   4. valores por defecto
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RUTA_ENV = path.join(__dirname, '..', '.env');

/** Lee el texto de un archivo .env (CLAVE=valor, # comentarios). */
function leerEnv(texto) {
  const resultado = {};
  String(texto || '').split(/\r?\n/).forEach((linea) => {
    const l = linea.trim();
    if (!l || l.startsWith('#')) return;
    const i = l.indexOf('=');
    if (i <= 0) return;
    const clave = l.slice(0, i).trim();
    let valor = l.slice(i + 1).trim();
    const comillas = valor.match(/^(['"])(.*?)\1(\s+#.*)?$/);
    if (comillas) valor = comillas[2];
    else valor = valor.replace(/\s+#.*$/, '').trim(); // comentario al final de la línea
    resultado[clave] = valor;
  });
  return resultado;
}

/** Lee --clave=valor y --bandera de la línea de comandos. */
function leerArgumentos(argv) {
  const r = {};
  (argv || []).forEach((a) => {
    const m = String(a).match(/^--([^=]+)(?:=(.*))?$/);
    if (m) r[m[1]] = m[2] === undefined ? true : m[2];
  });
  return r;
}

function entero(valor, porDefecto, min, max) {
  const n = parseInt(valor, 10);
  if (!Number.isFinite(n)) return porDefecto;
  return Math.max(min, Math.min(max, n));
}

/** Acepta "usuario", "@usuario" o la dirección del live (https://www.tiktok.com/@usuario/live). */
function normalizarUsuario(valor) {
  if (!valor || typeof valor !== 'string') return '';
  const m = valor.match(/tiktok\.com\/@([^/?#\s]+)/i);
  const u = (m ? m[1] : valor).trim().replace(/^@/, '');
  return /^[A-Za-z0-9._]+$/.test(u) ? u : '';
}

function cargarConfig(opciones) {
  const o = opciones || {};
  const args = leerArgumentos(o.argv || []);
  let archivo = {};
  if (o.textoEnv !== undefined) {
    archivo = leerEnv(o.textoEnv);
  } else {
    const ruta = o.rutaEnv || RUTA_ENV;
    if (fs.existsSync(ruta)) archivo = leerEnv(fs.readFileSync(ruta, 'utf8'));
  }
  const env = o.env || {};
  const valor = (arg, clave) => (args[arg] !== undefined && args[arg] !== true ? args[arg] : (env[clave] !== undefined ? env[clave] : archivo[clave]));

  const mostrar = String(valor('mostrar', 'MOSTRAR_NOMBRE') || 'apodo').toLowerCase();

  return {
    usuario: normalizarUsuario(valor('usuario', 'TIKTOK_USUARIO')),
    puerto: entero(valor('puerto', 'PUERTO'), 8080, 1, 65535),
    mostrar: mostrar === 'usuario' ? 'usuario' : 'apodo',
    maxPorSegundo: entero(valor('max', 'MAX_MENSAJES_POR_SEGUNDO'), 15, 1, 1000),
    largoMaximo: entero(valor('largo', 'LARGO_MAXIMO'), 100, 10, 500),
    prueba: args.prueba === true || args.prueba === 'true',
    cortes: args.cortes === true || args.cortes === 'true'
  };
}

module.exports = { leerEnv, leerArgumentos, normalizarUsuario, cargarConfig, RUTA_ENV };
