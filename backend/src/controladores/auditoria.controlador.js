import * as servicioAuditoria from '../servicios/auditoria.servicio.js';
import { manejadorAsync } from '../utilidades/manejadorAsync.js';
import { responderOk } from '../utilidades/respuesta.js';

/** Panel de auditoria del dueño: los movimientos recientes de su gimnasio. */
export const listarAuditoria = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioAuditoria.listarAuditoria()),
);
