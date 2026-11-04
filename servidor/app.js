/*
 * Arma el servidor: archivos de la página por HTTP y salas por WebSocket (/ws) en el mismo puerto.
 */
'use strict';

const http = require('http');
const os = require('os');
const { WebSocketServer } = require('ws');
const { GestorSalas } = require('./salas');
const { crearManejador } = require('./conexiones');
const { servirEstatico, responder } = require('./estaticos');

/** Direcciones de esta PC en la red local (para que los celulares de la misma wifi puedan entrar). */
function direccionesLocales(puerto) {
  const lista = [];
  Object.values(os.networkInterfaces()).forEach((interfaces) => {
    (interfaces || []).forEach((i) => {
      if (i.family === 'IPv4' && !i.internal) lista.push('http://' + i.address + ':' + puerto);
    });
  });
  return lista;
}

function esLocal(req) {
  const ip = req.socket.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

function crearServidor(opciones) {
  const o = opciones || {};
  const gestor = new GestorSalas(o.salas);
  const manejador = crearManejador(gestor);

  const servidor = http.createServer((req, res) => {
    if (req.url === '/api/salud') {
      const datos = { ok: true, salas: gestor.cantidad };
      // Solo a quien abre desde la misma PC: la dirección de la wifi, para armar el link de los celulares.
      if (esLocal(req)) datos.direccionesLocales = direccionesLocales(servidor.address().port);
      return responder(res, 200, JSON.stringify(datos), 'application/json; charset=utf-8');
    }
    servirEstatico(req, res);
  });

  const wss = new WebSocketServer({ server: servidor, path: '/ws', maxPayload: 4 * 1024 });
  wss.on('connection', (ws) => manejador.conectar(ws));

  // Conexiones que se cortaron sin avisar (celular que se apagó, wifi que se fue)
  const latido = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.vivo) return ws.terminate();
      ws.vivo = false;
      try { ws.ping(); } catch (e) { /* nada */ }
    });
  }, o.latidoMs || 30000);
  latido.unref();

  // Borra las salas inactivas
  const limpieza = setInterval(() => gestor.limpiarInactivas(), o.limpiezaMs || 60000);
  limpieza.unref();

  return new Promise((resolve, reject) => {
    servidor.once('error', reject);
    servidor.listen(o.puerto === undefined ? 3000 : o.puerto, o.host || '0.0.0.0', () => {
      resolve({
        servidor, wss, gestor, manejador,
        get puerto() { return servidor.address().port; },
        cerrar() {
          clearInterval(latido);
          clearInterval(limpieza);
          gestor.cerrarTodas();
          wss.clients.forEach((ws) => ws.terminate());
          return new Promise((res) => { wss.close(() => servidor.close(() => res())); });
        }
      });
    });
  });
}

module.exports = { crearServidor, direccionesLocales };
