#!/usr/bin/env node
/*
 * Servidor del modo sala online de "Adiviná y llegá a 10".
 *
 *   npm run servidor   (o npm start)
 *
 * Variables de entorno (todas opcionales; ninguna es secreta):
 *   PORT                    puerto (los servicios como Render lo ponen solos). Por defecto 3000.
 *   HOST                    interfaz de red. Por defecto 0.0.0.0 (acepta celulares de la misma wifi).
 *   MAX_SALAS               salas simultáneas. Por defecto 50.
 *   SALA_INACTIVA_MINUTOS   se borra una sala sin actividad. Por defecto 120.
 *   MENSAJES_POR_SEGUNDO    por jugador. Por defecto 3.
 */
'use strict';

const { crearServidor, direccionesLocales } = require('./app');

function entero(valor, porDefecto, min, max) {
  const n = parseInt(valor, 10);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : porDefecto;
}

async function main() {
  const env = process.env;
  const puerto = entero(env.PORT, 3000, 0, 65535);
  let app;
  try {
    app = await crearServidor({
      puerto,
      host: env.HOST || '0.0.0.0',
      salas: {
        maxSalas: entero(env.MAX_SALAS, 50, 1, 10000),
        inactividadMs: entero(env.SALA_INACTIVA_MINUTOS, 120, 1, 7 * 24 * 60) * 60 * 1000,
        mensajesPorSegundo: entero(env.MENSAJES_POR_SEGUNDO, 3, 1, 50)
      }
    });
  } catch (err) {
    if (err && err.code === 'EADDRINUSE') {
      console.log('\n  El puerto ' + puerto + ' ya está en uso. ¿Quedó otro servidor abierto? Cerralo o usá otro puerto (PORT=3001).\n');
    } else {
      console.log('\n  No se pudo iniciar el servidor:', err && err.message, '\n');
    }
    process.exitCode = 1;
    return;
  }

  console.log('');
  console.log('  Adiviná y llegá a 10 — versión online');
  console.log('  --------------------------------------');
  console.log('  En esta PC:          http://localhost:' + app.puerto);
  const locales = direccionesLocales(app.puerto);
  if (locales.length) {
    console.log('  Desde la misma wifi: ' + locales.join('  ·  '));
  }
  console.log('  Para apagarlo: Ctrl+C');
  console.log('');

  const cerrar = async () => {
    console.log('Cerrando el servidor...');
    await app.cerrar();
    process.exit(0);
  };
  process.on('SIGINT', cerrar);
  process.on('SIGTERM', cerrar);
}

main();
