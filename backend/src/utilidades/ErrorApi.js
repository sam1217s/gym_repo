/**
 * Error de negocio con codigo HTTP. Todo lo que el cliente deba ver se lanza
 * como un `ErrorApi`; cualquier otra excepcion se considera un bug y el
 * manejador central la convierte en un 500 generico sin filtrar detalles.
 */
export class ErrorApi extends Error {
  constructor(estado, mensaje, detalles = null) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estado = estado;
    this.detalles = detalles;
    this.esOperacional = true;
  }

  static solicitudInvalida(mensaje = 'Solicitud invalida', detalles = null) {
    return new ErrorApi(400, mensaje, detalles);
  }

  static noAutenticado(mensaje = 'No has iniciado sesion') {
    return new ErrorApi(401, mensaje);
  }

  static prohibido(mensaje = 'No tienes permiso para hacer esto') {
    return new ErrorApi(403, mensaje);
  }

  static noEncontrado(mensaje = 'Recurso no encontrado') {
    return new ErrorApi(404, mensaje);
  }

  static conflicto(mensaje = 'El recurso ya existe') {
    return new ErrorApi(409, mensaje);
  }
}
