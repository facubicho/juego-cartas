/*
 * Salas online: cada sala tiene su propia partida (el mismo motor de reglas de la página).
 * Acá no hay red: solo la lógica de salas, nombres, límites y expiración (fácil de testear).
 */
'use strict';

const crypto = require('crypto');
const AL10 = require('./motor');
const { limpiarTexto } = require('../conector/limpieza');
const { crearLimitador } = require('../conector/limitador');

// Sin letras que se confunden al dictarlas o leerlas (I, O).
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LARGO_CODIGO = 4;

const OPCIONES_BASE = {
  maxSalas: 50,                       // salas simultáneas
  inactividadMs: 2 * 60 * 60 * 1000,  // una sala sin actividad se borra a las 2 horas
  maxClientesPorSala: 40,             // anfitrión + jugadores + espectadores conectados
  mensajesPorSegundo: 3,              // por jugador
  largoMaximoMensaje: 100,
  largoMaximoNombre: 20,
  configJuego: {},                    // cambios a js/config.js (por ejemplo en los tests)
  sacarCarta: null,                   // solo para tests
  ahora: () => Date.now()
};

function normalizarNombre(nombre) {
  return String(nombre).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

function codigoValido(codigo) {
  return typeof codigo === 'string' && new RegExp('^[' + ALFABETO + ']{' + LARGO_CODIGO + '}$').test(codigo);
}

/** Identificador del dispositivo que guarda el navegador (para recuperar el lugar al volver). */
function dispositivoValido(d) {
  return typeof d === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(d);
}

class Sala {
  constructor(codigo, opciones, alEvento) {
    this.codigo = codigo;
    this.opciones = opciones;
    this.tokenAnfitrion = crypto.randomBytes(16).toString('hex');
    this.creadaEn = opciones.ahora();
    this.ultimaActividad = this.creadaEn;
    this.jugadores = new Map(); // dispositivo -> { id, nombre, normal, limitador, conexiones }
    this.cerrada = false;

    const o = { config: opciones.configJuego };
    if (opciones.sacarCarta) o.sacarCarta = opciones.sacarCarta;
    this.juego = new AL10.Juego(o);
    // Entrada única del chat: igual que el simulador y el conector de TikTok.
    this.onChatMessage = AL10.crearConectorChat(this.juego);
    this.juego.on((tipo, datos) => { if (alEvento) alEvento(this, tipo, datos); });
  }

  tocar() { this.ultimaActividad = this.opciones.ahora(); }

  esAnfitrion(token) {
    if (typeof token !== 'string' || token.length !== this.tokenAnfitrion.length) return false;
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(this.tokenAnfitrion));
  }

  /**
   * Entra un jugador. Si el dispositivo ya estaba en la sala, recupera su lugar (y su nombre).
   * Devuelve { jugador, recuperado } o { error: 'dispositivoInvalido' | 'nombreInvalido' | 'nombreRepetido' }.
   */
  unirse(nombre, dispositivo) {
    if (!dispositivoValido(dispositivo)) return { error: 'dispositivoInvalido' };
    this.tocar();
    const existente = this.jugadores.get(dispositivo);
    if (existente) return { jugador: existente, recuperado: true };

    const limpio = limpiarTexto(typeof nombre === 'string' ? nombre : '', this.opciones.largoMaximoNombre).replace(/^@+/, '').trim();
    if (!limpio) return { error: 'nombreInvalido' };
    const normal = normalizarNombre(limpio);
    for (const j of this.jugadores.values()) {
      if (j.normal === normal) return { error: 'nombreRepetido' };
    }
    const jugador = {
      id: 'j' + crypto.randomBytes(5).toString('hex'),
      nombre: limpio,
      normal: normal,
      limitador: crearLimitador({ maxPorSegundo: this.opciones.mensajesPorSegundo, ahora: this.opciones.ahora }),
      conexiones: 0
    };
    this.jugadores.set(dispositivo, jugador);
    return { jugador, recuperado: false };
  }

  /** Un mensaje de un jugador (predicción, "!jugar", "!salir"...). Pasa por onChatMessage. */
  mensaje(jugador, texto) {
    this.tocar();
    if (!jugador.limitador.permitir()) return { accion: 'limite' };
    const limpio = limpiarTexto(typeof texto === 'string' ? texto : '', this.opciones.largoMaximoMensaje);
    if (!limpio) return { accion: 'ignorado' };
    return this.onChatMessage(jugador.id, limpio, jugador.nombre);
  }

  /** Botones del anfitrión. */
  accionAnfitrion(accion) {
    this.tocar();
    if (accion === 'abrirInscripcion') { this.juego.abrirInscripcion(); return true; }
    if (accion === 'empezar') return this.juego.iniciarPartida();
    return false;
  }

  /** Estado para mandar a las pantallas: el del motor + datos de la sala. */
  estado() {
    const e = this.juego.estado();
    e.restanteMs = e.finEn ? Math.max(0, e.finEn - e.ahora) : 0;
    delete e.finEn;
    delete e.ahora;
    e.esperaIds = this.juego.listaEspera.map((x) => x.clave);
    e.sala = {
      codigo: this.codigo,
      personas: Array.from(this.jugadores.values()).map((j) => ({ id: j.id, nombre: j.nombre, conectado: j.conexiones > 0 }))
    };
    return e;
  }

  cerrar() {
    this.cerrada = true;
    this.juego.detener();
  }
}

class GestorSalas {
  constructor(opciones) {
    this.opciones = Object.assign({}, OPCIONES_BASE, opciones || {});
    this.salas = new Map();
    this.alEvento = this.opciones.alEvento || null;
    this.alCerrar = this.opciones.alCerrar || null;
  }

  get cantidad() { return this.salas.size; }

  _nuevoCodigo() {
    for (let intento = 0; intento < 1000; intento++) {
      let c = '';
      for (let i = 0; i < LARGO_CODIGO; i++) c += ALFABETO[crypto.randomInt(ALFABETO.length)];
      if (!this.salas.has(c)) return c;
    }
    return null;
  }

  /** Crea una sala. Devuelve la sala o { error: 'demasiadasSalas' }. */
  crear() {
    this.limpiarInactivas();
    if (this.salas.size >= this.opciones.maxSalas) return { error: 'demasiadasSalas' };
    const codigo = this._nuevoCodigo();
    if (!codigo) return { error: 'demasiadasSalas' };
    const sala = new Sala(codigo, this.opciones, this.alEvento);
    this.salas.set(codigo, sala);
    return sala;
  }

  obtener(codigo) {
    const c = typeof codigo === 'string' ? codigo.trim().toUpperCase() : '';
    if (!codigoValido(c)) return null;
    return this.salas.get(c) || null;
  }

  /** Borra las salas sin actividad. Devuelve los códigos borrados. */
  limpiarInactivas() {
    const ahora = this.opciones.ahora();
    const borradas = [];
    for (const [codigo, sala] of this.salas) {
      if (ahora - sala.ultimaActividad >= this.opciones.inactividadMs) {
        this.borrar(codigo, 'inactiva');
        borradas.push(codigo);
      }
    }
    return borradas;
  }

  borrar(codigo, motivo) {
    const sala = this.salas.get(codigo);
    if (!sala) return;
    this.salas.delete(codigo);
    sala.cerrar();
    if (this.alCerrar) this.alCerrar(sala, motivo);
  }

  cerrarTodas() {
    for (const codigo of Array.from(this.salas.keys())) this.borrar(codigo, 'servidorCerrado');
  }
}

module.exports = { GestorSalas, Sala, normalizarNombre, codigoValido, dispositivoValido, ALFABETO, OPCIONES_BASE };
