/**
 * Envuelve un manejador async de Express para que cualquier promesa rechazada
 * llegue al middleware central de errores en vez de morir como
 * `unhandledRejection`. Todo controlador se exporta envuelto en esto.
 */
export function manejadorAsync(funcion) {
  return function envoltura(peticion, respuesta, siguiente) {
    Promise.resolve(funcion(peticion, respuesta, siguiente)).catch(siguiente);
  };
}
