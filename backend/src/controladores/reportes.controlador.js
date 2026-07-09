import * as servicioReportes from '../servicios/reportes.servicio.js';
import { manejadorAsync } from '../utilidades/manejadorAsync.js';
import { responderOk } from '../utilidades/respuesta.js';

export const obtenerReportePanel = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioReportes.obtenerReportePanel(peticion.filtroSede)),
);
