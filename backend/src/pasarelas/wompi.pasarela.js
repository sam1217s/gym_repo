import { createHash, timingSafeEqual } from 'node:crypto';

import { CENTAVOS_POR_UNIDAD, MONEDA_POR_DEFECTO } from '../config/constantes.js';
import { entorno } from '../config/entorno.js';

/**
 * Wompi: la pasarela con la que GymSaaS le cobra a los gimnasios.
 *
 * Dos firmas distintas, con DOS secretos distintos, y confundirlos es un
 * agujero:
 *
 *   - Firma de integridad (salida): la calcula GymSaaS y viaja en la URL del
 *     checkout. Impide que el gimnasio cambie el monto en la barra del navegador.
 *     SHA256(referencia + montoEnCentavos + moneda + SECRETO_INTEGRIDAD)
 *
 *   - Checksum del evento (entrada): lo calcula Wompi y viene en el webhook.
 *     Es lo UNICO que separa un webhook legitimo de uno falsificado: sin el,
 *     cualquiera podria hacer un POST y marcar su factura como pagada.
 *     SHA256(valores de signature.properties + timestamp + SECRETO_EVENTOS)
 *
 * Referencia: https://docs.wompi.co/docs/colombia/eventos/
 *             https://docs.wompi.co/docs/colombia/widget-checkout-web/
 */

function exigirCredencial(nombre) {
  const valor = entorno[nombre];
  if (!valor) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. La pasarela de pago no esta configurada.`,
    );
  }
  return valor;
}

function sha256(texto) {
  return createHash('sha256').update(texto, 'utf8').digest('hex');
}

export function aCentavos(monto) {
  return Math.round(monto * CENTAVOS_POR_UNIDAD);
}

/**
 * URL del Checkout Web con la firma de integridad ya calculada.
 *
 * La firma se hace SIEMPRE en el servidor: el secreto de integridad no puede
 * pisar el navegador.
 */
export function construirEnlaceCheckout({ referencia, monto, moneda = MONEDA_POR_DEFECTO }) {
  const llavePublica = exigirCredencial('WOMPI_LLAVE_PUBLICA');
  const secretoIntegridad = exigirCredencial('WOMPI_SECRETO_INTEGRIDAD');

  const centavos = aCentavos(monto);
  const firma = sha256(`${referencia}${centavos}${moneda}${secretoIntegridad}`);

  const parametros = new URLSearchParams({
    'public-key': llavePublica,
    currency: moneda,
    'amount-in-cents': String(centavos),
    reference: referencia,
    'signature:integrity': firma,
    'redirect-url': entorno.WOMPI_URL_REDIRECCION,
  });

  return `${entorno.WOMPI_URL_CHECKOUT}?${parametros}`;
}

/** Lee `transaction.status` dentro de `data`, siguiendo la ruta con puntos. */
function leerRuta(objeto, ruta) {
  return ruta.split('.').reduce((actual, clave) => actual?.[clave], objeto);
}

/**
 * Compara dos hashes sin filtrar informacion por el tiempo que tarda.
 * `timingSafeEqual` exige buffers del mismo tamaño, asi que la diferencia de
 * longitud se descarta antes (y esa si es publica: es el largo del hash).
 */
function sonIguales(a, b) {
  const bufferA = Buffer.from(String(a).toLowerCase(), 'utf8');
  const bufferB = Buffer.from(String(b).toLowerCase(), 'utf8');

  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * `true` si el evento lo firmo Wompi de verdad.
 *
 * `signature.properties` NO se puede quemar en el codigo: la propia
 * documentacion avisa de que la lista cambia entre eventos y con el tiempo. Se
 * lee del payload y se resuelve contra `data`.
 */
export function verificarChecksumEvento(evento) {
  const secretoEventos = exigirCredencial('WOMPI_SECRETO_EVENTOS');

  const propiedades = evento?.signature?.properties;
  const checksumRecibido = evento?.signature?.checksum;

  if (!Array.isArray(propiedades) || propiedades.length === 0) return false;
  if (!checksumRecibido || evento.timestamp === undefined) return false;

  const valores = propiedades.map((ruta) => leerRuta(evento.data, ruta));

  // Una propiedad que el evento no trae haria una firma silenciosamente
  // distinta; es mejor rechazar que calcular sobre "undefined".
  if (valores.some((valor) => valor === undefined || valor === null)) return false;

  const cadena = `${valores.join('')}${evento.timestamp}${secretoEventos}`;

  return sonIguales(sha256(cadena), checksumRecibido);
}

/** `true` si hay credenciales suficientes para atender un webhook. */
export function pasarelaConfigurada() {
  return Boolean(entorno.WOMPI_SECRETO_EVENTOS);
}

/**
 * `true` si se puede firmar un checkout. Se consulta ANTES de construir el
 * enlace: sin esto, un despliegue sin llaves le responde al gimnasio un 500
 * generico ("Error interno del servidor") en vez de decir que falta configurar
 * la pasarela.
 */
export function pasarelaListaParaCobrar() {
  return Boolean(entorno.WOMPI_LLAVE_PUBLICA && entorno.WOMPI_SECRETO_INTEGRIDAD);
}
