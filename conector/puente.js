/*
 * Puente: toma eventos de chat (de TikTok o del chat de prueba), los limpia,
 * aplica el límite de mensajes por segundo y los reenvía al juego.
 *
 * El jugador del turno (que la página avisa con { tipo: 'turno' }) nunca se descarta,
 * para que su predicción llegue aunque el chat esté muy movido.
 */
'use strict';

const { extraerComentario } = require('./limpieza');

function crearPuente(opciones) {
  const o = opciones || {};
  const enviar = o.enviar;
  const limitador = o.limitador;
  const alDescartar = o.alDescartar || function () {};
  let prioritario = null;

  return {
    /** Procesa un evento de chat. Devuelve el mensaje enviado o null. */
    procesar(evento) {
      const c = extraerComentario(evento, { mostrar: o.mostrar, largoMaximo: o.largoMaximo });
      if (!c) return null;
      const esDelTurno = prioritario !== null && c.usuario.toLowerCase() === prioritario;
      if (!esDelTurno && limitador && !limitador.permitir()) {
        alDescartar(c);
        return null;
      }
      const mensaje = { tipo: 'chat', usuario: c.usuario, nombre: c.nombre, texto: c.texto };
      enviar(mensaje);
      return mensaje;
    },
    /** Marca al usuario del turno actual (o null). */
    marcarTurno(usuario) {
      prioritario = typeof usuario === 'string' && usuario ? usuario.replace(/^@/, '').toLowerCase() : null;
    }
  };
}

module.exports = { crearPuente };
