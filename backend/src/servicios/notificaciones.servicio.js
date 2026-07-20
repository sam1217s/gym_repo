import {
  ESTADOS_NOTIFICACION,
  ESTADOS_VENCIMIENTO,
  ESTADOS_VENCIMIENTO_AVISABLES,
  MILISEGUNDOS_POR_DIA,
  ZONA_HORARIA_POR_DEFECTO,
} from '../config/constantes.js';
import { obtenerModelo } from '../modelos/indice.js';
import { crearProveedor as crearProveedorPorDefecto } from '../proveedores/indice.js';
import { listarVencimientos } from './vencimientos.servicio.js';

/**
 * Aviso de vencimiento por WhatsApp.
 *
 * A QUIEN se avisa: `listarVencimientos()`, la MISMA consulta que pinta el
 * panel de miembros. Es deliberado y no es un detalle.
 *
 * Un `Pago.find({ periodoFin: { $lte: umbral }, notificado: false })` —la forma
 * obvia— avisaria de mas: un miembro que ya renovo conserva su pago viejo, con
 * `periodoFin` pasado y `notificado: false`, y recibiria un aviso de que su
 * mensualidad vencio cuando en realidad esta al dia. El vencimiento se DERIVA
 * del ULTIMO pago, aqui igual que en el panel; el resto de pagos son historia.
 *
 * `notificado` se marca sobre ese ultimo pago, asi que cada periodo se avisa
 * una sola vez. Si el envio falla, NO se marca: mañana se reintenta.
 */

const SIN_TELEFONO = 'El miembro no tiene telefono';

/** El dia civil de una fecha en una zona horaria, como `2026-07-09`. */
function diaCivil(fecha, zonaHoraria) {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: zonaHoraria,
  }).format(new Date(fecha));
}

/**
 * Dias de CALENDARIO que faltan, en la zona horaria del gimnasio.
 *
 * Restar milisegundos no sirve: una mensualidad que termina hoy a las 6 de la
 * tarde esta a 0.25 dias de distancia, y redondeando hacia arriba diria "vence
 * en 1 dia" cuando al miembro hay que decirle "vence hoy". Se comparan los dias
 * civiles, no los instantes.
 */
function diasCalendarioHasta(fecha, ahora, zonaHoraria) {
  const aUtc = (valor) => Date.parse(`${diaCivil(valor, zonaHoraria)}T00:00:00Z`);
  return Math.round((aUtc(fecha) - aUtc(ahora)) / MILISEGUNDOS_POR_DIA);
}

function formatearFecha(fecha, zonaHoraria) {
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    timeZone: zonaHoraria,
  }).format(new Date(fecha));
}

/**
 * El texto que recibe el miembro. Se separa del envio para poder probarlo sin
 * tocar la red ni la base de datos.
 */
export function construirMensaje({ miembro, ultimoPago, estado, tenant, ahora = new Date() }) {
  const zonaHoraria = tenant.config?.zonaHoraria || ZONA_HORARIA_POR_DEFECTO;
  const cuando = formatearFecha(ultimoPago.periodoFin, zonaHoraria);
  const saludo = `Hola ${miembro.nombres}`;

  if (estado === ESTADOS_VENCIMIENTO.VENCIDO) {
    return (
      `${saludo}, tu mensualidad en ${tenant.nombre} vencio el ${cuando}. ` +
      'Renuevala cuando puedas y sigue entrenando con nosotros.'
    );
  }

  const dias = diasCalendarioHasta(ultimoPago.periodoFin, ahora, zonaHoraria);

  if (dias <= 0) {
    return `${saludo}, tu mensualidad en ${tenant.nombre} vence hoy (${cuando}). Te esperamos.`;
  }

  const plural = dias === 1 ? 'dia' : 'dias';
  return (
    `${saludo}, tu mensualidad en ${tenant.nombre} vence en ${dias} ${plural}, ` +
    `el ${cuando}. Te esperamos.`
  );
}

/**
 * Las variables de la PLANTILLA de WhatsApp, en el orden que espera el cuerpo
 * aprobado en Meta: nombre del miembro, gimnasio y fecha de vencimiento. El
 * proveedor Cloud API las mete como parametros de la plantilla; los proveedores
 * de texto (n8n) las ignoran y usan el `mensaje` completo.
 */
export function construirVariables({ miembro, ultimoPago, tenant }) {
  const zonaHoraria = tenant.config?.zonaHoraria || ZONA_HORARIA_POR_DEFECTO;
  return [miembro.nombres, tenant.nombre, formatearFecha(ultimoPago.periodoFin, zonaHoraria)];
}

/** `true` si el plan de plataforma del gimnasio incluye el canal de WhatsApp. */
function planIncluyeWhatsApp(tenant) {
  return tenant.planPlataforma?.features?.whatsapp === true;
}

/**
 * Avisa a los miembros del tenant actual. DEBE llamarse ya dentro de
 * `ejecutarConTenant(tenant._id, ...)`: lee y escribe colecciones aisladas.
 *
 * `crearProveedor` se inyecta para poder probar el flujo con un proveedor falso
 * sin tocar la red.
 */
export async function notificarVencimientosDelTenant(
  tenant,
  { crearProveedor = crearProveedorPorDefecto, ahora = new Date() } = {},
) {
  if (!planIncluyeWhatsApp(tenant)) {
    return { omitido: 'plan_sin_whatsapp', enviados: 0, fallidos: 0 };
  }

  const proveedor = crearProveedor(tenant.config?.whatsapp);
  if (!proveedor.habilitado) {
    return { omitido: 'proveedor_ninguno', enviados: 0, fallidos: 0 };
  }

  const filas = await listarVencimientos();
  const porAvisar = filas.filter(
    (fila) => ESTADOS_VENCIMIENTO_AVISABLES.includes(fila.estado) && !fila.ultimoPago.notificado,
  );

  let enviados = 0;
  let fallidos = 0;

  for (const fila of porAvisar) {
    const resultado = await avisarAMiembro(fila, { tenant, proveedor, ahora });
    if (resultado === ESTADOS_NOTIFICACION.ENVIADO) enviados += 1;
    else fallidos += 1;
  }

  return { proveedor: proveedor.nombre, enviados, fallidos, candidatos: porAvisar.length };
}

async function avisarAMiembro({ miembro, ultimoPago, estado }, { tenant, proveedor, ahora }) {
  const Notificacion = obtenerModelo('Notificacion');
  const Pago = obtenerModelo('Pago');

  const mensaje = construirMensaje({ miembro, ultimoPago, estado, tenant, ahora });
  const variables = construirVariables({ miembro, ultimoPago, tenant });

  try {
    if (!miembro.telefono) throw new Error(SIN_TELEFONO);

    await proveedor.enviar({ telefono: miembro.telefono, mensaje, variables });

    await Notificacion.create({
      miembro: miembro._id,
      estado: ESTADOS_NOTIFICACION.ENVIADO,
      mensaje,
    });

    // Solo tras un envio confirmado: si se marcara antes, un fallo perderia el aviso.
    await Pago.updateOne({ _id: ultimoPago._id }, { notificado: true });

    return ESTADOS_NOTIFICACION.ENVIADO;
  } catch (error) {
    // El pago NO se marca: el aviso se reintenta en la proxima corrida.
    await Notificacion.create({
      miembro: miembro._id,
      estado: ESTADOS_NOTIFICACION.FALLIDO,
      mensaje: `${mensaje}\n[fallo: ${error.message}]`,
    });

    return ESTADOS_NOTIFICACION.FALLIDO;
  }
}
