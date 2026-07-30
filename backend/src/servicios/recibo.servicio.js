import { PLANTILLA_RECIBO } from '../config/constantes.js';
import { obtenerModelo } from '../modelos/indice.js';
import { crearProveedor as crearProveedorPorDefecto } from '../proveedores/indice.js';

/**
 * Recibo de pago por WhatsApp: al registrar un pago desde el panel se le confirma
 * al miembro con la plantilla `recibo_pago`.
 *
 * BEST-EFFORT y NUNCA lanza: se llama sin `await` desde `registrarPago`, asi que
 * un fallo del canal jamas frena ni rompe el pago. Como es plantilla NUEVA,
 * mientras el gimnasio no la tenga aprobada el envio falla en silencio.
 *
 * Los pagos aprobados DESDE LA BANDEJA no pasan por aqui (llevan `omitirRecibo`):
 * alli ya se responde texto libre gratis dentro de la ventana de 24h.
 */

const ZONA_HORARIA = 'America/Bogota';

const FORMATO_MONEDA = new Intl.NumberFormat('es-CO');
const FORMATO_FECHA = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: ZONA_HORARIA,
});

/** Texto libre (lo usan los proveedores de texto, p.ej. n8n). */
export function construirMensajeRecibo({ miembro, tenant, pago }) {
  return (
    `Hola ${miembro.nombres}, confirmamos el pago de tu mensualidad en ${tenant.nombre}. ` +
    `Valor pagado: $${FORMATO_MONEDA.format(pago.monto)}. ` +
    `Tu membresia queda al dia hasta el ${FORMATO_FECHA.format(new Date(pago.periodoFin))}. Gracias.`
  );
}

/** Variables de la plantilla: nombre, gimnasio, valor pagado y fecha de vencimiento. */
export function construirVariablesRecibo({ miembro, tenant, pago }) {
  return [
    miembro.nombres,
    tenant.nombre,
    `$${FORMATO_MONEDA.format(pago.monto)}`,
    FORMATO_FECHA.format(new Date(pago.periodoFin)),
  ];
}

/**
 * `tenantId` viene explicito porque esto corre fire-and-forget, fuera del
 * contexto de la peticion. `Tenant` es coleccion de plataforma (sin plugin): se
 * lee por id sin contexto.
 */
export async function enviarReciboPago(
  pago,
  miembro,
  tenantId,
  { crearProveedor = crearProveedorPorDefecto } = {},
) {
  try {
    if (!miembro?.telefono) return { enviado: false, motivo: 'sin_telefono' };

    const tenant = await obtenerModelo('Tenant').findById(tenantId);
    if (!tenant) return { enviado: false, motivo: 'sin_tenant' };

    const proveedor = crearProveedor(tenant.config?.whatsapp, { plantilla: PLANTILLA_RECIBO });
    if (!proveedor.habilitado) return { enviado: false, motivo: 'proveedor_ninguno' };

    await proveedor.enviar({
      telefono: miembro.telefono,
      mensaje: construirMensajeRecibo({ miembro, tenant, pago }),
      variables: construirVariablesRecibo({ miembro, tenant, pago }),
    });
    return { enviado: true };
  } catch (error) {
    return { enviado: false, motivo: error.message };
  }
}
