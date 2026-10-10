import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { entorno } from '../config/entorno.js';
import { ErrorApi } from './ErrorApi.js';

/**
 * Cifrado EN REPOSO de las plantillas de huella (datos sensibles, Ley 1581 de
 * 2012). AES-256-GCM: ademas de ocultar la plantilla, el tag de autenticacion
 * detecta si alguien la altero en la base de datos.
 *
 * Formato guardado: `v1:<iv>:<tag>:<cifrado>`, cada parte en base64. El prefijo
 * de version permite rotar el algoritmo o la clave sin adivinar que hay guardado.
 */

const ALGORITMO = 'aes-256-gcm';
const VERSION = 'v1';
const BYTES_IV = 12;

function obtenerClave() {
  if (!entorno.CLAVE_CIFRADO_BIOMETRIA) {
    throw new ErrorApi(
      503,
      'El registro de huellas no esta configurado en el servidor (falta CLAVE_CIFRADO_BIOMETRIA)',
    );
  }
  return Buffer.from(entorno.CLAVE_CIFRADO_BIOMETRIA, 'hex');
}

/** Cifra un Buffer y devuelve el texto que se guarda. */
export function cifrarPlantilla(plantilla) {
  const iv = randomBytes(BYTES_IV);
  const cifrador = createCipheriv(ALGORITMO, obtenerClave(), iv);
  const cifrado = Buffer.concat([cifrador.update(plantilla), cifrador.final()]);
  const tag = cifrador.getAuthTag();
  return [VERSION, iv, tag, cifrado].map((parte) => (Buffer.isBuffer(parte) ? parte.toString('base64') : parte)).join(':');
}

/** Devuelve el Buffer original. Lanza si el texto fue alterado o la clave no es la misma. */
export function descifrarPlantilla(texto) {
  const [version, iv, tag, cifrado] = String(texto).split(':');
  if (version !== VERSION) throw new Error(`Version de cifrado biometrico desconocida: ${version}`);

  const descifrador = createDecipheriv(ALGORITMO, obtenerClave(), Buffer.from(iv, 'base64'));
  descifrador.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([descifrador.update(Buffer.from(cifrado, 'base64')), descifrador.final()]);
}
