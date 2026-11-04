/*
 * Modo sala online — pantalla del anfitrión.
 *
 *  - "Crear sala" (solo aparece si la página la sirve el servidor de salas).
 *  - Con ?anfitrion=ABCD: la mesa se dibuja con el estado que manda el servidor,
 *    y se muestran el código, el link (con QR y botón para copiar) y los conectados.
 */
(function (global) {
  'use strict';
  const AL10 = (global.AL10 = global.AL10 || {});
  const $ = (id) => document.getElementById(id);
  const CLAVE_TOKEN = (codigo) => 'al10-anfitrion-' + codigo;

  const ERRORES = {
    salaNoExiste: 'Esta sala ya no existe (se cierra sola después de un rato sin uso).',
    noAutorizado: 'Este navegador no es el que creó la sala, así que no puede manejarla.',
    demasiadasSalas: 'Hay demasiadas salas abiertas en este momento. Probá de nuevo en un rato.',
    salaLlena: 'La sala tiene demasiadas personas conectadas.'
  };

  function guardar(clave, valor) { try { localStorage.setItem(clave, valor); } catch (e) { /* modo privado */ } }
  function leer(clave) { try { return localStorage.getItem(clave); } catch (e) { return null; } }

  /**
   * Base del link para los celulares. Si el anfitrión abrió "localhost", ese link no les sirve:
   * se usa la dirección de la PC en la wifi que informa el servidor.
   */
  function baseLink(datosServidor) {
    const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    const wifi = datosServidor && datosServidor.direccionesLocales && datosServidor.direccionesLocales[0];
    return local && wifi ? wifi : location.origin;
  }
  function linkJugador(codigo, datosServidor) { return baseLink(datosServidor) + '/s/' + codigo; }

  /** Muestra "Crear sala" si hay un servidor de salas detrás. */
  function ofrecerCrearSala() {
    const boton = $('btn-crear-sala');
    if (!boton || !/^https?:$/.test(location.protocol)) return;
    fetch('/api/salud', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || !d.ok) return;
        boton.hidden = false;
        boton.addEventListener('click', () => crearSala(boton));
      })
      .catch(() => {});
  }

  function crearSala(boton) {
    boton.disabled = true;
    boton.textContent = 'Creando sala…';
    const ws = new WebSocket(AL10.urlServidorSalas());
    ws.onopen = () => ws.send(JSON.stringify({ tipo: 'crearSala' }));
    ws.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.tipo === 'salaCreada') {
        guardar(CLAVE_TOKEN(m.codigo), m.token);
        ws.close();
        location.href = '/?anfitrion=' + encodeURIComponent(m.codigo);
      } else if (m.tipo === 'error') {
        ws.close();
        boton.disabled = false;
        boton.textContent = 'Crear sala online';
        alert(ERRORES[m.error] || 'No se pudo crear la sala.');
      }
    };
    ws.onerror = () => {
      boton.disabled = false;
      boton.textContent = 'Crear sala online';
      alert('No se pudo conectar con el servidor.');
    };
  }

  function copiar(texto, boton) {
    const listo = () => { boton.textContent = '¡Copiado!'; setTimeout(() => { boton.textContent = 'Copiar link'; }, 2000); };
    if (navigator.clipboard && global.isSecureContext) {
      navigator.clipboard.writeText(texto).then(listo, () => copiarViejo(texto, listo));
    } else {
      copiarViejo(texto, listo);
    }
  }

  function copiarViejo(texto, listo) {
    const area = document.createElement('textarea');
    area.value = texto;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try { document.execCommand('copy'); listo(); } catch (e) { prompt('Copiá el link:', texto); }
    area.remove();
  }

  function mostrarError(texto) {
    $('sala-error-texto').textContent = texto;
    $('sala-error').classList.add('activa');
  }

  /** Arranca la pantalla del anfitrión para la sala `codigo`. */
  function iniciarModoAnfitrion(codigo) {
    document.body.classList.add('modo-sala', 'sin-dev');
    const token = leer(CLAVE_TOKEN(codigo));
    if (!token) {
      mostrarError(ERRORES.noAutorizado);
      return;
    }

    let conexion = null;
    const remoto = AL10.crearJuegoRemoto((accion) => conexion && conexion.enviar({ tipo: 'accion', accion }));
    let ui = null;
    $('tarjeta-sala').hidden = false;
    fetch('/api/salud', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((datos) => mostrarLink(linkJugador(codigo, datos)));

    function mostrarLink(link) {
      $('sala-codigo').textContent = codigo;
      $('sala-link').textContent = link.replace(/^https?:\/\//, '');
      $('btn-copiar').addEventListener('click', () => copiar(link, $('btn-copiar')));
      const qr = AL10.svgQR ? AL10.svgQR(link) : '';
      $('sala-qr').innerHTML = qr;
      const cartel = $('cartel-inscripcion');
      cartel.textContent = '';
      cartel.append('Entrá a ');
      const b = document.createElement('span');
      b.className = 'comando-sala';
      b.textContent = link.replace(/^https?:\/\//, '');
      cartel.append(b, ' y tocá Anotarme');
    }
    document.title = 'Sala ' + codigo + ' — Adiviná y llegá a 10';

    function dibujarPersonas(estado) {
      const personas = (estado.sala && estado.sala.personas) || [];
      const enMesa = new Set(estado.jugadores.map((j) => j.clave));
      const enEspera = new Set(estado.esperaIds || []);
      const conectadas = personas.filter((p) => p.conectado).length;
      $('sala-cantidad').textContent = conectadas;
      const cont = $('sala-personas');
      cont.textContent = '';
      if (!personas.length) {
        const v = document.createElement('span');
        v.className = 'vacio';
        v.textContent = 'Todavía no entró nadie';
        cont.appendChild(v);
        return;
      }
      personas.forEach((p) => {
        const chip = document.createElement('span');
        chip.className = 'sala-persona' + (p.conectado ? ' conectada' : '') + (enMesa.has(p.id) ? ' en-mesa' : '') + (enEspera.has(p.id) ? ' en-espera' : '');
        chip.textContent = p.nombre;
        chip.title = (p.conectado ? 'Conectado' : 'Desconectado') + (enMesa.has(p.id) ? ' · en la mesa' : enEspera.has(p.id) ? ' · en lista de espera' : '');
        cont.appendChild(chip);
      });
    }

    function alEstado(estado) {
      remoto.actualizar(estado);
      if (!ui) ui = AL10.crearUI(remoto);
      dibujarPersonas(estado);
    }

    conexion = AL10.crearConexionSala({
      url: AL10.urlServidorSalas(),
      alAbrir: (enviar) => enviar({ tipo: 'anfitrion', codigo, token }),
      alCambio: (ok) => document.body.classList.toggle('sala-desconectada', !ok),
      alMensaje: (m) => {
        if (m.tipo === 'estado') {
          alEstado(m.estado);
          if (ui) ui.render();
        } else if (m.tipo === 'evento') {
          alEstado(m.estado);
          remoto.emitir(m.evento, m.datos); // la interfaz dibuja (y anima) igual que en modo local
        } else if (m.tipo === 'error') {
          mostrarError(ERRORES[m.error] || 'Error: ' + m.error);
          conexion.cerrar();
        } else if (m.tipo === 'salaCerrada') {
          mostrarError(ERRORES.salaNoExiste);
          conexion.cerrar();
        }
      }
    });
    global.salaRemota = remoto;
  }

  AL10.ofrecerCrearSala = ofrecerCrearSala;
  AL10.iniciarModoAnfitrion = iniciarModoAnfitrion;
})(typeof window !== 'undefined' ? window : globalThis);
