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
