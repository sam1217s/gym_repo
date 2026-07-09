import { ErrorApi } from '../utilidades/ErrorApi.js';

/**
 * Validacion en el borde: nada entra a un controlador sin haber pasado por un
 * esquema Zod. Ademas de validar, reemplaza `body`/`params`/`query` por la
 * version parseada, de modo que los servicios reciben datos ya normalizados
 * (numeros como numeros, fechas como `Date`, emails en minusculas).
 */
export function validar(esquemas) {
  return function ejecutarValidacion(peticion, _respuesta, siguiente) {
    for (const parte of ['body', 'params', 'query']) {
      const esquema = esquemas[parte];
      if (!esquema) continue;

      const resultado = esquema.safeParse(peticion[parte]);
      if (!resultado.success) {
        return siguiente(ErrorApi.solicitudInvalida('Datos invalidos', formatearProblemas(resultado.error)));
      }

      // `query` es un getter de solo lectura en Express 5; asignar la propiedad
      // directamente falla. `Object.defineProperty` funciona en ambas versiones.
      Object.defineProperty(peticion, parte, { value: resultado.data, writable: true });
    }
    return siguiente();
  };
}

function formatearProblemas(errorZod) {
  return errorZod.issues.map((problema) => ({
    campo: problema.path.join('.'),
    mensaje: problema.message,
  }));
}
