import { conectarBaseDatos, desconectarBaseDatos } from './config/baseDatos.js';
import { entorno, esProduccion } from './config/entorno.js';
import { registrarModelos, sincronizarIndices } from './modelos/indice.js';
import { crearServidor } from './servidor.js';

/** Punto de entrada del proceso: conecta, escucha y se apaga con orden. */
async function arrancar() {
  const conexion = await conectarBaseDatos(entorno.MONGO_URI);
  registrarModelos(conexion);

  // En produccion los indices se crean con una migracion controlada, no en cada
  // arranque: `syncIndexes()` bloquea la coleccion mientras construye.
  if (!esProduccion) await sincronizarIndices(conexion);

  const servidor = crearServidor().listen(entorno.PUERTO, () => {
    console.log(`GymSaaS API escuchando en http://localhost:${entorno.PUERTO} [${entorno.NODE_ENV}]`);
  });

  /**
   * `listen()` no rechaza una promesa: emite un evento `error`. Sin este
   * manejador, un puerto ocupado sale como un volcado de pila de Node en vez de
   * un mensaje util.
   */
  servidor.on('error', (error) => {
    if (error.code !== 'EADDRINUSE') throw error;

    console.error(
      `\nEl puerto ${entorno.PUERTO} ya esta ocupado por otro proceso.\n` +
        'Suele ser una instancia anterior de la API que quedo viva. Para encontrarla:\n\n' +
        `  PowerShell: Get-NetTCPConnection -LocalPort ${entorno.PUERTO} -State Listen\n` +
        `  Luego:      Stop-Process -Id <PID> -Force\n`,
    );
    process.exit(1);
  });

  for (const senal of ['SIGINT', 'SIGTERM']) {
    process.on(senal, () => {
      servidor.close(async () => {
        await desconectarBaseDatos();
        process.exit(0);
      });
    });
  }
}

arrancar().catch((error) => {
  console.error('No se pudo arrancar el servidor:', error.message);
  process.exit(1);
});
