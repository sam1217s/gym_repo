import { obtenerConexion } from '../config/baseDatos.js';
import { obtenerContexto } from '../contexto/contextoTenant.js';

import * as notificacion from './Notificacion.js';
import * as pago from './Pago.js';
import * as planMembresia from './PlanMembresia.js';
import * as planPlataforma from './PlanPlataforma.js';
import * as miembro from './Miembro.js';
import * as sede from './Sede.js';
import * as tenant from './Tenant.js';
import * as usuario from './Usuario.js';

/**
 * Registro central de modelos y unico punto de acoplamiento con la conexion.
 *
 * Los servicios NO importan modelos directamente ni importan `mongoose`. Piden
 * `obtenerModelo('Miembro')`. Hoy eso resuelve siempre a la conexion compartida.
 * El dia que un tenant grande se mueva a su propia base de datos, solo cambia
 * `obtenerConexion()` en `config/baseDatos.js` y este archivo: la logica de
 * negocio no se toca.
 */

// El orden importa poco, pero los que son referenciados por `ref` deben existir
// antes de que se resuelva un `populate`.
const definiciones = [
  planPlataforma,
  tenant,
  usuario,
  sede,
  planMembresia,
  miembro,
  pago,
  notificacion,
];

export const NOMBRES_MODELOS = Object.freeze(
  definiciones.reduce((acumulado, definicion) => {
    acumulado[definicion.nombreModelo] = definicion.nombreModelo;
    return acumulado;
  }, {}),
);

/** Registra todos los esquemas sobre una conexion. Idempotente. */
export function registrarModelos(conexion) {
  for (const { nombreModelo, esquema } of definiciones) {
    if (!conexion.models[nombreModelo]) {
      conexion.model(nombreModelo, esquema);
    }
  }
  return conexion.models;
}

/**
 * Devuelve el modelo pedido, resuelto sobre la conexion que le toca al tenant
 * del contexto actual.
 */
export function obtenerModelo(nombreModelo) {
  if (!NOMBRES_MODELOS[nombreModelo]) {
    throw new Error(`Modelo desconocido: "${nombreModelo}"`);
  }

  const conexion = obtenerConexion(obtenerContexto()?.tenantId ?? null);
  return conexion.models[nombreModelo] ?? registrarModelos(conexion)[nombreModelo];
}

/** Asegura que todos los indices declarados existan. Solo en arranque o seed. */
export async function sincronizarIndices(conexion) {
  const modelos = registrarModelos(conexion);
  await Promise.all(Object.values(modelos).map((modelo) => modelo.syncIndexes()));
}
