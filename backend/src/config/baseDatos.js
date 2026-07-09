import mongoose from 'mongoose';

/**
 * Punto unico de acceso a la conexion de MongoDB.
 *
 * Hoy todos los tenants comparten una sola base de datos y se aislan por el
 * campo `tenant` (ver `src/modelos/complementos/aislamientoTenant.js`).
 *
 * MIGRACION FUTURA A BASE-POR-TENANT: cuando un tenant grande necesite su
 * propia base, la unica pieza que cambia es `obtenerConexion(tenantId)`, que
 * pasara a devolver una conexion distinta segun el tenant. Ni los servicios ni
 * los controladores importan `mongoose` directamente, asi que no se tocan.
 */

let conexionCompartida = null;

export async function conectarBaseDatos(uri) {
  if (conexionCompartida) return conexionCompartida;

  // Sin esto, una consulta a una coleccion que no existe se queda colgada
  // esperando en vez de fallar rapido.
  mongoose.set('bufferCommands', false);
  mongoose.set('strictQuery', true);

  await mongoose.connect(uri);
  conexionCompartida = mongoose.connection;

  return conexionCompartida;
}

export async function desconectarBaseDatos() {
  if (!conexionCompartida) return;
  await mongoose.disconnect();
  conexionCompartida = null;
}

/**
 * Devuelve la conexion que le corresponde a un tenant.
 *
 * El parametro `tenantId` se ignora a proposito: existe para que las llamadas
 * ya esten escritas el dia que haya varias bases. No lo elimines.
 */
// eslint-disable-next-line no-unused-vars
export function obtenerConexion(tenantId = null) {
  if (!conexionCompartida) {
    throw new Error('La base de datos no esta conectada. Llama a conectarBaseDatos() primero.');
  }
  return conexionCompartida;
}

export function estaConectada() {
  return mongoose.connection.readyState === 1;
}
