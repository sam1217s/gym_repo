import { ErrorApi } from '../utilidades/ErrorApi.js';

/** Ultima ruta montada: cualquier peticion que llegue aqui no existe. */
export function noEncontrado(peticion, _respuesta, siguiente) {
  return siguiente(ErrorApi.noEncontrado(`La ruta ${peticion.method} ${peticion.originalUrl} no existe`));
}
