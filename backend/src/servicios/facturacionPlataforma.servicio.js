import {
  DIAS_GRACIA_PAGO,
  ESTADOS_FACTURA,
  ESTADOS_TENANT,
  ESTADOS_TENANT_OPERATIVOS,
  ESTADOS_TRANSACCION_WOMPI,
  EVENTO_WOMPI_TRANSACCION,
} from '../config/constantes.js';
import { obtenerModelo } from '../modelos/indice.js';
import { aCentavos, construirEnlaceCheckout } from '../pasarelas/wompi.pasarela.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';
import {
  claveDeMes,
  inicioDeMes,
  inicioDeMesSiguiente,
  sumarDias,
} from '../utilidades/fechas.js';

/**
 * Facturacion de plataforma: lo que el gimnasio le paga a GymSaaS.
 *
 * `FacturaPlataforma` no lleva el plugin de aislamiento (es coleccion de
 * plataforma), asi que TODA consulta hecha en nombre de un gimnasio filtra por
 * `tenant` a mano. Igual que `usuarios.servicio.js`.
 *
 * Reglas del dinero, todas verificadas por pruebas:
 *   - Una sola factura por gimnasio y mes (indice unico): el cron es idempotente.
 *   - Solo `APPROVED` da una factura por pagada.
 *   - El monto que confirma Wompi tiene que coincidir con el de la factura.
 *   - Un gimnasio CANCELADO no revive por pagar. Cancelar es terminal.
 */

const CODIGO_DUPLICADO_MONGO = 11000;

/** `GS-2026-07-<id>`: legible en el panel de Wompi y estable para reintentos. */
function construirReferencia(tenant, periodoInicio) {
  return `GS-${claveDeMes(periodoInicio)}-${tenant._id}`;
}

/**
 * Crea la factura del mes en curso para cada gimnasio operativo que no la
 * tenga. Idempotente por el indice unico `{ tenant, periodoInicio }`: dos
 * corridas el mismo dia no duplican nada.
 *
 * Los gimnasios en `trial` tambien se facturan: pagar la primera factura es
 * justo lo que los convierte en `activo`.
 */
export async function generarFacturasDelMes(ahora = new Date()) {
  const Tenant = obtenerModelo('Tenant');
  const Factura = obtenerModelo('FacturaPlataforma');

  const periodoInicio = inicioDeMes(ahora);
  const periodoFin = inicioDeMesSiguiente(ahora);

  const tenants = await Tenant.find({ estado: { $in: ESTADOS_TENANT_OPERATIVOS } }).populate(
    'planPlataforma',
  );

  const creadas = [];

  for (const tenant of tenants) {
    // Los 2 meses gratis: mientras dure la prueba, no se emite factura.
    if (tenant.finTrial && ahora < tenant.finTrial) continue;

    try {
      const factura = await Factura.create({
        tenant: tenant._id,
        planPlataforma: tenant.planPlataforma._id,
        periodoInicio,
        periodoFin,
        monto: tenant.planPlataforma.precioMensual,
        referencia: construirReferencia(tenant, periodoInicio),

        /**
         * El plazo corre desde que se EMITE la factura, no desde el dia 1 del
         * mes. Con `periodoInicio + gracia`, un gimnasio dado de alta a mitad
         * de mes recibiria una factura ya vencida y el mismo cron lo
         * suspenderia el dia que lo factura por primera vez.
         */
        fechaVencimiento: sumarDias(ahora, DIAS_GRACIA_PAGO),
      });
      creadas.push(factura);
    } catch (error) {
      // Ya existia la del mes: es el caso normal en la segunda corrida del dia.
      if (error.code !== CODIGO_DUPLICADO_MONGO) throw error;
    }
  }

  return creadas;
}

/**
 * Suspende a quien dejo vencer una factura sin pagarla. No toca a los que ya
 * estan suspendidos ni a los cancelados.
 */
export async function suspenderMorosos(ahora = new Date()) {
  const Factura = obtenerModelo('FacturaPlataforma');
  const Tenant = obtenerModelo('Tenant');

  const vencidas = await Factura.find({
    estado: ESTADOS_FACTURA.PENDIENTE,
    fechaVencimiento: { $lt: ahora },
  });

  const suspendidos = [];

  for (const factura of vencidas) {
    const resultado = await Tenant.updateOne(
      { _id: factura.tenant, estado: { $in: ESTADOS_TENANT_OPERATIVOS } },
      { estado: ESTADOS_TENANT.SUSPENDIDO },
    );

    if (resultado.modifiedCount > 0) suspendidos.push(String(factura.tenant));
  }

  return suspendidos;
}

// --- Consulta ----------------------------------------------------------------

