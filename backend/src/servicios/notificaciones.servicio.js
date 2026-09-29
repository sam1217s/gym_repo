import {
  CATEGORIAS_MENSAJE_SALIENTE,
  DATOS_PAGO_AVISO,
  ESTADOS_NOTIFICACION,
  MILISEGUNDOS_POR_DIA,
  OFFSETS_AVISO_VENCIMIENTO,
  ZONA_HORARIA_POR_DEFECTO,
} from '../config/constantes.js';
import { obtenerModelo } from '../modelos/indice.js';
import { crearProveedor as crearProveedorPorDefecto } from '../proveedores/indice.js';
import { registrarMensajeSaliente } from './mensajes.servicio.js';
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
 * Son VARIOS recordatorios por ciclo (ver `OFFSETS_AVISO_VENCIMIENTO`): unos
 * antes de vencer y otros ya vencido. Cada uno se envia una sola vez: el offset
 * de dias se anota en `Pago.avisosEnviados` SOLO tras confirmar el envio, asi que
 * si falla no se marca y se reintenta al dia siguiente (mientras siga coincidiendo
 * con un offset). El cron corre a diario y avisa cuando los dias que faltan/lleva
 * vencido coinciden EXACTO con un offset de la lista.
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

const FORMATO_MONEDA = new Intl.NumberFormat('es-CO');

/** Datos que llenan el aviso (los MISMOS para el texto y para las variables). */
function datosAviso({ miembro, ultimoPago, tenant, precioPlan }) {
  const zonaHoraria = tenant.config?.zonaHoraria || ZONA_HORARIA_POR_DEFECTO;
  return {
    nombre: miembro.nombres,
    gimnasio: tenant.nombre,
    fecha: formatearFecha(ultimoPago.periodoFin, zonaHoraria),
    valor: FORMATO_MONEDA.format(precioPlan ?? ultimoPago.monto ?? 0),
  };
}

/**
 * El texto del aviso, IDENTICO a la plantilla `avisa_vence2` que recibe el miembro.
 * Se usa como REGISTRO en la bandeja (para que el hilo muestre lo mismo que le
 * llego) y como texto para proveedores sin plantilla (n8n). Con Twilio el cuerpo
 * lo fija la plantilla aprobada; este texto debe reflejarla, por eso los datos de
 * pago salen de `DATOS_PAGO_AVISO`. Todos los recordatorios (por vencer y vencido)
 * usan la MISMA plantilla, asi que el texto no cambia por etapa.
 */
export function construirMensaje({ miembro, ultimoPago, tenant, precioPlan }) {
  const d = datosAviso({ miembro, ultimoPago, tenant, precioPlan });
  return (
    `Hola ${d.nombre}, te recordamos que el pago de tu mensualidad en ${d.gimnasio} ` +
    `vence el ${d.fecha}. Valor a pagar: $ ${d.valor}.\n\n` +
    `Puedes realizar el pago por:\n${DATOS_PAGO_AVISO}\n\n` +
    'Cuando realices el pago, respondenos por este medio con la foto del comprobante para registrarlo.\n' +
    `Mensaje automatico de ${d.gimnasio}`
  );
}

/**
 * Las variables de la PLANTILLA, en el orden del cuerpo aprobado en Meta: nombre,
 * gimnasio, fecha de vencimiento y VALOR. `precioPlan` se resuelve FRESCO del plan
 * del ultimo pago (no del monto pagado). El VALOR va SOLO como numero ("70.000"):
 * el "$" es texto fijo en la plantilla ("Valor a pagar: $ {{4}}").
 */
export function construirVariables({ miembro, ultimoPago, tenant, precioPlan }) {
  const d = datosAviso({ miembro, ultimoPago, tenant, precioPlan });
  return [d.nombre, d.gimnasio, d.fecha, d.valor];
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
    .map((fila) => ({ ...fila, offset: offsetAvisoDeHoy(fila.ultimoPago, ahora, zonaHoraria) }))
    .filter((fila) => fila.offset !== null);

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
 * El offset de recordatorio que toca HOY para el ultimo pago, o `null` si ninguno.
 * Devuelve el offset (dias respecto al vencimiento) solo si los dias que faltan
 * (o lleva vencido) coinciden EXACTO con uno de `OFFSETS_AVISO_VENCIMIENTO` y ese
 * offset aun no se envio para este pago. Cada offset sale una sola vez.
 */
function offsetAvisoDeHoy(ultimoPago, ahora, zonaHoraria) {
  if (!ultimoPago) return null;

  const dias = diasCalendarioHasta(ultimoPago.periodoFin, ahora, zonaHoraria);
  if (!OFFSETS_AVISO_VENCIMIENTO.includes(dias)) return null;

  const enviados = ultimoPago.avisosEnviados ?? [];
  return enviados.includes(dias) ? null : dias;
}

async function avisarAMiembro(
  { miembro, ultimoPago, offset },
  { tenant, proveedor, precioPorPlan },
) {
  const Notificacion = obtenerModelo('Notificacion');
  const Pago = obtenerModelo('Pago');

  const precioPlan = precioPorPlan?.get(String(ultimoPago.planMembresia));
  const mensaje = construirMensaje({ miembro, ultimoPago, tenant, precioPlan });
  const variables = construirVariables({ miembro, ultimoPago, tenant, precioPlan });

  try {
    if (!miembro.telefono) throw new Error(SIN_TELEFONO);

    await proveedor.enviar({ telefono: miembro.telefono, mensaje, variables });

    await Notificacion.create({
      miembro: miembro._id,
      estado: ESTADOS_NOTIFICACION.ENVIADO,
      mensaje,
    });

    // Se anota SOLO el offset enviado, y solo tras confirmar: asi cada
    // recordatorio del ciclo sale una vez y un fallo no pierde este.
    await Pago.updateOne({ _id: ultimoPago._id }, { $addToSet: { avisosEnviados: offset } });

    // Deja rastro en la bandeja (hilo unificado). Best-effort: ya se envio.
    await registrarMensajeSaliente({
      tenantId: tenant._id,
      telefono: miembro.telefono,
      miembro: miembro._id,
      sede: miembro.sede,
      texto: mensaje,
      categoria: CATEGORIAS_MENSAJE_SALIENTE.AVISO,
    });

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
