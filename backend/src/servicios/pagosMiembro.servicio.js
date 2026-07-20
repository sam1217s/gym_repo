import {
  ESTADOS_TRANSACCION_WOMPI,
  EVENTO_WOMPI_TRANSACCION,
  METODOS_PAGO,
  PREFIJO_REFERENCIA_PAGO_MIEMBRO,
} from '../config/constantes.js';
import { entorno } from '../config/entorno.js';
import { ejecutarConTenant } from '../contexto/contextoTenant.js';
import { obtenerModelo } from '../modelos/indice.js';
import { aCentavos, construirEnlaceCheckout, verificarChecksumEvento } from '../pasarelas/wompi.pasarela.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';
import { sumarMeses } from '../utilidades/fechas.js';
import { firmarTokenPagoMiembro, verificarTokenPagoMiembro } from '../utilidades/token.js';

/**
 * Pago EN LINEA de un miembro: el miembro paga su mensualidad al Wompi DEL DUENO
 * (nivel de cobro "miembro"), no al de la plataforma. Dos entradas:
 *
 *   1. El enlace "Pagar ahora" del WhatsApp -> GET /api/pagar/:token
 *      (`construirCheckoutDesdeToken`): arma el checkout firmado con las llaves
 *      del gimnasio y redirige a Wompi.
 *   2. El webhook de Wompi -> POST /api/webhooks/wompi-miembro
 *      (`aplicarEventoPagoMiembro`): verifica con el secreto del gimnasio y, si
 *      el pago se aprobo, crea el `Pago` y renueva la mensualidad.
 *
 * La `reference` de Wompi lleva a que gimnasio y miembro pertenece el pago:
 *   `MB-<tenantId>-<miembroId>-<planId>-<nonce>`
 * El webhook la lee para saber con QUE secreto verificar la firma (cada gimnasio
 * tiene el suyo). El monto NO viaja en la referencia: la firma de integridad ya
 * garantiza que Wompi cobro exactamente lo que GymSaaS firmo.
 */

const SEPARADOR = '-';

/** El enlace publico que lleva el boton de WhatsApp. La base fija + el token. */
export function enlacePagoMiembro({ miembro, tenant }) {
  const token = firmarTokenPagoMiembro({ miembroId: miembro._id, tenantId: tenant._id });
  return `${entorno.ORIGEN_PUBLICO}/api/pagar/${token}`;
}

function construirReferencia(tenantId, miembroId, planId) {
  const nonce = Date.now().toString(36);
  return [PREFIJO_REFERENCIA_PAGO_MIEMBRO, tenantId, miembroId, planId, nonce].join(SEPARADOR);
}

function leerReferencia(referencia) {
  const partes = String(referencia).split(SEPARADOR);
  if (partes[0] !== PREFIJO_REFERENCIA_PAGO_MIEMBRO || partes.length < 4) return null;
  const [, tenantId, miembroId, planId] = partes;
  return { tenantId, miembroId, planId };
}

/** Las llaves Wompi del gimnasio, o `null` si el dueno aun no las configuro. */
function credencialesWompi(tenant) {
  const wompi = tenant.config?.wompi ?? {};
  if (!wompi.llavePublica || !wompi.secretoIntegridad) return null;
  return wompi;
}

/** El plan sobre el que se renueva: el del ULTIMO pago del miembro. */
async function ultimoPlanDelMiembro(miembroId) {
  const Pago = obtenerModelo('Pago');
  const ultimo = await Pago.findOne({ miembro: miembroId })
    .sort({ periodoFin: -1 })
    .populate('planMembresia');
  return ultimo?.planMembresia ?? null;
}

/**
 * Resuelve el token del enlace y devuelve la URL del checkout de Wompi del
 * gimnasio, ya firmada y con los datos del miembro prellenados. El monto y el
 * plan se resuelven AQUI, frescos: el token no los lleva, para no cobrar un
 * precio viejo.
 */
export async function construirCheckoutDesdeToken(token) {
  let carga;
  try {
    carga = verificarTokenPagoMiembro(token);
  } catch {
    throw ErrorApi.solicitudInvalida('El enlace de pago no es valido o ya expiro');
  }

  const Tenant = obtenerModelo('Tenant');
  const tenant = await Tenant.findById(carga.tenant);
  if (!tenant) throw ErrorApi.noEncontrado('El gimnasio ya no existe');

  const credenciales = credencialesWompi(tenant);
  if (!credenciales) {
    throw ErrorApi.solicitudInvalida('El gimnasio aun no tiene configurado el pago en linea');
  }

  return ejecutarConTenant(tenant._id, async () => {
    const Miembro = obtenerModelo('Miembro');
    const miembro = await Miembro.findById(carga.sub);
    if (!miembro || !miembro.activo) throw ErrorApi.noEncontrado('El miembro no existe');

    const plan = await ultimoPlanDelMiembro(miembro._id);
    if (!plan || !plan.activo) {
      throw ErrorApi.solicitudInvalida('No hay un plan vigente para renovar');
    }

    const referencia = construirReferencia(tenant._id, miembro._id, plan._id);

    return construirEnlaceCheckout({
      referencia,
      monto: plan.precio,
      credenciales,
      urlRedireccion: `${entorno.ORIGEN_PUBLICO}/api/pagar/gracias`,
      cliente: {
        nombre: miembro.nombreCompleto,
        telefono: miembro.telefono,
        email: miembro.email,
      },
    });
  });
}

