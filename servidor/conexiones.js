/*
 * Mensajes por WebSocket entre las pantallas y las salas.
 *
 * Pantalla -> servidor:
 *   { tipo: 'crearSala' }                                   el anfitrión crea una sala
 *   { tipo: 'anfitrion', codigo, token }                    el anfitrión vuelve a su sala
 *   { tipo: 'unirse', codigo, nombre, dispositivo }         un jugador entra (o recupera su lugar)
 *   { tipo: 'mensaje', texto }                              predicción, "!jugar", "!salir"
 *   { tipo: 'accion', accion: 'abrirInscripcion'|'empezar' } botones del anfitrión
 *
 * Servidor -> pantalla:
 *   { tipo: 'salaCreada', codigo, token }
 *   { tipo: 'bienvenida', rol, codigo, yo? }
 *   { tipo: 'estado', estado }                              estado completo de la sala
 *   { tipo: 'evento', evento, datos, estado }               evento del motor + estado resultante
 *   { tipo: 'resultado', accion, motivo }                   respuesta a un mensaje del jugador
 *   { tipo: 'error', error }
 *   { tipo: 'salaCerrada', motivo }
 *
 * El servidor es la autoridad: las reglas solo corren acá.
 */
'use strict';

const { crearLimitador } = require('../conector/limitador');

const MENSAJES_POR_CONEXION = 20; // por segundo, cualquier tipo (protege de abusos)

function enviar(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function crearManejador(gestor, opciones) {
  const o = opciones || {};
  const ahora = o.ahora || Date.now;
  const clientes = new Map(); // codigo -> Set(ws)

  function deSala(sala) {
    if (!clientes.has(sala.codigo)) clientes.set(sala.codigo, new Set());
    return clientes.get(sala.codigo);
  }

  function difundir(sala, obj) {
    const lista = clientes.get(sala.codigo);
    if (!lista) return;
    const texto = JSON.stringify(obj);
    lista.forEach((ws) => { if (ws.readyState === 1) ws.send(texto); });
  }

  function difundirEstado(sala) { difundir(sala, { tipo: 'estado', estado: sala.estado() }); }

  // El motor de cada sala avisa sus eventos: se mandan a todas las pantallas de esa sala.
  gestor.alEvento = (sala, evento, datos) => difundir(sala, { tipo: 'evento', evento, datos, estado: sala.estado() });
  gestor.alCerrar = (sala, motivo) => {
    const lista = clientes.get(sala.codigo);
    clientes.delete(sala.codigo);
    if (!lista) return;
    lista.forEach((ws) => {
      enviar(ws, { tipo: 'salaCerrada', motivo });
      ws.salaCodigo = null;
      ws.close(1000, 'sala cerrada');
    });
  };

  function vincular(ws, sala, rol, jugador) {
    desvincular(ws);
    ws.salaCodigo = sala.codigo;
    ws.rol = rol;
    ws.jugador = jugador || null;
    if (jugador) jugador.conexiones++;
    deSala(sala).add(ws);
  }

  function desvincular(ws) {
    if (!ws.salaCodigo) return;
    const sala = gestor.obtener(ws.salaCodigo);
    const lista = clientes.get(ws.salaCodigo);
    if (lista) lista.delete(ws);
    if (ws.jugador) ws.jugador.conexiones = Math.max(0, ws.jugador.conexiones - 1);
    ws.salaCodigo = null;
    ws.rol = null;
    ws.jugador = null;
    if (sala) difundirEstado(sala);
  }

  function lleno(sala) {
    const lista = clientes.get(sala.codigo);
    return lista && lista.size >= gestor.opciones.maxClientesPorSala;
  }

  function alMensaje(ws, m) {
    if (!m || typeof m !== 'object' || typeof m.tipo !== 'string') return;
    const sala = ws.salaCodigo ? gestor.obtener(ws.salaCodigo) : null;

    switch (m.tipo) {
      case 'crearSala': {
        const nueva = gestor.crear();
        if (nueva.error) return enviar(ws, { tipo: 'error', error: nueva.error });
        vincular(ws, nueva, 'anfitrion');
        enviar(ws, { tipo: 'salaCreada', codigo: nueva.codigo, token: nueva.tokenAnfitrion });
        enviar(ws, { tipo: 'bienvenida', rol: 'anfitrion', codigo: nueva.codigo });
        return enviar(ws, { tipo: 'estado', estado: nueva.estado() });
      }
      case 'anfitrion': {
        const s = gestor.obtener(m.codigo);
        if (!s) return enviar(ws, { tipo: 'error', error: 'salaNoExiste' });
        if (!s.esAnfitrion(m.token)) return enviar(ws, { tipo: 'error', error: 'noAutorizado' });
        if (lleno(s)) return enviar(ws, { tipo: 'error', error: 'salaLlena' });
        s.tocar();
        vincular(ws, s, 'anfitrion');
        enviar(ws, { tipo: 'bienvenida', rol: 'anfitrion', codigo: s.codigo });
        return enviar(ws, { tipo: 'estado', estado: s.estado() });
      }
      case 'unirse': {
        const s = gestor.obtener(m.codigo);
        if (!s) return enviar(ws, { tipo: 'error', error: 'salaNoExiste' });
        if (lleno(s)) return enviar(ws, { tipo: 'error', error: 'salaLlena' });
        const r = s.unirse(m.nombre, m.dispositivo);
        if (r.error) return enviar(ws, { tipo: 'error', error: r.error });
        vincular(ws, s, 'jugador', r.jugador);
        enviar(ws, { tipo: 'bienvenida', rol: 'jugador', codigo: s.codigo, yo: { id: r.jugador.id, nombre: r.jugador.nombre }, recuperado: r.recuperado });
        return difundirEstado(s);
      }
      case 'mensaje': {
        if (!sala || ws.rol !== 'jugador' || !ws.jugador) return enviar(ws, { tipo: 'error', error: 'noEstasEnLaSala' });
        const r = sala.mensaje(ws.jugador, m.texto) || {};
        return enviar(ws, { tipo: 'resultado', accion: r.accion || 'ignorado', motivo: r.motivo || null });
      }
      case 'accion': {
        if (!sala || ws.rol !== 'anfitrion') return enviar(ws, { tipo: 'error', error: 'noAutorizado' });
        sala.accionAnfitrion(m.accion);
        return difundirEstado(sala);
      }
      default:
        return undefined;
    }
  }

  function conectar(ws) {
    ws.salaCodigo = null;
    ws.rol = null;
    ws.jugador = null;
    ws.vivo = true;
    const limitador = crearLimitador({ maxPorSegundo: MENSAJES_POR_CONEXION, ahora });
    ws.on('pong', () => { ws.vivo = true; });
    ws.on('message', (data, esBinario) => {
      if (esBinario) return;
      if (!limitador.permitir()) return;
      let m;
      try { m = JSON.parse(String(data)); } catch (e) { return; }
      try { alMensaje(ws, m); } catch (e) { console.error('Error procesando mensaje:', e); }
    });
    ws.on('close', () => desvincular(ws));
    ws.on('error', () => {});
  }

  return { conectar, difundir, difundirEstado, clientes };
}

module.exports = { crearManejador };
