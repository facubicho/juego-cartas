/*
 * Pantalla del jugador (celular) del modo sala online.
 * Todo el texto que viene de otros jugadores se pone con textContent (nunca como HTML).
 */
(function (global) {
  'use strict';
  const AL10 = global.AL10;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);

  const ERRORES = {
    nombreRepetido: 'Ese nombre ya lo usa otra persona en esta sala. Elegí otro.',
    nombreInvalido: 'Escribí un nombre.',
    salaNoExiste: 'Esa sala no existe o ya se cerró. Revisá el código.',
    salaLlena: 'La sala tiene demasiadas personas conectadas.',
    dispositivoInvalido: 'No se pudo identificar este celular. Recargá la página.'
  };
  const RESULTADOS = {
    invalida: 'No se entendió. Probá con un color, un palo, un número o "joker".',
    limite: 'Más despacio: esperá un segundo y probá de nuevo.',
    enEspera: 'La mesa está llena: quedaste en la lista de espera.'
  };
  const MOTIVOS = {
    salio: 'saliste de la mesa',
    sinResponder: 'no respondiste 2 turnos seguidos',
    jokerDeCabeza: 'te salió el Joker de cabeza'
  };

  /* ---------- Almacenamiento del navegador (solo este celular) ---------- */

  function guardar(clave, valor) { try { localStorage.setItem(clave, valor); } catch (e) { /* modo privado */ } }
  function leer(clave) { try { return localStorage.getItem(clave); } catch (e) { return null; } }
  function borrar(clave) { try { localStorage.removeItem(clave); } catch (e) { /* nada */ } }

  function idDispositivo() {
    let d = leer('al10-dispositivo');
    if (!d || !/^[A-Za-z0-9_-]{8,64}$/.test(d)) {
      const bytes = new Uint8Array(16);
      if (global.crypto && global.crypto.getRandomValues) global.crypto.getRandomValues(bytes);
      else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
      d = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      guardar('al10-dispositivo', d);
    }
    return d;
  }

  /* ---------- Estado ---------- */

  const dispositivo = idDispositivo();
  let codigo = (params.get('sala') || '').trim().toUpperCase();
  let nombre = leer('al10-nombre') || '';
  let yo = null;
  let estado = null;
  let recibidoEn = 0;
  let conexion = null;
  let eraMiTurno = false;

  function pts(n) { return n < 0 ? '−' + Math.abs(n) : String(n); }
  function el(tag, clase, texto) {
    const e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  /* ---------- Entrar ---------- */

  function mostrarEntrar(error) {
    $('pantalla-sala').hidden = true;
    $('pantalla-entrar').hidden = false;
    $('aviso-conexion').hidden = true;
    $('grupo-codigo').hidden = /^[A-Z]{4}$/.test(codigo) && !error;
    $('entrar-codigo').value = codigo;
    $('entrar-nombre').value = nombre;
    $('entrar-error').textContent = error || '';
    $('btn-entrar').disabled = false;
    $('btn-entrar').textContent = 'Entrar';
  }

  $('form-entrar').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const c = $('entrar-codigo').value.trim().toUpperCase();
    if (!$('grupo-codigo').hidden || !/^[A-Z]{4}$/.test(codigo)) codigo = c;
    nombre = $('entrar-nombre').value.replace(/\s+/g, ' ').trim().slice(0, 20);
    if (!/^[A-Z]{4}$/.test(codigo)) { $('grupo-codigo').hidden = false; $('entrar-error').textContent = 'El código de la sala tiene 4 letras.'; return; }
    if (!nombre) { $('entrar-error').textContent = ERRORES.nombreInvalido; return; }
    guardar('al10-nombre', nombre);
    $('btn-entrar').disabled = true;
    $('btn-entrar').textContent = 'Entrando…';
    conectar();
  });

  function conectar() {
    if (conexion) conexion.cerrar();
    conexion = AL10.crearConexionSala({
      url: AL10.urlServidorSalas(),
      alAbrir: (enviar) => enviar({ tipo: 'unirse', codigo, nombre, dispositivo }),
      alCambio: (ok) => { if (yo) $('aviso-conexion').hidden = ok; },
      alMensaje: alMensaje
    });
  }

  function salirDeLaSala(error) {
    if (conexion) conexion.cerrar();
    conexion = null;
    yo = null;
    estado = null;
    mostrarEntrar(error);
  }

  function alMensaje(m) {
    switch (m.tipo) {
      case 'bienvenida':
        yo = m.yo;
        guardar('al10-sala-' + codigo, '1');
        $('pantalla-entrar').hidden = true;
        $('pantalla-sala').hidden = false;
        $('aviso-conexion').hidden = true;
        $('yo-sala').textContent = codigo;
        $('yo-nombre').textContent = yo.nombre;
        history.replaceState(null, '', '?sala=' + codigo);
        break;
      case 'estado':
      case 'evento':
        estado = m.estado;
        recibidoEn = Date.now();
        render();
        break;
      case 'resultado':
        if (m.accion === 'prediccion') { $('prediccion').value = ''; aviso(''); }
        else if (RESULTADOS[m.accion]) aviso(RESULTADOS[m.accion]);
        break;
      case 'error':
        if (!yo) {
          if (m.error === 'salaNoExiste') borrar('al10-sala-' + codigo);
          salirDeLaSala(ERRORES[m.error] || 'No se pudo entrar a la sala.');
        } else {
          aviso(ERRORES[m.error] || '');
        }
        break;
      case 'salaCerrada':
        borrar('al10-sala-' + codigo);
        salirDeLaSala('La sala se cerró.');
        break;
      default:
        break;
    }
  }

  function aviso(texto) { $('prediccion-aviso').textContent = texto || ''; }

  /* ---------- Botones ---------- */

  function enviarTexto(texto) {
    if (!conexion || !conexion.enviar({ tipo: 'mensaje', texto })) aviso('Sin conexión. Esperá un momento…');
  }

  $('btn-anotarme').addEventListener('click', () => enviarTexto('!jugar'));
  $('btn-salir').addEventListener('click', () => {
    if (estado && estado.fase === 'jugando' && !confirm('¿Seguro que querés salir de la partida?')) return;
    enviarTexto('!salir');
  });

  $('form-prediccion').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const texto = $('prediccion').value.trim();
    if (!texto) { aviso('Escribí tu predicción o tocá un botón.'); return; }
    enviarTexto(texto);
  });

  document.querySelectorAll('.rapido').forEach((b) => {
    b.addEventListener('click', () => {
      const input = $('prediccion');
      input.value = AL10.completarPrediccion(input.value, b.dataset.tipo, b.dataset.valor);
    });
  });

  /* ---------- Dibujo ---------- */

  function miniCarta(carta) {
    const c = $('mini-carta');
    c.textContent = '';
    if (carta.tipo === 'joker') {
      c.className = 'mini-carta joker' + (carta.variante === 'cabeza' ? ' cabeza' : '');
      c.append(el('span', 'palo', '🃏'), el('span', '', carta.variante === 'cabeza' ? 'de cabeza' : 'derecho'));
      return;
    }
    const palo = AL10.PALO_POR_ID[carta.palo];
    c.className = 'mini-carta ' + palo.color;
    c.append(el('span', 'valor', AL10.etiquetaValor(carta.valor)), el('span', 'palo', palo.simbolo));
  }

  function dibujarUltima(u) {
    const cont = $('ultima-jugada');
    cont.textContent = '';
    if (!u) { $('bloque-carta').hidden = true; return; }
    if (u.tiempoAgotado) {
      $('bloque-carta').hidden = false;
      $('mini-carta').className = 'mini-carta';
      $('mini-carta').textContent = '⏰';
      cont.append(el('div', '', u.nombre + ': se le acabó el tiempo.'));
      return;
    }
    $('bloque-carta').hidden = false;
    miniCarta(u.carta);
    const r = u.resultado;
    cont.append(el('div', '', u.nombre + ': “' + u.texto + '”'));
    cont.append(el('div', '', AL10.describirCarta(u.carta)));
    let texto = (r.puntos > 0 ? '+' : '') + pts(r.puntos) + (Math.abs(r.puntos) === 1 ? ' punto' : ' puntos');
    if (r.efecto === 'gana') texto += ' ¡y gana!';
    if (r.efecto === 'eliminado') texto += ' y queda eliminado';
    if (r.pleno) texto = '¡Pleno! ' + texto;
    cont.append(el('div', r.puntos < 0 ? 'puntos-mal' : r.puntos > 0 ? 'puntos-bien' : '', texto));
  }

  function dibujarPuntajes(e) {
    const lista = $('lista-puntajes');
    lista.textContent = '';
    const filas = e.fase === 'terminada' && e.resumen
      ? e.resumen.map((f) => ({ nombre: f.nombre, puntos: f.puntos, eliminado: f.estado === 'eliminado', turno: false, yo: f.nombre === yo.nombre, ganador: f.estado === 'ganador' }))
      : e.jugadores.map((j) => ({ nombre: j.orden + '. ' + j.nombre, puntos: j.puntos, turno: j.esTurno, yo: j.clave === yo.id }))
          .concat(e.eliminados.map((x) => ({ nombre: x.nombre, puntos: x.puntos, eliminado: true, yo: x.clave === yo.id })));
    filas.forEach((f) => {
      const li = el('li', (f.turno ? 'turno ' : '') + (f.yo ? 'yo ' : '') + (f.eliminado ? 'eliminado' : ''));
      li.append(el('span', 'nombre', (f.ganador ? '🏆 ' : f.turno ? '▶ ' : '') + f.nombre), el('span', 'pts', pts(f.puntos)));
      lista.appendChild(li);
    });
    $('objetivo-texto').textContent = '(gana el primero en llegar a ' + e.config.puntajeObjetivo + ')';
    $('bloque-puntajes').hidden = !filas.length;
  }

  function render() {
    const e = estado;
    if (!e || !yo) return;
    const yoEnMesa = e.jugadores.find((j) => j.clave === yo.id) || null;
    const posEspera = (e.esperaIds || []).indexOf(yo.id);
    const eliminado = e.eliminados.find((x) => x.clave === yo.id) || null;
    const actual = e.jugadores.find((j) => j.esTurno) || null;
    const miTurno = !!(yoEnMesa && yoEnMesa.esTurno && e.fase === 'jugando' && e.subfase === 'turno');

    $('yo-puntos').textContent = pts(yoEnMesa ? yoEnMesa.puntos : eliminado ? eliminado.puntos : 0);
    $('bloque-estado').classList.toggle('mi-turno', miTurno);

    let titulo = '';
    let detalle = '';
    if (e.fase === 'espera') {
      titulo = 'Esperando al anfitrión';
      detalle = 'Cuando abra la inscripción vas a poder anotarte.';
    } else if (e.fase === 'inscripcion') {
      titulo = '¡Inscripción abierta!';
      detalle = 'Jugadores: ' + e.jugadores.length + '/' + e.config.maxJugadores;
      if (yoEnMesa) detalle += ' · Estás anotado (lugar ' + yoEnMesa.orden + ')';
      else if (posEspera >= 0) detalle += ' · Estás en la lista de espera (#' + (posEspera + 1) + ')';
    } else if (e.fase === 'jugando') {
      if (miTurno) titulo = '¡Es tu turno!';
      else if (e.subfase === 'turno' && actual) titulo = 'Turno de ' + actual.nombre;
      else if (e.subfase === 'revelando') titulo = 'Se dio vuelta la carta';
      else if (e.subfase === 'pausa') titulo = 'Se acabó el tiempo';
      else titulo = 'Partida en curso';
      if (miTurno) detalle = 'Escribí tu predicción o usá los botones.';
      else if (!yoEnMesa && posEspera >= 0) detalle = 'Estás en la lista de espera (#' + (posEspera + 1) + ').';
      else if (!yoEnMesa && eliminado) detalle = 'Quedaste fuera: ' + (MOTIVOS[eliminado.motivo] || eliminado.motivo) + '.';
      else if (!yoEnMesa) detalle = 'Estás mirando la partida.';
    } else if (e.fase === 'terminada') {
      titulo = e.ganador ? (e.ganador === yo.nombre ? '🏆 ¡Ganaste!' : '🏆 Ganó ' + e.ganador) : 'Partida terminada';
      detalle = 'Esperando que el anfitrión abra otra inscripción.';
    }
    $('estado-titulo').textContent = titulo;
    $('estado-detalle').textContent = detalle;
    $('reloj').hidden = !((e.fase === 'jugando' && e.subfase === 'turno') || e.fase === 'inscripcion');

    // Anotarme / Salir
    const puedeAnotarse = (e.fase === 'inscripcion' || e.fase === 'jugando') && !yoEnMesa && posEspera < 0;
    $('btn-anotarme').hidden = !puedeAnotarse;
    $('btn-anotarme').textContent = e.fase === 'inscripcion' ? 'Anotarme' : 'Anotarme (lista de espera)';
    $('btn-salir').hidden = !(yoEnMesa || posEspera >= 0) || e.fase === 'terminada';
    $('btn-salir').textContent = yoEnMesa ? 'Salir de la mesa' : 'Salir de la lista de espera';
    $('bloque-anotarse').hidden = $('btn-anotarme').hidden;
    $('bloque-salir').hidden = $('btn-salir').hidden;

    // Predicción: solo se habilita en mi turno
    $('bloque-prediccion').hidden = !(e.fase === 'jugando' && yoEnMesa);
    $('prediccion').disabled = !miTurno;
    $('bloque-prediccion').classList.toggle('esperando', !miTurno); // fuera de turno: cuadro deshabilitado y compacto
    $('btn-enviar').disabled = !miTurno;
    document.querySelectorAll('.rapido').forEach((b) => { b.disabled = !miTurno; });
    $('prediccion-etiqueta').textContent = miTurno ? 'Tu predicción' : (actual && e.subfase === 'turno' ? 'Le toca a ' + actual.nombre : 'Esperá tu turno');
    if (miTurno && !eraMiTurno) {
      aviso('');
      if (navigator.vibrate) { try { navigator.vibrate(150); } catch (err) { /* nada */ } }
    }
    eraMiTurno = miTurno;

    dibujarUltima(e.fase === 'jugando' || e.fase === 'terminada' ? e.ultimaJugada : null);
    if (e.fase === 'jugando' || e.fase === 'terminada' || e.fase === 'inscripcion') dibujarPuntajes(e);
    else $('bloque-puntajes').hidden = true;
    actualizarReloj();
  }

  function actualizarReloj() {
    if (!estado) return;
    const resta = Math.max(0, (estado.restanteMs || 0) - (Date.now() - recibidoEn));
    const seg = Math.ceil(resta / 1000);
    $('reloj-numero').textContent = seg;
    $('reloj').classList.toggle('urgente', estado.fase === 'jugando' && seg <= 3);
  }
  setInterval(actualizarReloj, 200);

  /* ---------- Arranque ---------- */

  // Si este celular ya estaba en la sala, vuelve a entrar solo (recupera su lugar).
  if (/^[A-Z]{4}$/.test(codigo) && leer('al10-sala-' + codigo)) {
    conectar();
  } else {
    mostrarEntrar('');
  }
})(window);
