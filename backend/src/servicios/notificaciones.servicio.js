import {
  DIAS_AVISO_POR_VENCER,
  DIAS_AVISO_VENCIDO,
  ESTADOS_NOTIFICACION,
  ESTADOS_VENCIMIENTO,
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
 * Un `Pago.find({ periodoFin: { $lte: umbral } })` —la forma obvia— avisaria de
 * mas: un miembro que ya renovo conserva su pago viejo con `periodoFin` pasado y
 * recibiria un aviso de que su mensualidad vencio cuando en realidad esta al dia.
 * El vencimiento se DERIVA del ULTIMO pago, aqui igual que en el panel; el resto
 * de pagos son historia.
 *
 * Son DOS avisos por ciclo, cada uno una sola vez (ver `decidirEtapaAviso`):
 * uno faltando pocos dias y otro al llevar varios vencido. Cada etapa tiene su
 * marca en el pago (`avisadoPorVencer` / `avisadoVencido`) y se pone SOLO tras
 * confirmar el envio: si falla, no se marca y mañana se reintenta.
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

const FORMATO_MONEDA = new Intl.NumberFormat('es-CO');

/**
 * Las variables de la PLANTILLA de WhatsApp, en el orden que espera el cuerpo
 * aprobado en Meta: nombre, gimnasio, fecha de vencimiento y VALOR de la
 * mensualidad. El proveedor Cloud API las mete como parametros de la plantilla;
 * los de texto (n8n) las ignoran y usan el `mensaje`.
 *
 * `precioPlan` se resuelve FRESCO desde el plan del ultimo pago (no del monto
 * pagado): si el gimnasio sube el precio, el aviso ya lo refleja.
 *
 * El VALOR va SOLO como numero ("70.000"), sin el "$": en la plantilla el signo
 * es texto fijo ("Valor a pagar: $ {{4}}"), asi que mandarlo con "$" duplicaria
 * el simbolo ("$ $70.000").
 */
export function construirVariables({ miembro, ultimoPago, tenant, precioPlan }) {
  const zonaHoraria = tenant.config?.zonaHoraria || ZONA_HORARIA_POR_DEFECTO;
  const valor = precioPlan ?? ultimoPago.monto ?? 0;
  return [
    miembro.nombres,
    tenant.nombre,
    formatearFecha(ultimoPago.periodoFin, zonaHoraria),
    FORMATO_MONEDA.format(valor),
  ];
}

/**
 * Avisa a los miembros del tenant actual. DEBE llamarse ya dentro de
 * `ejecutarConTenant(tenant._id, ...)`: lee y escribe colecciones aisladas.
 *
 * `crearProveedor` se inyecta para poder probar el flujo con un proveedor falso
 * sin tocar la red. El canal (Twilio) se configura en el entorno.
 */
export async function notificarVencimientosDelTenant(
  tenant,
  { crearProveedor = crearProveedorPorDefecto, ahora = new Date() } = {},
) {
  const proveedor = crearProveedor();
  if (!proveedor.habilitado) {
    return { omitido: 'proveedor_ninguno', enviados: 0, fallidos: 0 };
  }

  const zonaHoraria = tenant.config?.zonaHoraria || ZONA_HORARIA_POR_DEFECTO;

  // Precio ACTUAL de cada plan, cruzado en memoria (sin $lookup): la 4ª variable
  // del aviso sale de aqui, no del monto del pago viejo.
  const planes = await obtenerModelo('PlanMembresia').find().select('precio');
  const precioPorPlan = new Map(planes.map((plan) => [String(plan._id), plan.precio]));

  const filas = await listarVencimientos();
  const porAvisar = filas
    .map((fila) => ({ ...fila, etapa: decidirEtapaAviso(fila.ultimoPago, ahora, zonaHoraria) }))
    .filter((fila) => fila.etapa);

  let enviados = 0;
  let fallidos = 0;

  for (const fila of porAvisar) {
    const resultado = await avisarAMiembro(fila, { tenant, proveedor, ahora, precioPorPlan });
    if (resultado === ESTADOS_NOTIFICACION.ENVIADO) enviados += 1;
    else fallidos += 1;
  }

  return { proveedor: proveedor.nombre, enviados, fallidos, candidatos: porAvisar.length };
}

/**
 * Que aviso corresponde HOY para el ultimo pago, o `null` si ninguno. Son dos
 * por ciclo y cada uno una sola vez (lo garantizan las dos marcas del pago):
 *  - `por_vencer`: faltan `DIAS_AVISO_POR_VENCER` dias o menos (aun no vence).
 *  - `vencido`: lleva `DIAS_AVISO_VENCIDO` dias o mas vencido.
 */
function decidirEtapaAviso(ultimoPago, ahora, zonaHoraria) {
  if (!ultimoPago) return null;

  const dias = diasCalendarioHasta(ultimoPago.periodoFin, ahora, zonaHoraria);

  if (dias > 0 && dias <= DIAS_AVISO_POR_VENCER && !ultimoPago.avisadoPorVencer) {
    return 'por_vencer';
  }
  if (dias <= -DIAS_AVISO_VENCIDO && !ultimoPago.avisadoVencido) {
    return 'vencido';
  }
  return null;
}

async function avisarAMiembro(
  { miembro, ultimoPago, etapa },
  { tenant, proveedor, ahora, precioPorPlan },
) {
  const Notificacion = obtenerModelo('Notificacion');
  const Pago = obtenerModelo('Pago');

  const estado =
    etapa === 'vencido' ? ESTADOS_VENCIMIENTO.VENCIDO : ESTADOS_VENCIMIENTO.POR_VENCER;
  const precioPlan = precioPorPlan?.get(String(ultimoPago.planMembresia));
  const mensaje = construirMensaje({ miembro, ultimoPago, estado, tenant, ahora });
  const variables = construirVariables({ miembro, ultimoPago, tenant, precioPlan });

  try {
    if (!miembro.telefono) throw new Error(SIN_TELEFONO);

    await proveedor.enviar({ telefono: miembro.telefono, mensaje, variables });

    await Notificacion.create({
      miembro: miembro._id,
      estado: ESTADOS_NOTIFICACION.ENVIADO,
      mensaje,
    });

    // Se marca SOLO la etapa enviada, y solo tras confirmar: asi el otro aviso
    // del ciclo aun puede salir, y un fallo no pierde este.
    const campo = etapa === 'vencido' ? 'avisadoVencido' : 'avisadoPorVencer';
    await Pago.updateOne({ _id: ultimoPago._id }, { [campo]: true });

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
