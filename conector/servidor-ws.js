/*
 * WebSocket local por el que el conector le pasa los comentarios a la página del juego.
 * Escucha solo en esta PC (127.0.0.1): nadie de afuera se puede conectar.
 */
'use strict';

const { WebSocketServer } = require('ws');

function crearServidorWs(opciones) {
  const o = opciones || {};
  const alMensaje = o.alMensaje || function () {};
  const alCliente = o.alCliente || function () {};

  return new Promise((resolve, reject) => {
    const wss = new WebSocketServer({ port: o.puerto, host: o.host || '127.0.0.1' });
    let ultimoEstado = null;

    function enviarA(cliente, obj) {
      if (cliente.readyState === 1) cliente.send(JSON.stringify(obj));
    }

    const api = {
      get puerto() { return wss.address().port; },
      cantidadClientes() { return wss.clients.size; },
      /** Manda un mensaje a todas las páginas conectadas. */
      difundir(obj) { wss.clients.forEach((c) => enviarA(c, obj)); },
      /** Guarda y manda el estado de la conexión con TikTok (las páginas nuevas también lo reciben). */
      difundirEstado(estado) {
        ultimoEstado = Object.assign({ tipo: 'estado' }, estado);
        api.difundir(ultimoEstado);
      },
      cerrar() {
        return new Promise((res) => {
          wss.clients.forEach((c) => c.terminate());
          wss.close(() => res());
        });
      }
    };

    wss.on('connection', (cliente) => {
      if (ultimoEstado) enviarA(cliente, ultimoEstado);
      alCliente(api.cantidadClientes());
      cliente.on('message', (data) => {
        let m;
        try { m = JSON.parse(String(data)); } catch (e) { return; }
        if (m && typeof m === 'object') alMensaje(m);
      });
      cliente.on('close', () => alCliente(api.cantidadClientes()));
    });

    wss.once('listening', () => resolve(api));
    wss.once('error', (err) => reject(err));
  });
}

module.exports = { crearServidorWs };
