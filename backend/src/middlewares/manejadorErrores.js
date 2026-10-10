import { ZodError } from 'zod';
import { esProduccion } from '../config/entorno.js';
import { ErrorSinContextoTenant } from '../contexto/contextoTenant.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';
import { responderError } from '../utilidades/respuesta.js';

const CODIGO_CLAVE_DUPLICADA = 11000;

/**
 * Manejador central de errores. Es el unico sitio del backend que decide que ve
 * el cliente. Regla: los stack traces jamas salen de aqui.
 *
 * Express identifica este middleware por su aridad de cuatro argumentos, asi que
 * `siguiente` no se puede quitar aunque no se use.
 */
// eslint-disable-next-line no-unused-vars
export function manejadorErrores(error, _peticion, respuesta, siguiente) {
  const traducido = traducirError(error);

  if (traducido.estado >= 500) {
    // Un 500 siempre es un bug nuestro: se registra entero para poder depurarlo.
    console.error('[error no controlado]', error);
  }

  return responderError(
    respuesta,
    traducido.estado,
    traducido.mensaje,
    esProduccion && traducido.estado >= 500 ? null : traducido.detalles,
    traducido.codigo,
  );
}

function traducirError(error) {
  if (error instanceof ErrorApi) {
    return { estado: error.estado, mensaje: error.message, detalles: error.detalles, codigo: error.codigo };
  }

  /**
   * Llegar aqui significa que alguien consulto una coleccion tenant-scoped sin
   * contexto. Es un bug de programacion, no un error del cliente: 500 y a los logs.
   */
  if (error instanceof ErrorSinContextoTenant) {
    return { estado: 500, mensaje: 'Error interno del servidor', detalles: null };
  }

  if (error instanceof ZodError) {
    return {
      estado: 400,
      mensaje: 'Datos invalidos',
      detalles: error.issues.map((p) => ({ campo: p.path.join('.'), mensaje: p.message })),
    };
  }

  if (error?.name === 'ValidationError') {
    return {
      estado: 400,
      mensaje: 'Datos invalidos',
      detalles: Object.values(error.errors ?? {}).map((e) => ({
        campo: e.path,
        mensaje: e.message,
      })),
    };
  }

  if (error?.name === 'CastError') {
    return { estado: 400, mensaje: `Identificador invalido: ${error.value}`, detalles: null };
  }

  if (error?.code === CODIGO_CLAVE_DUPLICADA) {
    const campos = Object.keys(error.keyPattern ?? {})
      .filter((campo) => campo !== 'tenant')
      .join(', ');
    return { estado: 409, mensaje: `Ya existe un registro con ese ${campos || 'valor'}`, detalles: null };
  }

  if (error?.name === 'JsonWebTokenError' || error?.name === 'TokenExpiredError') {
    return { estado: 401, mensaje: 'Sesion expirada o token invalido', detalles: null };
  }

  return { estado: 500, mensaje: 'Error interno del servidor', detalles: null };
}
