/**
 * Contrato de un proveedor de notificaciones.
 *
 * El servicio de notificaciones no sabe (ni quiere saber) si detras hay una
 * sesion de WhatsApp Web, la Cloud API de Meta o un webhook de n8n. Solo sabe
 * pedir `enviar()` y distinguir entre "se entrego" y "fallo".
 *
 * @typedef {object} NotificacionProvider
 * @property {string}  nombre       Identificador del proveedor (para la bitacora).
 * @property {boolean} habilitado   `false` cuando el gimnasio decidio no enviar nada.
 * @property {(aviso: Aviso) => Promise<void>} enviar
 *           Resuelve si el mensaje se entrego al proveedor. LANZA si fallo: el
 *           servicio traduce esa excepcion a una `Notificacion` con estado
 *           `fallido`, y el pago NO se marca como notificado para reintentarlo.
 *
 * @typedef {object} Aviso
 * @property {string} telefono  Formato internacional sin '+', ej. "573001234567".
 * @property {string} mensaje   Texto ya construido, listo para enviar.
 */

/**
 * Un proveedor que no envia nada. No es un caso de error: es la eleccion por
 * defecto de un gimnasio que todavia no conecto WhatsApp.
 */
export function proveedorDeshabilitado(nombre) {
  return {
    nombre,
    habilitado: false,
    async enviar() {
      throw new Error(`El proveedor "${nombre}" no envia mensajes; no deberia llamarse.`);
    },
  };
}

/** Lanza si a las credenciales del proveedor les falta una clave obligatoria. */
export function exigirCredenciales(nombreProveedor, credenciales, clavesObligatorias) {
  const faltantes = clavesObligatorias.filter((clave) => !credenciales?.[clave]);

  if (faltantes.length > 0) {
    throw new Error(
      `Al proveedor "${nombreProveedor}" le faltan credenciales: ${faltantes.join(', ')}`,
    );
  }
}
