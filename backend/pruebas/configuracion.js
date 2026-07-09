import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll } from 'vitest';

import { conectarBaseDatos, desconectarBaseDatos, obtenerConexion } from '../src/config/baseDatos.js';
import { ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { registrarModelos, sincronizarIndices } from '../src/modelos/indice.js';

/**
 * Levanta un MongoDB efimero en memoria para la suite. No toca la base de
 * desarrollo ni requiere que el desarrollador tenga Mongo instalado.
 */

let servidorMongo = null;

beforeAll(async () => {
  servidorMongo = await MongoMemoryServer.create();

  const conexion = await conectarBaseDatos(servidorMongo.getUri('gymsaas-prueba'));
  registrarModelos(conexion);
  await sincronizarIndices(conexion);
}, 180_000);

afterAll(async () => {
  await desconectarBaseDatos();
  await servidorMongo?.stop();
});

/**
 * Vacia todas las colecciones. Corre bajo `ejecutarSinTenant` porque un
 * `deleteMany({})` en una coleccion tenant-scoped no se ejecutaria sin contexto:
 * es exactamente la regla que estas pruebas verifican.
 */
export async function limpiarColecciones() {
  const conexion = obtenerConexion();

  await ejecutarSinTenant(async () => {
    await Promise.all(
      Object.values(conexion.models).map((modelo) => modelo.deleteMany({})),
    );
  });
}
