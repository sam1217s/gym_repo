/**
 * Error de negocio con codigo HTTP. Todo lo que el cliente deba ver se lanza
 * como un `ErrorApi`; cualquier otra excepcion se considera un bug y el
 * manejador central la convierte en un 500 generico sin filtrar detalles.
 */
export class ErrorApi extends Error {
  constructor(estado, mensaje, detalles = null, codigo = null) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estado = estado;
    this.detalles = detalles;
    // Codigo estable para que el frontend reaccione a un caso concreto sin
    // depender del texto (p. ej. `sesion_reemplazada`).
    this.codigo = codigo;
    this.esOperacional = true;
  }

  static solicitudInvalida(mensaje = 'Solicitud invalida', detalles = null) {
    return new ErrorApi(400, mensaje, detalles);
  }

  static noAutenticado(mensaje = 'No has iniciado sesion', codigo = null) {
    return new ErrorApi(401, mensaje, null, codigo);
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
