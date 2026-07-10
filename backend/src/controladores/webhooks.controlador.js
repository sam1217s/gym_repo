import { pasarelaConfigurada, verificarChecksumEvento } from '../pasarelas/wompi.pasarela.js';
import { aplicarEventoDePago } from '../servicios/facturacionPlataforma.servicio.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';
import { manejadorAsync } from '../utilidades/manejadorAsync.js';
import { responderOk } from '../utilidades/respuesta.js';

const SERVICIO_NO_DISPONIBLE = 503;

/**
 * Webhook de Wompi. Ruta PUBLICA: no hay cookie ni sesion que valga, porque
 * quien llama es la pasarela, no un navegador.
 *
 * Lo unico que autentica el mensaje es el checksum. Si no se verifica primero,
 * cualquiera puede hacer un POST y marcar su factura como pagada. Por eso la
 * verificacion es la PRIMERA linea, antes de mirar el cuerpo.
 *
 * A un evento verificado se le responde 200 aunque no interese: un error hace
 * que Wompi lo reintente en bucle.
 */
export const recibirEventoWompi = manejadorAsync(async (peticion, respuesta) => {
  if (!pasarelaConfigurada()) {
    throw new ErrorApi(SERVICIO_NO_DISPONIBLE, 'La pasarela de pago no esta configurada');
  }

  if (!verificarChecksumEvento(peticion.body)) {
    throw ErrorApi.noAutenticado('Firma del evento invalida');
  }

  const resultado = await aplicarEventoDePago(peticion.body);
  return responderOk(respuesta, resultado);
});
