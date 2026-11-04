// Utilidades para los tests del servidor: levantarlo en un puerto libre y clientes WebSocket simulados.
const WebSocket = require('ws');
const { crearServidor } = require('../../servidor/app');

const RAPIDO = { segundosTurno: 0.4, pausaRevelacionMs: 40, pausaTiempoAgotadoMs: 40, pausaMesaLlenaMs: 40, segundosInscripcion: 60 };

async function levantar(opcionesSalas) {
  const app = await crearServidor({ puerto: 0, host: '127.0.0.1', salas: Object.assign({ configJuego: RAPIDO }, opcionesSalas) });
  return app;
}

function hasta(condicion, ms = 3000, descripcion = 'condición') {
  return new Promise((resolve, reject) => {
    const inicio = Date.now();
    (function revisar() {
      let v;
      try { v = condicion(); } catch (e) { v = false; }
      if (v) return resolve(v);
      if (Date.now() - inicio > ms) return reject(new Error('tiempo agotado esperando: ' + descripcion));
      setTimeout(revisar, 5);
    })();
  });
}

/** Cliente simulado: guarda todos los mensajes que recibe. */
function cliente(app) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:' + app.puerto + '/ws');
    const c = {
      ws,
      mensajes: [],
      enviar(obj) { ws.send(JSON.stringify(obj)); },
      ultimo(tipo) { for (let i = c.mensajes.length - 1; i >= 0; i--) if (!tipo || c.mensajes[i].tipo === tipo) return c.mensajes[i]; return null; },
      estado() { for (let i = c.mensajes.length - 1; i >= 0; i--) if (c.mensajes[i].estado) return c.mensajes[i].estado; return null; },
      esperar(pred, ms, desc) { const desde = c.mensajes.length; return hasta(() => c.mensajes.slice(desde).find(pred), ms, desc); },
      esperarCualquiera(pred, ms, desc) { return hasta(() => c.mensajes.find(pred), ms, desc); },
      cerrar() { return new Promise((r) => { if (ws.readyState === 3) return r(); ws.once('close', r); ws.close(); }); }
    };
    ws.on('message', (d) => c.mensajes.push(JSON.parse(String(d))));
    ws.once('open', () => resolve(c));
    ws.once('error', reject);
  });
}

async function crearSalaCon(app) {
  const anfitrion = await cliente(app);
  const p = anfitrion.esperar((m) => m.tipo === 'salaCreada');
  anfitrion.enviar({ tipo: 'crearSala' });
  const m = await p;
  return { anfitrion, codigo: m.codigo, token: m.token };
}

async function jugador(app, codigo, nombre, dispositivo) {
  const c = await cliente(app);
  const p = c.esperar((m) => m.tipo === 'bienvenida' || m.tipo === 'error');
  c.enviar({ tipo: 'unirse', codigo, nombre, dispositivo: dispositivo || ('disp-' + nombre.replace(/[^A-Za-z0-9]/g, '') + '-0000') });
  c.respuesta = await p;
  return c;
}

module.exports = { levantar, cliente, hasta, crearSalaCon, jugador, RAPIDO };
