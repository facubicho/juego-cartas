/*
 * Motor del juego (sin nada de interfaz).
 *
 * Fases:  'espera' -> 'inscripcion' -> 'jugando' -> 'terminada'
 * Subfases de 'jugando': 'turno' (esperando predicción), 'revelando' (carta dada vuelta),
 *                        'pausa' (se acabó el tiempo).
 *
 * Toda la entrada del chat llega por recibirMensaje(usuario, texto).
 * La interfaz se entera de los cambios con juego.on((tipo, datos, juego) => ...).
 *
 * Eventos: inscripcionAbierta, jugadorInscripto, mesaLlena, entraEnEspera, salioDeEspera,
 *          faltanJugadores, partidaIniciada, turno, prediccionInvalida, revelacion,
 *          tiempoAgotado, jugadorEliminado, entraDeEspera, partidaTerminada.
 */
(function (global) {
  'use strict';
  const AL10 = (global.AL10 = global.AL10 || {});

  const relojReal = {
    ahora: function () { return Date.now(); },
    setTimeout: function (fn, ms) { return setTimeout(fn, ms); },
    clearTimeout: function (id) { clearTimeout(id); }
  };

  function clave(nombre) {
    return String(nombre).trim().replace(/^@/, '').toLowerCase();
  }

  function limpiarNombre(nombre) {
    return String(nombre == null ? '' : nombre).trim().replace(/^@/, '');
  }

  class Juego {
    constructor(opciones) {
      const o = opciones || {};
      this.config = AL10.crearConfig(o.config);
      this.rng = o.rng || Math.random;
      this.reloj = o.reloj || relojReal;
      this._sacarCarta = o.sacarCarta || (() => AL10.sacarCarta(this.rng));
      this._oyentes = [];
      this._timer = null;
      this._reiniciarEstado();
    }

    /* ---------- Suscripción a eventos ---------- */

    on(fn) {
      this._oyentes.push(fn);
      return () => { this._oyentes = this._oyentes.filter((f) => f !== fn); };
    }

    _emitir(tipo, datos) {
      const d = datos || {};
      this._oyentes.slice().forEach((fn) => {
        try { fn(tipo, d, this); } catch (e) { if (typeof console !== 'undefined') console.error(e); }
      });
    }

    /* ---------- Temporizador único ---------- */

    _programar(ms, fn) {
      this._cancelarTimer();
      this.finEn = this.reloj.ahora() + ms;
      this._timer = this.reloj.setTimeout(() => { this._timer = null; fn(); }, ms);
    }

    _cancelarTimer() {
      if (this._timer !== null) this.reloj.clearTimeout(this._timer);
      this._timer = null;
      this.finEn = null;
    }

    /* ---------- Estado ---------- */

    _reiniciarEstado() {
      this.fase = 'espera';
      this.subfase = null;
      this.jugadores = [];     // orden de la mesa = orden de turnos = orden de ingreso
      this.espera = [];        // lista de espera (nombres)
      this.eliminados = [];
      this.indiceTurno = -1;
      this.numeroTurno = 0;
      this.ganador = null;
      this.motivoFin = null;
      this.ultimaJugada = null;
      this.historial = [];
      this.finEn = null;
      this._arranqueProgramado = false;
    }

    _crearJugador(nombre) {
      return { clave: clave(nombre), nombre: nombre, puntos: 0, sinResponder: 0, jugadas: 0 };
    }

    jugadorActual() {
      if (this.fase !== 'jugando') return null;
      return this.jugadores[this.indiceTurno] || null;
    }

    _buscar(nombre) {
      const k = clave(nombre);
      return this.jugadores.find((j) => j.clave === k) || null;
    }

    _enEspera(nombre) {
      const k = clave(nombre);
      return this.espera.findIndex((n) => clave(n) === k);
    }

    estado() {
      const actual = this.jugadorActual();
      return {
        fase: this.fase,
        subfase: this.subfase,
        config: this.config,
        jugadores: this.jugadores.map((j, i) => Object.assign({}, j, { orden: i + 1, esTurno: j === actual })),
        espera: this.espera.slice(),
        eliminados: this.eliminados.slice(),
        jugadorActual: actual ? actual.nombre : null,
        numeroTurno: this.numeroTurno,
        finEn: this.finEn,
        ahora: this.reloj.ahora(),
        ganador: this.ganador ? this.ganador.nombre : null,
        motivoFin: this.motivoFin,
        ultimaJugada: this.ultimaJugada,
        resumen: this.fase === 'terminada' ? this.resumen() : null
      };
    }

    resumen() {
      const filas = this.jugadores.map((j) => ({
        nombre: j.nombre, puntos: j.puntos,
        estado: this.ganador && j === this.ganador ? 'ganador' : 'en mesa', motivo: null
      }));
      this.eliminados.forEach((e) => {
        filas.push({ nombre: e.nombre, puntos: e.puntos, estado: 'eliminado', motivo: e.motivo });
      });
      const peso = { ganador: 0, 'en mesa': 1, eliminado: 2 };
      return filas.sort((a, b) => (peso[a.estado] - peso[b.estado]) || (b.puntos - a.puntos));
    }

    /* ---------- Control del anfitrión ---------- */

    abrirInscripcion() {
      this._cancelarTimer();
      this._reiniciarEstado();
      this.fase = 'inscripcion';
      this._programar(this.config.segundosInscripcion * 1000, () => this._finInscripcion());
      this._emitir('inscripcionAbierta', { segundos: this.config.segundosInscripcion });
    }

    _finInscripcion() {
      if (this.jugadores.length >= this.config.minJugadores) {
        this.iniciarPartida();
      } else {
        // No alcanza: se extiende la inscripción conservando a los anotados.
        this._programar(this.config.segundosInscripcion * 1000, () => this._finInscripcion());
        this._emitir('faltanJugadores', { minimo: this.config.minJugadores, anotados: this.jugadores.length });
      }
    }

    iniciarPartida() {
      if (this.fase !== 'inscripcion' || this.jugadores.length < this.config.minJugadores) return false;
      this._cancelarTimer();
      this.fase = 'jugando';
      this.indiceTurno = -1;
      this._emitir('partidaIniciada', { jugadores: this.jugadores.map((j) => j.nombre) });
      this._siguienteTurno();
      return true;
    }

    detener() {
      this._cancelarTimer();
    }

    /* ---------- Entrada única del chat ---------- */

    recibirMensaje(usuario, texto) {
      const nombre = limpiarNombre(usuario);
      const t = String(texto == null ? '' : texto).trim();
      if (!nombre || !t) return { accion: 'ignorado' };

      const comando = t.toLowerCase().split(/\s+/)[0];
      if (comando === this.config.comandoJugar) return this._inscribir(nombre);
      if (comando === this.config.comandoSalir) return this._salir(nombre);

      // Solo cuenta el jugador del turno, y solo mientras el reloj corre
      // (después de la primera predicción válida la subfase cambia y se ignora el resto).
      if (this.fase === 'jugando' && this.subfase === 'turno') {
        const actual = this.jugadorActual();
        if (actual && actual.clave === clave(nombre)) return this._procesarPrediccion(actual, t);
      }
      return { accion: 'ignorado' };
    }

    /* ---------- Inscripción / salida ---------- */

    _inscribir(nombre) {
      if (this.fase !== 'inscripcion' && this.fase !== 'jugando') return { accion: 'ignorado', motivo: 'sinInscripcion' };
      if (this._buscar(nombre) || this._enEspera(nombre) >= 0) return { accion: 'ignorado', motivo: 'yaAnotado' };

      const hayLugar = this.fase === 'inscripcion' && this.jugadores.length < this.config.maxJugadores;
      if (hayLugar) {
        const j = this._crearJugador(nombre);
        this.jugadores.push(j);
        this._emitir('jugadorInscripto', { nombre: nombre, orden: this.jugadores.length });
        if (this.jugadores.length >= this.config.maxJugadores && !this._arranqueProgramado) {
          this._arranqueProgramado = true;
          this._programar(this.config.pausaMesaLlenaMs, () => this.iniciarPartida());
        }
        return { accion: 'inscripto', orden: this.jugadores.length };
      }

      // Mesa llena (o partida en curso): espectador o lista de espera.
      if (this.config.listaDeEspera) {
        this.espera.push(nombre);
        this._emitir('mesaLlena', { nombre: nombre, enEspera: true, posicion: this.espera.length });
        return { accion: 'enEspera', posicion: this.espera.length };
      }
      this._emitir('mesaLlena', { nombre: nombre, enEspera: false });
      return { accion: 'espectador' };
    }

    _salir(nombre) {
      const idxEspera = this._enEspera(nombre);
      if (idxEspera >= 0) {
        const n = this.espera.splice(idxEspera, 1)[0];
        this._emitir('salioDeEspera', { nombre: n });
        return { accion: 'salio' };
      }
      const j = this._buscar(nombre);
      if (!j) return { accion: 'ignorado' };

      if (this.fase === 'inscripcion') {
        this.jugadores.splice(this.jugadores.indexOf(j), 1);
        this._emitir('jugadorEliminado', { nombre: j.nombre, motivo: 'salio' });
        this._entrarDeEspera();
        if (this.jugadores.length < this.config.maxJugadores && this._arranqueProgramado) {
          this._arranqueProgramado = false;
          this._programar(this.config.segundosInscripcion * 1000, () => this._finInscripcion());
        }
        return { accion: 'salio' };
      }

      if (this.fase === 'jugando') {
        const eraActual = this._eliminar(j, 'salio');
        if (this.subfase === 'turno' && (eraActual || this.jugadores.length <= 1)) this._continuar();
        else if (this.subfase !== 'turno' && this.jugadores.length <= 1 && !this.ganador) this._marcarUltimoEnPie();
        return { accion: 'salio' };
      }
      return { accion: 'ignorado' };
    }

    _entrarDeEspera() {
      if (!this.config.listaDeEspera || !this.espera.length) return null;
      if (this.jugadores.length >= this.config.maxJugadores) return null;
      const nombre = this.espera.shift();
      const j = this._crearJugador(nombre);
      this.jugadores.push(j); // entra al final del orden (orden de ingreso)
      this._emitir('entraDeEspera', { nombre: nombre, orden: this.jugadores.length });
      return j;
    }

    /** Saca a un jugador de la mesa. Devuelve true si era el jugador del turno. */
    _eliminar(jugador, motivo) {
      const idx = this.jugadores.indexOf(jugador);
      if (idx < 0) return false;
      const eraActual = this.fase === 'jugando' && idx === this.indiceTurno;
      this.jugadores.splice(idx, 1);
      if (idx <= this.indiceTurno) this.indiceTurno--; // el próximo avance cae en quien seguía
      this.eliminados.push(Object.assign({}, jugador, { motivo: motivo }));
      this._emitir('jugadorEliminado', { nombre: jugador.nombre, motivo: motivo, puntos: jugador.puntos });
      this._entrarDeEspera();
      return eraActual;
    }

    _marcarUltimoEnPie() {
      if (this.jugadores.length === 1) {
        this.ganador = this.jugadores[0];
        this.motivoFin = 'ultimo';
      } else if (this.jugadores.length === 0) {
        this.ganador = null;
        this.motivoFin = 'sinJugadores';
      }
    }

    /* ---------- Turnos ---------- */

    _siguienteTurno() {
      if (this.jugadores.length <= 1) { this._marcarUltimoEnPie(); this._terminar(); return; }
      this.indiceTurno = (this.indiceTurno + 1) % this.jugadores.length;
      this.subfase = 'turno';
      this.numeroTurno++;
      this.ultimaJugada = null;
      const j = this.jugadores[this.indiceTurno];
      this._programar(this.config.segundosTurno * 1000, () => this._tiempoAgotado());
      this._emitir('turno', { nombre: j.nombre, orden: this.indiceTurno + 1, numeroTurno: this.numeroTurno });
    }

    _procesarPrediccion(jugador, texto) {
      const prediccion = AL10.interpretarPrediccion(texto);
      if (!prediccion.valida) {
        this._emitir('prediccionInvalida', { nombre: jugador.nombre, texto: texto, motivo: prediccion.motivo });
        return { accion: 'invalida', motivo: prediccion.motivo };
      }

      this._cancelarTimer();
      const carta = this._sacarCarta();
      const resultado = AL10.calcularPuntos(prediccion, carta, this.config.puntos);
      jugador.puntos += resultado.puntos;
      jugador.sinResponder = 0;
      jugador.jugadas++;
      this.subfase = 'revelando';

      this.ultimaJugada = {
        nombre: jugador.nombre, texto: texto, prediccion: prediccion, carta: carta,
        resultado: resultado, puntosTotales: jugador.puntos, tiempoAgotado: false
      };
      this.historial.push(this.ultimaJugada);

      if (resultado.efecto === 'gana') {
        this.ganador = jugador; this.motivoFin = 'joker';
      } else if (resultado.efecto === 'eliminado') {
        this._eliminar(jugador, 'jokerDeCabeza');
      } else if (jugador.puntos >= this.config.puntajeObjetivo) {
        this.ganador = jugador; this.motivoFin = 'puntos';
      }
      if (!this.ganador && this.jugadores.length <= 1) this._marcarUltimoEnPie();

      this._emitir('revelacion', this.ultimaJugada);
      this._programar(this.config.pausaRevelacionMs, () => this._continuar());
      return { accion: 'prediccion', resultado: resultado, carta: carta };
    }

    _tiempoAgotado() {
      const j = this.jugadorActual();
      if (!j) { this._continuar(); return; }
      j.sinResponder++;
      this.subfase = 'pausa';
      this.ultimaJugada = { nombre: j.nombre, tiempoAgotado: true, sinResponder: j.sinResponder };
      this._emitir('tiempoAgotado', { nombre: j.nombre, sinResponder: j.sinResponder });
      if (j.sinResponder >= this.config.turnosSinResponderParaEliminar) {
        this._eliminar(j, 'sinResponder');
        if (this.jugadores.length <= 1) this._marcarUltimoEnPie();
      }
      this._programar(this.config.pausaTiempoAgotadoMs, () => this._continuar());
    }

    _continuar() {
      this._cancelarTimer();
      if (this.fase !== 'jugando') return;
      if (this.ganador || this.jugadores.length <= 1) {
        if (!this.ganador) this._marcarUltimoEnPie();
        this._terminar();
        return;
      }
      this._siguienteTurno();
    }

    _terminar() {
      this._cancelarTimer();
      this.fase = 'terminada';
      this.subfase = null;
      this._emitir('partidaTerminada', {
        ganador: this.ganador ? this.ganador.nombre : null,
        motivo: this.motivoFin,
        resumen: this.resumen()
      });
    }
  }

  AL10.Juego = Juego;
  AL10.relojReal = relojReal;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Juego, relojReal };
  }
})(typeof window !== 'undefined' ? window : globalThis);
