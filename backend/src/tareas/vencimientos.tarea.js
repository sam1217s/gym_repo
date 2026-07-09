import cron from 'node-cron';

import {
  ESTADOS_TENANT_OPERATIVOS,
  EXPRESION_CRON_VENCIMIENTOS,
  ZONA_HORARIA_POR_DEFECTO,
} from '../config/constantes.js';
import { ejecutarConTenant, ejecutarSinTenant } from '../contexto/contextoTenant.js';
import { obtenerModelo } from '../modelos/indice.js';
import { notificarVencimientosDelTenant } from '../servicios/notificaciones.servicio.js';

/**
 * Cron diario de avisos de vencimiento.
 *
 * Vive fuera de toda peticion HTTP, asi que nadie abre el contexto de tenant
 * por el: lo abre a mano, uno por gimnasio.
 *
 *   ejecutarSinTenant  -> listar los gimnasios (coleccion de plataforma)
 *   ejecutarConTenant  -> avisar dentro de CADA uno (colecciones aisladas)
 *
 * Se avisa a los gimnasios OPERATIVOS (`trial` y `activo`), no solo a los
 * `activo`: un gimnasio en periodo de prueba tiene miembros de verdad que
 * vencen de verdad. `ESTADOS_TENANT_OPERATIVOS` es la misma lista que decide
 * quien puede iniciar sesion.
 */

/**
 * Recorre los gimnasios y avisa. Exportada aparte del cron para poder probarla
 * y dispararla a mano sin esperar a las 9 de la mañana.
 *
 * Un gimnasio que falla (credenciales malas, proveedor caido) no tumba a los
 * demas: su error se registra y la corrida sigue.
 */
export async function ejecutarAvisosDeVencimiento(opciones = {}) {
  const tenants = await ejecutarSinTenant(() =>
    obtenerModelo('Tenant')
      .find({ estado: { $in: ESTADOS_TENANT_OPERATIVOS } })
      .populate('planPlataforma'),
  );

  const resumen = [];

  for (const tenant of tenants) {
    try {
      const resultado = await ejecutarConTenant(tenant._id, () =>
        notificarVencimientosDelTenant(tenant, opciones),
      );
      resumen.push({ tenant: tenant.slug, ...resultado });
    } catch (error) {
      resumen.push({ tenant: tenant.slug, error: error.message });
      console.error(`[avisos] ${tenant.slug} fallo:`, error.message);
    }
  }

  return resumen;
}

/** Programa la corrida diaria. Devuelve la tarea para poder detenerla al apagar. */
export function programarAvisosDeVencimiento() {
  const tarea = cron.schedule(
    EXPRESION_CRON_VENCIMIENTOS,
    () => {
      ejecutarAvisosDeVencimiento().catch((error) => {
        console.error('[avisos] la corrida diaria fallo:', error.message);
      });
    },
    { timezone: ZONA_HORARIA_POR_DEFECTO },
  );

  console.log(`[avisos] cron programado (${EXPRESION_CRON_VENCIMIENTOS} ${ZONA_HORARIA_POR_DEFECTO})`);
  return tarea;
}
