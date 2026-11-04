/*
 * Interfaz: dibuja el estado del motor y anima la carta.
 * No contiene reglas del juego: solo lee juego.estado() y escucha eventos.
 */
(function (global) {
  'use strict';
  const AL10 = (global.AL10 = global.AL10 || {});

  const $ = (id) => document.getElementById(id);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  const MOTIVOS_ELIMINACION = {
    salio: 'se fue de la mesa',
    sinResponder: 'no respondió 2 turnos seguidos',
    jokerDeCabeza: 'Joker de cabeza'
  };

  const MOTIVOS_FIN = {
    puntos: (n, obj) => 'Llegó a ' + n + ' puntos (objetivo: ' + obj + ')',
    joker: () => '¡Anunció Joker y salió el Joker derecho!',
    ultimo: () => 'Quedó como último jugador en la mesa',
    sinJugadores: () => 'No quedaron jugadores en la mesa'
  };

  const MOTIVOS_INVALIDA = {
    vacia: 'no se entendió',
    ambigua: 'es ambigua',
    contradictoria: 'se contradice',
    fueraDeRango: 'número fuera de rango (1 a 13)'
  };

  /** Puntos con signo menos tipográfico (y + opcional): -9 -> "−9", 9 -> "+9". */
  function pts(n, conMas) {
    if (n < 0) return '−' + Math.abs(n);
    return (conMas && n > 0 ? '+' : '') + n;
  }

  /* ---------- Carta ---------- */

  const SVG_JOKER =
    '<svg class="joker-svg" viewBox="0 0 100 120" aria-hidden="true">' +
    '<path d="M18 52 L30 14 L50 46 L70 14 L82 52 Z" fill="#c62828" stroke="#222" stroke-width="2"/>' +
    '<path d="M50 46 L40 18 L50 8 L60 18 Z" fill="#1e5bb8" stroke="#222" stroke-width="2"/>' +
    '<circle cx="30" cy="12" r="6" fill="#f4c430" stroke="#222" stroke-width="2"/>' +
    '<circle cx="70" cy="12" r="6" fill="#f4c430" stroke="#222" stroke-width="2"/>' +
    '<circle cx="50" cy="7" r="6" fill="#f4c430" stroke="#222" stroke-width="2"/>' +
    '<rect x="16" y="50" width="68" height="10" rx="4" fill="#f4c430" stroke="#222" stroke-width="2"/>' +
    '<ellipse cx="50" cy="80" rx="24" ry="22" fill="#fde3c8" stroke="#222" stroke-width="2"/>' +
    '<circle cx="41" cy="75" r="3.5" fill="#222"/><circle cx="59" cy="75" r="3.5" fill="#222"/>' +
    '<path d="M38 88 Q50 100 62 88" fill="none" stroke="#c62828" stroke-width="3" stroke-linecap="round"/>' +
    '<circle cx="50" cy="82" r="4" fill="#e53935"/>' +
    '<path d="M24 100 L36 108 L50 100 L64 108 L76 100 L70 118 L30 118 Z" fill="#1e5bb8" stroke="#222" stroke-width="2"/>' +
    '</svg>';

  function htmlCarta(carta) {
    if (carta.tipo === 'joker') {
      const cabeza = carta.variante === 'cabeza';
      return (
        '<div class="cf joker ' + (cabeza ? 'joker-cabeza' : 'joker-derecho') + '">' +
          '<div class="joker-contenido">' +
            '<div class="esquina sup joker-letras">J<br>O<br>K<br>E<br>R</div>' +
            SVG_JOKER +
            '<div class="joker-nombre">JOKER</div>' +
            '<div class="esquina inf joker-letras">J<br>O<br>K<br>E<br>R</div>' +
          '</div>' +
        '</div>'
      );
    }
    const palo = AL10.PALO_POR_ID[carta.palo];
    const v = AL10.etiquetaValor(carta.valor);
    const figura = carta.valor >= 11 || carta.valor === 1;
    const centro = figura
      ? '<div class="figura"><span class="figura-letra">' + v + '</span><span class="figura-palo">' + palo.simbolo + '</span></div>'
      : '<div class="centro-palo">' + palo.simbolo + '</div>';
    const esquina = '<span class="esq-valor">' + v + '</span><span class="esq-palo">' + palo.simbolo + '</span>';
    return (
      '<div class="cf normal ' + palo.color + '">' +
        '<div class="esquina sup">' + esquina + '</div>' +
        centro +
        '<div class="esquina inf">' + esquina + '</div>' +
      '</div>'
    );
  }

  /* ---------- Cafecito ---------- */

  /** "https://cafecito.app/facubicho" -> "cafecito.app/facubicho" */
  function linkVisible(url) {
    return String(url || '').replace(/^https?:\/\//i, '').replace(/\/$/, '');
  }

  /** QR en SVG generado en la página (librería incluida en js/vendor, sin servicios externos). */
  function svgQR(url) {
    if (typeof global.qrcode !== 'function') return '';
    const qr = global.qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    return qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true, alt: 'Código QR de ' + linkVisible(url) });
  }

  /* ---------- UI ---------- */

  function crearUI(juego) {
    const cfg = juego.config;
    const R = 2 * Math.PI * 52; // perímetro del reloj

    // Textos que dependen de la configuración
    $('titulo-objetivo').textContent = cfg.puntajeObjetivo;
    document.querySelectorAll('.objetivo').forEach((el) => { el.textContent = cfg.puntajeObjetivo; });
    document.querySelectorAll('.max-jugadores').forEach((el) => { el.textContent = cfg.maxJugadores; });
    document.querySelectorAll('.segundos-turno').forEach((el) => { el.textContent = cfg.segundosTurno; });
    document.querySelectorAll('.resta-cabeza').forEach((el) => { el.textContent = Math.abs(cfg.puntos.jokerNoAnunciadoCabeza); });
    document.querySelectorAll('.comando').forEach((el) => { el.textContent = cfg.comandoJugar; });
    document.title = 'Adiviná y llegá a ' + cfg.puntajeObjetivo;
    dibujarTablaPuntos(cfg);
    prepararCafecito(cfg.cafecito);

    $('btn-abrir').addEventListener('click', () => juego.abrirInscripcion());
    $('btn-empezar').addEventListener('click', () => juego.iniciarPartida());
    $('btn-nueva').addEventListener('click', () => juego.abrirInscripcion());

    $('reloj-arco').style.strokeDasharray = R;

    juego.on(function (tipo, datos) {
      switch (tipo) {
        case 'inscripcionAbierta':
          aviso('¡Inscripción abierta! Escribí ' + cfg.comandoJugar, 'info');
          break;
        case 'jugadorInscripto':
          aviso('@' + datos.nombre + ' se sentó en la mesa (#' + datos.orden + ')', 'ok');
          break;
        case 'mesaLlena':
          aviso(datos.enEspera
            ? 'Mesa llena: @' + datos.nombre + ' queda en lista de espera (#' + datos.posicion + ')'
            : 'Mesa llena: @' + datos.nombre + ' queda de espectador', 'alerta');
          break;
        case 'faltanJugadores':
          aviso('Se necesitan al menos ' + datos.minimo + ' jugadores. ¡Se extiende la inscripción!', 'alerta');
          break;
        case 'partidaIniciada':
          aviso('¡Empieza la partida!', 'info');
          break;
        case 'turno':
          prepararCartaDorso();
          break;
        case 'prediccionInvalida':
          // Si no nombró ningún color, palo o número es charla: no se avisa (no llenar el panel).
          if (datos.motivo === 'vacia') break;
          aviso('@' + datos.nombre + ': “' + datos.texto + '” ' + (MOTIVOS_INVALIDA[datos.motivo] || 'no es válida') + '. ¡Probá de nuevo!', 'alerta');
          break;
        case 'revelacion':
          revelarCarta(datos.carta);
          if (datos.resultado.jokerSorpresa && datos.resultado.puntos < 0) {
            aviso('🙃 Joker de cabeza sin anunciar: @' + datos.nombre + ' pierde ' + Math.abs(datos.resultado.puntos) + ' puntos (' + pts(datos.resultado.puntos) + ')', 'error');
          }
          break;
        case 'jugadorEliminado':
          aviso('@' + datos.nombre + ' sale de la mesa: ' + (MOTIVOS_ELIMINACION[datos.motivo] || datos.motivo), 'error');
          break;
        case 'cafecito':
          aviso('☕ ¿Te gusta el juego? Invitame un cafecito: ' + linkVisible(datos.url), 'cafe');
          break;
        case 'entraDeEspera':
          aviso('@' + datos.nombre + ' entra desde la lista de espera', 'ok');
          break;
        default:
          break;
      }
      render();
    });

    /* ----- Carta ----- */

    function prepararCartaDorso() {
      $('carta').classList.remove('volteada');
    }

    function revelarCarta(carta) {
      const el = $('carta');
      el.classList.remove('volteada');
      $('carta-frente').innerHTML = htmlCarta(carta);
      void el.offsetWidth; // reinicia la transición
      requestAnimationFrame(() => el.classList.add('volteada'));
    }

    /* ----- Avisos ----- */

    function aviso(texto, tipo) {
      const cont = $('avisos');
      const div = document.createElement('div');
      div.className = 'aviso aviso-' + (tipo || 'info');
      div.textContent = texto;
      cont.prepend(div);
      while (cont.children.length > 5) cont.lastChild.remove();
    }

    /* ----- Render general ----- */

    function render() {
      const e = juego.estado();
      document.body.dataset.fase = e.fase;

      $('vista-espera').classList.toggle('activa', e.fase === 'espera');
      $('vista-inscripcion').classList.toggle('activa', e.fase === 'inscripcion');
      $('vista-juego').classList.toggle('activa', e.fase === 'jugando' || e.fase === 'terminada');
      $('overlay-ganador').classList.toggle('activa', e.fase === 'terminada');

      $('estado-fase').innerHTML = textoFase(e);
      dibujarAsientos(e);
      dibujarEspera(e);

      if (e.fase === 'inscripcion') {
        $('inscripcion-info').innerHTML =
          'Jugadores: <b>' + e.jugadores.length + '/' + cfg.maxJugadores + '</b> · mínimo ' + cfg.minJugadores;
        $('btn-empezar').disabled = e.jugadores.length < cfg.minJugadores;
      }
      if (e.fase === 'jugando' || e.fase === 'terminada') dibujarJugada(e);
      if (e.fase === 'terminada') dibujarGanador(e);
      actualizarRelojes();
    }

    function textoFase(e) {
      switch (e.fase) {
        case 'espera': return 'Esperando para abrir la mesa';
        case 'inscripcion': return 'Inscripción abierta';
        case 'jugando': return 'Turno ' + e.numeroTurno + ' · Jugadores: ' + e.jugadores.length;
        case 'terminada': return 'Partida terminada';
        default: return '';
      }
    }

    function dibujarAsientos(e) {
      const cont = $('asientos');
      const lugares = cfg.maxJugadores;
      const cx = 700, cy = 470, rx = 600, ry = 385;
      let html = '';
      for (let i = 0; i < lugares; i++) {
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / lugares;
        const x = cx + rx * Math.cos(ang);
        const y = cy + ry * Math.sin(ang);
        const j = e.jugadores[i];
        const estilo = 'left:' + x.toFixed(1) + 'px;top:' + y.toFixed(1) + 'px';
        if (!j) {
          html += '<div class="asiento libre" style="' + estilo + '"><span class="asiento-libre">Libre</span></div>';
          continue;
        }
        const progreso = Math.max(0, Math.min(100, (j.puntos / cfg.puntajeObjetivo) * 100));
        const restaRecien = e.subfase === 'revelando' && e.ultimaJugada && e.ultimaJugada.nombre === j.nombre &&
          e.ultimaJugada.resultado && e.ultimaJugada.resultado.puntos < 0;
        const esGanador = e.ganador && e.ganador === j.nombre;
        const alerta = j.sinResponder > 0
          ? '<span class="asiento-alerta" title="Turnos sin responder">⏰ ' + j.sinResponder + '/' + cfg.turnosSinResponderParaEliminar + '</span>'
          : '';
        html +=
          '<div class="asiento' + (j.esTurno ? ' turno' : '') + (esGanador ? ' ganador' : '') + (restaRecien ? ' resta' : '') + '" style="' + estilo + '">' +
            '<span class="asiento-orden">' + j.orden + '</span>' +
            alerta +
            '<div class="asiento-nombre">@' + esc(j.nombre) + '</div>' +
            '<div class="asiento-puntos' + (j.puntos < 0 ? ' negativo' : '') + '">' + pts(j.puntos) + '<small> pts</small></div>' +
            '<div class="asiento-barra"><i style="width:' + progreso + '%"></i></div>' +
          '</div>';
      }
      cont.innerHTML = html;
    }

    function dibujarEspera(e) {
      const cont = $('lista-espera');
      if (!cfg.listaDeEspera) { cont.innerHTML = '<span class="vacio">Desactivada</span>'; return; }
      if (!e.espera.length) { cont.innerHTML = '<span class="vacio">Nadie esperando</span>'; return; }
      cont.innerHTML = e.espera.slice(0, 5).map((n, i) => '<div><b>' + (i + 1) + '.</b> @' + esc(n) + '</div>').join('') +
        (e.espera.length > 5 ? '<div class="vacio">y ' + (e.espera.length - 5) + ' más…</div>' : '');
    }

    function chip(texto, estado) {
      const clase = estado === true ? 'chip acierto' : estado === false ? 'chip error' : 'chip';
      const marca = estado === true ? ' ✔' : estado === false ? ' ✘' : '';
      return '<span class="' + clase + '">' + texto + marca + '</span>';
    }

    function dibujarJugada(e) {
      const actual = e.jugadores.find((j) => j.esTurno);
      const u = e.ultimaJugada;

      if (e.subfase === 'turno' && actual) {
        $('info-turno').innerHTML = 'Turno de <b>@' + esc(actual.nombre) + '</b> <span class="orden">#' + actual.orden + '</span>';
        $('prediccion').innerHTML = '<span class="esperando">Escribí tu predicción en el chat…</span>';
        $('resultado').innerHTML = '';
        $('reloj').classList.add('activo');
        return;
      }
      $('reloj').classList.remove('activo');
      if (!u) return;

      if (u.tiempoAgotado) {
        $('info-turno').innerHTML = 'Turno de <b>@' + esc(u.nombre) + '</b>';
        $('prediccion').innerHTML = '';
        $('resultado').innerHTML =
          '<div class="res-titulo res-malo">⏰ ¡Se acabó el tiempo!</div>' +
          '<div class="res-detalle">Pierde el turno (' + u.sinResponder + '/' + cfg.turnosSinResponderParaEliminar + ' sin responder)</div>';
        return;
      }

      const p = u.prediccion;
      const r = u.resultado;
      const c = u.carta;
      $('info-turno').innerHTML = 'Turno de <b>@' + esc(u.nombre) + '</b>';

      let chips = '<span class="dijo">“' + esc(u.texto) + '”</span>';
      if (p.joker) {
        chips += chip('🃏 Joker', c.tipo === 'joker' ? true : false);
      } else {
        if (p.numero !== null) chips += chip('Número: ' + AL10.etiquetaValor(p.numero), r.aciertos.numero);
        if (p.palo) chips += chip('Palo: ' + AL10.PALO_POR_ID[p.palo].simbolo + ' ' + AL10.PALO_POR_ID[p.palo].nombre, r.aciertos.palo);
        if (p.color) chips += chip('Color: ' + (p.color === 'rojo' ? 'Rojo' : 'Negro') + (p.colorPorPalo ? ' (por el palo)' : ''), r.aciertos.color);
      }
      $('prediccion').innerHTML = chips;

      let titulo, clase = r.puntos > 0 ? 'res-bueno' : r.puntos < 0 ? 'res-malo' : 'res-neutro';
      if (r.efecto === 'gana') titulo = '¡JOKER DERECHO!<br>' + pts(r.puntos, true) + ' y gana';
      else if (r.efecto === 'eliminado') titulo = 'JOKER DE CABEZA<br>' + pts(r.puntos) + ' y queda eliminado';
      else if (r.jokerSorpresa && r.puntos < 0) { titulo = '¡Joker de cabeza!<br>' + pts(r.puntos) + ' puntos'; clase += ' res-resta'; }
      else if (r.jokerSorpresa) titulo = '¡Joker sorpresa!<br>' + pts(r.puntos, true);
      else if (r.pleno) titulo = '¡PLENO!<br>' + pts(r.puntos, true);
      else titulo = pts(r.puntos, true) + (r.puntos === 1 ? ' punto' : ' puntos');

      $('resultado').innerHTML =
        '<div class="res-carta">' + esc(AL10.describirCarta(c)) + '</div>' +
        '<div class="res-titulo ' + clase + '">' + titulo + '</div>' +
        '<div class="res-detalle">Total: <b>' + pts(u.puntosTotales) + '</b> pts</div>';
    }

    function dibujarGanador(e) {
      const motivo = MOTIVOS_FIN[e.motivoFin];
      const ganadorFila = e.resumen.find((f) => f.estado === 'ganador');
      $('ganador-titulo').innerHTML = e.ganador ? '¡Ganó <b>@' + esc(e.ganador) + '</b>!' : 'Partida terminada';
      $('ganador-motivo').textContent = motivo ? motivo(ganadorFila ? ganadorFila.puntos : 0, cfg.puntajeObjetivo) : '';
      $('ganador-tabla').innerHTML =
        '<tr><th>#</th><th>Jugador</th><th>Puntos</th><th>Estado</th></tr>' +
        e.resumen.map((f, i) =>
          '<tr class="' + (f.estado === 'ganador' ? 'fila-ganador' : f.estado === 'eliminado' ? 'fila-eliminado' : '') + '">' +
            '<td>' + (i + 1) + '</td><td>@' + esc(f.nombre) + '</td><td>' + pts(f.puntos) + '</td>' +
            '<td>' + (f.estado === 'ganador' ? '🏆 Ganador' : f.estado === 'eliminado' ? 'Eliminado (' + (MOTIVOS_ELIMINACION[f.motivo] || f.motivo) + ')' : 'En mesa') + '</td>' +
          '</tr>').join('');
    }

    /* ----- Relojes (se actualizan en cada cuadro) ----- */

    function actualizarRelojes() {
      const e = juego;
      const restanteMs = e.finEn ? Math.max(0, e.finEn - e.reloj.ahora()) : 0;
      if (e.fase === 'inscripcion') {
        $('inscripcion-segundos').textContent = Math.ceil(restanteMs / 1000);
      }
      if (e.fase === 'jugando' && e.subfase === 'turno') {
        const total = cfg.segundosTurno * 1000;
        const seg = Math.ceil(restanteMs / 1000);
        $('reloj-numero').textContent = seg;
        $('reloj-arco').style.strokeDashoffset = R * (1 - restanteMs / total);
        $('reloj').classList.toggle('urgente', seg <= 3);
      }
    }

    (function bucle() {
      actualizarRelojes();
      requestAnimationFrame(bucle);
    })();

    function dibujarTablaPuntos(c) {
      const P = c.puntos;
      const filas = [
        ['Color', '+' + P.color],
        ['Palo <small>(+' + P.color + ' del color)</small>', '+' + (P.palo + P.color)],
        ['Número', '+' + P.numero],
        ['Pleno <small>(número + palo)</small>', '+' + (P.color + P.palo + P.numero)],
        ['Dijiste “joker” y sale el <b>Joker derecho</b>', '+' + P.jokerAnunciadoDerecho + ' ¡gana!', 'fila-joker'],
        ['Dijiste “joker” y sale el <b>Joker de cabeza</b>', P.jokerAnunciadoCabeza + ' eliminado', 'fila-joker'],
        ['Sale el <b>Joker derecho</b> sin anunciarlo', pts(P.jokerNoAnunciadoDerecho, true), 'fila-joker'],
        ['Sale el <b>Joker de cabeza</b> sin anunciarlo', pts(P.jokerNoAnunciadoCabeza), 'fila-joker']
      ];
      $('tabla-puntos').innerHTML = filas.map((f) =>
        '<tr class="' + (f[2] || '') + '"><td>' + f[0] + '</td><td>' + f[1].replace('-', '−') + '</td></tr>').join('');
    }

    render();
    /* ----- Cafecito ----- */

    function prepararCafecito(c) {
      const activo = !!(c && c.activo && c.url);
      document.body.classList.toggle('sin-cafecito', !activo);
      if (!activo) return;
      document.querySelectorAll('.cafecito-link').forEach((el) => { el.textContent = linkVisible(c.url); });
      document.querySelectorAll('a.cafecito-enlace').forEach((el) => { el.href = c.url; }); // el link sale de js/config.js
      $('cafecito-qr').innerHTML = svgQR(c.url);
    }

    return { render: render, aviso: aviso };
  }

  AL10.crearUI = crearUI;
  AL10.htmlCarta = htmlCarta;
  AL10.linkVisible = linkVisible;
})(typeof window !== 'undefined' ? window : globalThis);
