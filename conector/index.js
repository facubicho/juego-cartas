#!/usr/bin/env node
/*
 * Conector del chat de TikTok LIVE con el juego "Adiviná y llegá a 10".
 *
 *   npm run conector       -> se conecta al live del usuario configurado en .env
 *   npm run chat:prueba    -> chat de prueba con usuarios falsos (sin TikTok)
 *
 * Los comentarios se mandan a la página del juego por ws://localhost:PUERTO.
 * Abrí el juego con ?chat=ws://localhost:8080 para recibirlos.
 */
'use strict';

const { cargarConfig, RUTA_ENV } = require('./config');
const { crearServidorWs } = require('./servidor-ws');
const { crearLimitador } = require('./limitador');
const { crearPuente } = require('./puente');
const { crearReconectador } = require('./reconexion');
const { crearFuentePrueba } = require('./fuente-prueba');

function hora() {
  return new Date().toLocaleTimeString('es-AR', { hour12: false });
}
function log(...partes) { console.log('[' + hora() + ']', ...partes); }
function segundos(ms) { return Math.round(ms / 1000) + ' s'; }

async function main() {
  const cfg = cargarConfig({ argv: process.argv.slice(2), env: process.env });

  console.log('');
  console.log('  Adiviná y llegá a 10 — conector de chat');
  console.log('  ----------------------------------------');

  if (!cfg.prueba && !cfg.usuario) {
    console.log('');
    console.log('  Falta configurar tu usuario de TikTok.');
    console.log('  1. Copiá el archivo .env.example y renombrá la copia a .env');
    console.log('  2. Abrí .env con el Bloc de notas y poné tu usuario en TIKTOK_USUARIO');
    console.log('     (sin @, por ejemplo: TIKTOK_USUARIO=mi_usuario)');
    console.log('  3. Guardá y volvé a correr: npm run conector');
    console.log('');
    console.log('  Archivo esperado: ' + RUTA_ENV);
    console.log('  Para probar sin live: npm run chat:prueba');
    console.log('');
    process.exitCode = 1;
    return;
  }

  const origen = cfg.prueba ? 'el chat de prueba' : 'el live de @' + cfg.usuario;
  let fuente = null;
  let puente = null;

  let servidor;
  try {
    servidor = await crearServidorWs({
      puerto: cfg.puerto,
      alMensaje: (m) => {
        // La página avisa de quién es el turno: ese jugador nunca se descarta por el límite.
        if (m.tipo === 'turno') {
          puente.marcarTurno(m.usuario || null);
          if (fuente && fuente.alTurno) fuente.alTurno(m.usuario);
        }
      },
      alCliente: (n) => log(n === 1 ? 'Página del juego conectada.' : 'Páginas del juego conectadas: ' + n)
    });
  } catch (err) {
    if (err && err.code === 'EADDRINUSE') {
      console.log('\n  El puerto ' + cfg.puerto + ' ya está en uso. ¿Quedó otro conector abierto?');
      console.log('  Cerralo, o elegí otro puerto en .env (PUERTO=8081) y abrí el juego con ?chat=ws://localhost:8081\n');
    } else {
      console.log('\n  No se pudo abrir el servidor local:', err && err.message, '\n');
    }
    process.exitCode = 1;
    return;
  }

  const limitador = crearLimitador({ maxPorSegundo: cfg.maxPorSegundo });
  puente = crearPuente({
    enviar: (m) => servidor.difundir(m),
    limitador,
    mostrar: cfg.mostrar,
    largoMaximo: cfg.largoMaximo
  });

  const estado = (tiktok, detalle) => servidor.difundirEstado({
    tiktok, detalle: detalle || null, usuario: cfg.prueba ? 'chat de prueba' : cfg.usuario, prueba: cfg.prueba
  });

  log('Servidor listo en ws://localhost:' + servidor.puerto);
  log('Abrí el juego con: index.html?dev=0&chat=ws://localhost:' + servidor.puerto);
  log('Origen del chat: ' + (cfg.prueba ? 'chat de prueba (usuarios falsos)' : '@' + cfg.usuario) + ' · se muestra el ' + (cfg.mostrar === 'apodo' ? 'apodo' : 'nombre de usuario') +
    ' · máximo ' + cfg.maxPorSegundo + ' mensajes por segundo');

  let reconectador = null;
  const alCorte = (info) => {
    log('Se cortó la conexión con ' + origen + (info && info.reason ? ' (' + info.reason + ')' : '') + '.');
    estado('reconectando');
    reconectador.seCorto('corte');
  };

  if (cfg.prueba) {
    fuente = crearFuentePrueba({ alComentario: (e) => puente.procesar(e), alCorte, cortes: cfg.cortes });
  } else {
    const { crearFuenteTikTok } = require('./fuente-tiktok');
    fuente = await crearFuenteTikTok({
      usuario: cfg.usuario,
      alComentario: (e) => puente.procesar(e),
      alCorte,
      alError: (err) => log('Aviso de la librería:', (err && (err.info || err.message)) || err)
    });
  }

  reconectador = crearReconectador({
    conectar: async () => {
      log('Conectando con ' + origen + '...');
      estado('conectando');
      await fuente.conectar();
    },
    alConectar: () => {
      log('¡Conectado con ' + origen + '! Los comentarios ya llegan al juego.');
      estado('conectado');
    },
    alEsperar: ({ ms, noEnVivo, error, motivo }) => {
      if (noEnVivo) {
        log(cfg.prueba
          ? 'El chat de prueba simula que no hay live. Vuelvo a probar en ' + segundos(ms) + '...'
          : '@' + cfg.usuario + ' no está en vivo ahora (o el usuario está mal escrito en .env). Vuelvo a probar en ' + segundos(ms) + '...');
        estado('noEnVivo');
      } else {
        const causa = motivo === 'corte' ? 'Reconectando' : 'No se pudo conectar' + (error && error.message ? ' (' + error.message + ')' : '');
        log(causa + '. Nuevo intento en ' + segundos(ms) + '...');
        estado('reconectando');
      }
    }
  });

  setInterval(() => {
    const n = limitador.tomarDescartados();
    if (n) log('Chat muy movido: se descartaron ' + n + ' mensajes para no saturar el juego.');
  }, 5000).unref();

  const cerrar = async () => {
    log('Cerrando el conector...');
    reconectador.detener();
    try { await fuente.desconectar(); } catch (e) { /* nada */ }
    await servidor.cerrar();
    process.exit(0);
  };
  process.on('SIGINT', cerrar);
  process.on('SIGTERM', cerrar);

  reconectador.iniciar();
}

main().catch((err) => {
  console.error('Error inesperado en el conector:', err);
  process.exitCode = 1;
});
