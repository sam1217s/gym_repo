import { PLANTILLA_BIENVENIDA } from '../config/constantes.js';
import { obtenerModelo } from '../modelos/indice.js';
import { crearProveedor as crearProveedorPorDefecto } from '../proveedores/indice.js';

/**
 * Bienvenida por WhatsApp al registrar un miembro. Le da contexto de que por
 * ese canal se manejan los avisos y comprobantes de la mensualidad.
 *
 * Es BEST-EFFORT y NUNCA lanza: se llama sin `await` desde `crearMiembro`, asi
 * que un fallo del canal jamas debe tumbar (ni frenar) el alta del miembro.
 *
 * Como es una plantilla NUEVA, mientras el gimnasio no la tenga aprobada en su
 * WABA el envio simplemente falla en silencio; el alta sigue funcionando igual.
 */

/** Texto libre (lo usan los proveedores de texto, p.ej. n8n). */
export function construirMensajeBienvenida({ miembro, tenant }) {
  return (
    `¡Hola ${miembro.nombres}! Te damos la bienvenida a ${tenant.nombre}. ` +
    'Por este WhatsApp te enviaremos los recordatorios de tu mensualidad y aqui ' +
    'puedes mandarnos el comprobante de tus pagos. ¡Gracias por unirte!'
  );
}

/** Variables de la plantilla, en el orden aprobado: nombre del miembro y gimnasio. */
export function construirVariablesBienvenida({ miembro, tenant }) {
  return [miembro.nombres, tenant.nombre];
}

/**
 * Envia la bienvenida. `tenantId` viene explicito porque esto corre
 * fire-and-forget, fuera del contexto de la peticion (el AsyncLocalStorage ya
 * se cerro). `Tenant` es coleccion de plataforma (sin plugin): no necesita
 * contexto para leerse.
 */
export async function darBienvenida(
  miembro,
  tenantId,
  { crearProveedor = crearProveedorPorDefecto } = {},
) {
  try {
    if (!miembro?.telefono) return { enviado: false, motivo: 'sin_telefono' };

    const tenant = await obtenerModelo('Tenant').findById(tenantId);
    if (!tenant) return { enviado: false, motivo: 'sin_tenant' };

    const proveedor = crearProveedor(tenant.config?.whatsapp, { plantilla: PLANTILLA_BIENVENIDA });
    if (!proveedor.habilitado) return { enviado: false, motivo: 'proveedor_ninguno' };

    await proveedor.enviar({
      telefono: miembro.telefono,
      mensaje: construirMensajeBienvenida({ miembro, tenant }),
      variables: construirVariablesBienvenida({ miembro, tenant }),
    });
    return { enviado: true };
  } catch (error) {
    // Best-effort: el alta ya quedo hecha; el aviso fallido no importa.
    return { enviado: false, motivo: error.message };
  }
}
