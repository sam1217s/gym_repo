import * as servicioReportes from '../servicios/reportesMaquina.servicio.js';
import { manejadorAsync } from '../utilidades/manejadorAsync.js';
import { responderOk } from '../utilidades/respuesta.js';

/** Reportes de maquinas para el dueño. El acceso lo restringe la ruta. */

export const listarReportes = manejadorAsync(async (peticion, respuesta) => {
  const [reportes, noLeidos] = await Promise.all([
    servicioReportes.listarReportes(),
    servicioReportes.contarNoLeidos(),
  ]);
  return responderOk(respuesta, { reportes, noLeidos });
});

export const contarNoLeidos = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, { noLeidos: await servicioReportes.contarNoLeidos() }),
);

export const marcarLeidos = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, { marcados: await servicioReportes.marcarLeidos() }),
);