/**
 * Aplica un evento de Wompi de un pago de miembro. Lo llama el webhook.
 *
 * La verificacion de la firma va DENTRO, no en el controlador, porque el secreto
 * es de cada gimnasio y hay que resolverlo por la referencia primero. Parsear la
 * referencia (dato no confiable) solo elige CON QUE secreto verificar; la firma
 * es la que autentica de verdad.
 */
export async function aplicarEventoPagoMiembro(evento) {
  if (evento.event !== EVENTO_WOMPI_TRANSACCION) return { ignorado: 'evento_no_manejado' };

  const transaccion = evento.data?.transaction;
  const ref = leerReferencia(transaccion?.reference);
  if (!ref) return { ignorado: 'referencia_ajena' };

  const Tenant = obtenerModelo('Tenant');
  const tenant = await Tenant.findById(ref.tenantId);
  const secretoEventos = tenant?.config?.wompi?.secretoEventos;
  if (!tenant || !secretoEventos) return { ignorado: 'gimnasio_sin_pago_en_linea' };

  // LA firma: sin esto, cualquiera podria hacer un POST y renovar mensualidades.
  if (!verificarChecksumEvento(evento, secretoEventos)) {
    throw ErrorApi.noAutenticado('Firma del evento invalida');
  }

  if (transaccion.status === ESTADOS_TRANSACCION_WOMPI.PENDIENTE) {
    return { ignorado: 'transaccion_pendiente' };
  }
  if (transaccion.status !== ESTADOS_TRANSACCION_WOMPI.APROBADA) {
    return { ignorado: 'transaccion_no_aprobada' };
  }

  return ejecutarConTenant(tenant._id, () => registrarPagoAprobado(transaccion, ref));
}

async function registrarPagoAprobado(transaccion, ref) {
  const Pago = obtenerModelo('Pago');
  const Miembro = obtenerModelo('Miembro');
  const PlanMembresia = obtenerModelo('PlanMembresia');

  // Wompi reintenta los webhooks: si ya se registro esta transaccion, no se
  // duplica el pago. El indice unico parcial lo blinda ademas a nivel de base.
  const yaRegistrado = await Pago.findOne({ transaccionWompi: transaccion.id });
  if (yaRegistrado) return { ignorado: 'ya_registrado', pago: yaRegistrado._id };

  const miembro = await Miembro.findById(ref.miembroId);
  if (!miembro || !miembro.activo) return { ignorado: 'miembro_inexistente' };

  const plan = await PlanMembresia.findById(ref.planId);
  if (!plan) return { ignorado: 'plan_inexistente' };

  // La firma de integridad ya garantiza el monto; se re-verifica contra el plan
  // como defensa en profundidad (una config vieja no debe dar por pagado de mas).
  if (transaccion.amount_in_cents !== aCentavos(plan.precio)) {
    return { ignorado: 'monto_no_coincide' };
  }

  const periodoInicio = await inicioDeRenovacion(miembro._id);
  const periodoFin = sumarMeses(periodoInicio, plan.duracionMeses);

  try {
    const pago = await Pago.create({
      sede: miembro.sede,
      miembro: miembro._id,
      planMembresia: plan._id,
      monto: plan.precio,
      metodoPago: METODOS_PAGO.WOMPI,
      referencia: transaccion.reference,
      transaccionWompi: transaccion.id,
      periodoInicio,
      periodoFin,
      registradoPor: null, // lo pago el propio miembro, no el staff
      notificado: false,
    });
    return { resultado: 'pagado', pago: pago._id };
  } catch (error) {
    // Carrera entre dos webhooks del mismo pago: el indice unico gana.
    if (error.code === 11000) return { ignorado: 'ya_registrado' };
    throw error;
  }
}

/**
 * Una renovacion arranca donde termina la mensualidad vigente, no hoy: si el
 * miembro paga con dias de sobra, no pierde los que le quedaban. Si ya vencio,
 * arranca hoy.
 */
async function inicioDeRenovacion(miembroId) {
  const Pago = obtenerModelo('Pago');
  const ultimo = await Pago.findOne({ miembro: miembroId }).sort({ periodoFin: -1 });
  const ahora = new Date();

  if (ultimo && ultimo.periodoFin > ahora) return ultimo.periodoFin;
  return ahora;
}