export function listarFacturasDeTenant(tenantId) {
  const Factura = obtenerModelo('FacturaPlataforma');
  return Factura.find({ tenant: tenantId }).sort({ periodoInicio: -1 });
}

/** La factura pendiente mas antigua, que es la que hay que pagar primero. */
export async function obtenerFacturaPendiente(tenantId) {
  const Factura = obtenerModelo('FacturaPlataforma');
  return Factura.findOne({ tenant: tenantId, estado: ESTADOS_FACTURA.PENDIENTE }).sort({
    periodoInicio: 1,
  });
}

/**
 * Enlace de pago de una factura del gimnasio. El `tenantId` va en la busqueda:
 * un dueno no puede pedir el enlace de la factura de otro gimnasio.
 */
export async function obtenerEnlaceDePago(tenantId, facturaId) {
  const Factura = obtenerModelo('FacturaPlataforma');
  const factura = await Factura.findOne({ _id: facturaId, tenant: tenantId });

  if (!factura) throw ErrorApi.noEncontrado('La factura no existe');
  if (factura.estaPagada()) throw ErrorApi.conflicto('Esa factura ya esta pagada');

  return construirEnlaceCheckout({
    referencia: factura.referencia,
    monto: factura.monto,
    moneda: factura.moneda,
  });
}

// --- Entrada de la pasarela ---------------------------------------------------

/**
 * Aplica un evento ya VERIFICADO de Wompi. Quien llama debe haber comprobado el
 * checksum: este servicio confia en el payload.
 *
 * Devuelve siempre un resumen y nunca lanza por un evento que no le interesa:
 * un webhook al que se responde con un error hace que Wompi lo reintente.
 */
export async function aplicarEventoDePago(evento) {
  if (evento.event !== EVENTO_WOMPI_TRANSACCION) {
    return { ignorado: 'evento_no_manejado' };
  }

  const transaccion = evento.data?.transaction;
  if (!transaccion?.reference) return { ignorado: 'evento_sin_referencia' };

  const Factura = obtenerModelo('FacturaPlataforma');
  const factura = await Factura.findOne({ referencia: transaccion.reference });

  if (!factura) return { ignorado: 'referencia_desconocida' };

  // Wompi reintenta los webhooks: aplicar dos veces el mismo pago no debe
  // cambiar nada.
  if (factura.estaPagada()) return { ignorado: 'ya_pagada' };

  if (transaccion.status === ESTADOS_TRANSACCION_WOMPI.PENDIENTE) {
    return { ignorado: 'transaccion_pendiente' };
  }

  if (transaccion.status !== ESTADOS_TRANSACCION_WOMPI.APROBADA) {
    factura.estado = ESTADOS_FACTURA.FALLIDA;
    factura.transaccionId = transaccion.id ?? null;
    factura.detalleFallo = transaccion.status_message ?? transaccion.status;
    await factura.save();

    return { factura: factura._id, resultado: 'fallida' };
  }

  /**
   * El monto lo manda la pasarela; la factura es la fuente de verdad. Si no
   * coinciden, o alguien manipulo el checkout o hay un bug de configuracion:
   * en los dos casos, NO se da por pagada.
   */
  if (transaccion.amount_in_cents !== aCentavos(factura.monto)) {
    factura.estado = ESTADOS_FACTURA.FALLIDA;
    factura.transaccionId = transaccion.id ?? null;
    factura.detalleFallo = `Monto no coincide: se esperaban ${aCentavos(factura.monto)} centavos y llegaron ${transaccion.amount_in_cents}`;
    await factura.save();

    return { factura: factura._id, resultado: 'monto_no_coincide' };
  }

  factura.estado = ESTADOS_FACTURA.PAGADA;
  factura.transaccionId = transaccion.id ?? null;
  factura.metodoPago = transaccion.payment_method_type ?? null;
  factura.pagadaEn = new Date();
  factura.detalleFallo = null;
  await factura.save();

  const activado = await activarPorPago(factura.tenant);

  return { factura: factura._id, resultado: 'pagada', tenantActivado: activado };
}

/**
 * Un pago devuelve al gimnasio a `activo`, venga de `trial` (primera factura)
 * o de `suspendido` (se puso al dia).
 *
 * Un gimnasio `cancelado` NO revive: cancelar es terminal, y pagar una factura
 * vieja no puede ser la puerta trasera que lo reactive.
 */
async function activarPorPago(tenantId) {
  const Tenant = obtenerModelo('Tenant');

  const resultado = await Tenant.updateOne(
    { _id: tenantId, estado: { $in: [ESTADOS_TENANT.TRIAL, ESTADOS_TENANT.SUSPENDIDO] } },
    { estado: ESTADOS_TENANT.ACTIVO },
  );

  return resultado.modifiedCount > 0;
}
