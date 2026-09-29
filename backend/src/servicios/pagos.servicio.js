import { obtenerContexto } from '../contexto/contextoTenant.js';
import { obtenerModelo } from '../modelos/indice.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';
import { sumarDuracion } from '../utilidades/fechas.js';
import { enviarReciboPago } from './recibo.servicio.js';

/**
 * Registro y consulta de pagos de mensualidad.
 *
 * La regla central del producto: `periodoFin = periodoInicio + plan.duracionMeses`,
 * calculado UNA vez aqui y nunca mutado. El vencimiento del miembro se deriva
 * de este campo (ver `vencimientos.servicio.js`); no existe en ningun otro sitio.
 *
 * Se suman MESES de calendario, no bloques de 30 dias: quien paga el 31 de enero
 * vence el 28 de febrero. Ver `sumarMeses()`.
 */

export function listarPagos(filtroSede = {}, { miembro } = {}) {
  const Pago = obtenerModelo('Pago');

  const filtro = { ...filtroSede };
  if (miembro) filtro.miembro = miembro;

  return Pago.find(filtro)
    .sort({ fechaPago: -1 })
    .populate('planMembresia', 'nombre duracionMeses duracionDias')
    .populate('miembro', 'nombres apellidos documento');
}

export async function registrarPago(datos, filtroSede = {}) {
  const Miembro = obtenerModelo('Miembro');
  const PlanMembresia = obtenerModelo('PlanMembresia');
  const Pago = obtenerModelo('Pago');

  // Con el filtro de sede en la busqueda, un sede_admin no puede cobrarle a un
  // miembro de otra sede: para el, ese miembro no existe.
  const miembro = await Miembro.findOne({ _id: datos.miembro, ...filtroSede });
  if (!miembro) throw ErrorApi.noEncontrado('El miembro no existe');
  if (!miembro.activo) throw ErrorApi.solicitudInvalida('El miembro esta desactivado');

  const plan = await PlanMembresia.findById(datos.planMembresia);
  if (!plan) throw ErrorApi.solicitudInvalida('El plan de membresia no existe');
  if (!plan.activo) throw ErrorApi.solicitudInvalida('Ese plan esta archivado');

  // Los planes son POR SEDE: a un miembro solo se le cobra con un plan de SU
  // sede, aunque quien cobre sea el dueno y vea los de todas.
  if (String(plan.sede) !== String(miembro.sede)) {
    throw ErrorApi.solicitudInvalida('Ese plan es de otra sede');
  }

  const periodoInicio = datos.periodoInicio ?? new Date();
  const periodoFin = sumarDuracion(periodoInicio, plan);

  const pago = await Pago.create({
    sede: miembro.sede, // el pago pertenece a la sede del miembro, no a la de quien cobra
    miembro: miembro._id,
    planMembresia: plan._id,
    monto: datos.monto ?? plan.precio,
    metodoPago: datos.metodoPago,
    referencia: datos.referencia ?? '',
    periodoInicio,
    periodoFin,
    registradoPor: obtenerContexto().usuarioId,
  });

  // Recibo por WhatsApp: fire-and-forget, best-effort, nunca frena el pago. Se
  // omite cuando la aprobacion viene de la bandeja (`omitirRecibo`): alli ya se
  // responde texto libre gratis dentro de la ventana de 24h.
  if (!datos.omitirRecibo) {
    const { tenantId } = obtenerContexto();
    enviarReciboPago(pago, miembro, tenantId).catch(() => {});
  }

  return pago.populate('planMembresia', 'nombre duracionMeses duracionDias');
}

/**
 * Corrige un pago ya registrado. Es cosa del DUEÑO: para arreglar una fecha o un
 * monto mal tecleados sin borrar el historial.
 *
 * Lo delicado es el PERIODO. Si cambia `periodoInicio` (o el plan, que define la
 * duracion), se RECALCULA `periodoFin` con la misma regla que al registrar
 * (`sumarDuracion`): el vencimiento del miembro se deriva de ahi, asi que no se
 * puede tocar el inicio y dejar el fin viejo. Ademas se vacia `avisosEnviados`:
 * los recordatorios eran del periodo anterior, y el cron debe reevaluarlos sobre
 * el periodo corregido.
 */
export async function actualizarPago(id, datos, filtroSede = {}) {
  const Pago = obtenerModelo('Pago');
  const PlanMembresia = obtenerModelo('PlanMembresia');

  const pago = await Pago.findOne({ _id: id, ...filtroSede });
  if (!pago) throw ErrorApi.noEncontrado('El pago no existe');

  // Si cambia el plan, debe ser de la MISMA sede del pago (misma regla de cobro).
  let planNuevo = null;
  if (datos.planMembresia && String(datos.planMembresia) !== String(pago.planMembresia)) {
    planNuevo = await PlanMembresia.findById(datos.planMembresia);
    if (!planNuevo) throw ErrorApi.solicitudInvalida('El plan de membresia no existe');
    if (String(planNuevo.sede) !== String(pago.sede)) {
      throw ErrorApi.solicitudInvalida('Ese plan es de otra sede');
    }
    pago.planMembresia = planNuevo._id;
  }

  if (datos.metodoPago !== undefined) pago.metodoPago = datos.metodoPago;
  if (datos.referencia !== undefined) pago.referencia = datos.referencia;
  if (datos.monto !== undefined) pago.monto = datos.monto;

  // El fin se recalcula si cambio el inicio O el plan (que fija la duracion).
  if (datos.periodoInicio !== undefined || planNuevo) {
    if (datos.periodoInicio !== undefined) pago.periodoInicio = datos.periodoInicio;

    const planDuracion = planNuevo ?? (await PlanMembresia.findById(pago.planMembresia));
    if (!planDuracion) throw ErrorApi.solicitudInvalida('El plan del pago ya no existe');

    pago.periodoFin = sumarDuracion(pago.periodoInicio, planDuracion);
    pago.avisosEnviados = [];
  }

  await pago.save();
  return pago.populate('planMembresia', 'nombre duracionMeses duracionDias');
}
