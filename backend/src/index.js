import { conectarBaseDatos, desconectarBaseDatos } from './config/baseDatos.js';
import { entorno, esProduccion } from './config/entorno.js';
import { registrarModelos, sincronizarIndices } from './modelos/indice.js';
import { crearServidor } from './servidor.js';
import { programarPurgaComprobantes } from './tareas/comprobantes.tarea.js';
import { programarCobranza } from './tareas/facturacion.tarea.js';
import { programarAvisosDeVencimiento } from './tareas/vencimientos.tarea.js';

/** Punto de entrada del proceso: conecta, escucha y se apaga con orden. */
async function arrancar() {
  const conexion = await conectarBaseDatos(entorno.MONGO_URI);
  registrarModelos(conexion);

  // En produccion los indices se crean con una migracion controlada, no en cada
  // arranque: `syncIndexes()` bloquea la coleccion mientras construye.
  if (!esProduccion) await sincronizarIndices(conexion);

  /**
   * El cron se programa DENTRO del callback de `listen`, no antes: un proceso
   * que no logro tomar el puerto no debe agendar trabajo. Y solo una instancia
   * debe hacerlo (`HABILITAR_CRON`), o cada miembro recibiria el aviso N veces.
   */
  const tareas = [];

  const servidor = crearServidor().listen(entorno.PUERTO, () => {
    console.log(`GymSaaS API escuchando en http://localhost:${entorno.PUERTO} [${entorno.NODE_ENV}]`);
    if (entorno.HABILITAR_CRON) {
      tareas.push(
        programarAvisosDeVencimiento(),
        programarCobranza(),
        programarPurgaComprobantes(),
      );
    }
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
      for (const tarea of tareas) tarea.stop();
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
