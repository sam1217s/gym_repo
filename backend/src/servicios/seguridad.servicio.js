import { PLANTILLA_LOGIN, ROLES } from '../config/constantes.js';
import { crearProveedor as crearProveedorPorDefecto } from '../proveedores/indice.js';
import { ubicarIp as ubicarIpPorDefecto } from '../utilidades/geoIp.js';

/**
 * Aviso de SEGURIDAD por WhatsApp cuando el DUEÑO inicia sesion, para que se
 * entere si alguien mas entra con sus credenciales. Solo el dueño lo recibe (los
 * administradores no): su actividad ya queda en el panel de auditoria.
 *
 * BEST-EFFORT y NUNCA lanza: se llama sin `await` desde el controlador de login,
 * asi que un fallo del canal (o de la geolocalizacion) jamas frena ni rompe el
 * inicio de sesion. Como es una plantilla NUEVA, mientras no este aprobada en la
 * cuenta de Twilio el envio falla en silencio.
 *
 * La geolocalizacion solo se intenta si el canal esta habilitado: asi, sin
 * WhatsApp configurado (p.ej. en pruebas), no se hace ninguna llamada de red.
 */

const ZONA_HORARIA = 'America/Bogota';

const FORMATO_FECHA_HORA = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: ZONA_HORARIA,
});

/** Texto libre (lo usan los proveedores de texto, p.ej. n8n). */
export function construirMensajeLogin({ usuario, tenant, fecha, ubicacion }) {
  return (
    `Hola ${usuario.nombres}, se inicio sesion en tu cuenta de ${tenant.nombre} ` +
    `el ${fecha} desde ${ubicacion}. Si no fuiste tu, cambia tu contrasena de inmediato.`
  );
}

/** Variables de la plantilla, en orden: nombre del dueño, fecha y hora, ubicacion. */
export function construirVariablesLogin({ usuario, fecha, ubicacion }) {
  return [usuario.nombres, fecha, ubicacion];
}

/**
 * @param {{ usuario: object, tenant: object, ip: string }} datos  Ya cargados por
 *   el flujo de login; no se vuelven a consultar.
 */
export async function avisarInicioSesionDueno(
  { usuario, tenant, ip },
  { crearProveedor = crearProveedorPorDefecto, geolocalizar = ubicarIpPorDefecto } = {},
) {
  try {
    // Solo el dueño recibe el aviso de seguridad.
    if (usuario.rol !== ROLES.TENANT_OWNER) return { enviado: false, motivo: 'no_es_dueno' };
    if (!usuario.telefono) return { enviado: false, motivo: 'sin_telefono' };

    const proveedor = crearProveedor({ plantilla: PLANTILLA_LOGIN });
    if (!proveedor.habilitado) return { enviado: false, motivo: 'proveedor_ninguno' };

    const ubicacion = (await geolocalizar(ip)) || 'ubicacion desconocida';
    const fecha = FORMATO_FECHA_HORA.format(new Date());

    await proveedor.enviar({
      telefono: usuario.telefono,
      mensaje: construirMensajeLogin({ usuario, tenant, fecha, ubicacion }),
      variables: construirVariablesLogin({ usuario, fecha, ubicacion }),
    });
    return { enviado: true };
  } catch (error) {
    // Best-effort: la sesion ya quedo abierta; el aviso fallido no importa.
    return { enviado: false, motivo: error.message };
  }
}
