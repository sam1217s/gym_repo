import { pasarelaListaParaCobrar } from '../pasarelas/wompi.pasarela.js';
import * as servicioFacturacion from '../servicios/facturacionPlataforma.servicio.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';
import { manejadorAsync } from '../utilidades/manejadorAsync.js';
import { responderOk } from '../utilidades/respuesta.js';

const SERVICIO_NO_DISPONIBLE = 503;

/**
 * Facturacion vista por el dueno del gimnasio. El `tenant` sale siempre de la
 * sesion, nunca de la peticion: nadie puede pedir las facturas de otro.
 */

export const misFacturas = manejadorAsync(async (peticion, respuesta) => {
  const tenantId = peticion.usuario.tenant;

  const [facturas, pendiente] = await Promise.all([
    servicioFacturacion.listarFacturasDeTenant(tenantId),
    servicioFacturacion.obtenerFacturaPendiente(tenantId),
  ]);

  return responderOk(respuesta, {
    facturas,
    facturaPendiente: pendiente,
    estadoGimnasio: peticion.tenant.estado,
  });
});

export const enlaceDePago = manejadorAsync(async (peticion, respuesta) => {
  if (!pasarelaListaParaCobrar()) {
    throw new ErrorApi(
      SERVICIO_NO_DISPONIBLE,
      'Los pagos en linea no estan disponibles ahora mismo. Contacta a soporte.',
    );
  }

  const url = await servicioFacturacion.obtenerEnlaceDePago(
    peticion.usuario.tenant,
    peticion.params.id,
  );

  return responderOk(respuesta, { url });
});
