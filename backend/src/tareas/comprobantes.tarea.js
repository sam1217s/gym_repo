import cron from 'node-cron';

import {
  EXPRESION_CRON_PURGA_COMPROBANTES,
  ZONA_HORARIA_POR_DEFECTO,
} from '../config/constantes.js';
import { purgarComprobantesAntiguos } from '../servicios/mensajes.servicio.js';

/**
 * Limpieza diaria de comprobantes de WhatsApp.
 *
 * Las imagenes se guardan en el disco del servidor y nunca se borraban solas, asi
 * que el disco crecia sin tope. Esta tarea borra las mas viejas que la ventana de
 * retencion (`MESES_RETENCION_COMPROBANTE`) y suelta la referencia en el mensaje;
 * el registro del mensaje se conserva.
 *
 * Corre a nivel plataforma (la funcion abre `ejecutarSinTenant` por si misma),
 * igual que la cobranza. Se exporta la funcion de trabajo aparte del cron para
 * poder probarla y dispararla a mano.
 */

export async function ejecutarPurgaComprobantes(opciones = {}) {
  const { borrados } = await purgarComprobantesAntiguos(opciones);
  console.log(`[comprobantes] purga diaria: ${borrados} archivo(s) borrado(s)`);
  return borrados;
}

/** Programa la limpieza diaria. Devuelve la tarea para poder detenerla al apagar. */
export function programarPurgaComprobantes() {
  const tarea = cron.schedule(
    EXPRESION_CRON_PURGA_COMPROBANTES,
    () => {
      ejecutarPurgaComprobantes().catch((error) => {
        console.error('[comprobantes] la purga diaria fallo:', error.message);
      });
    },
    { timezone: ZONA_HORARIA_POR_DEFECTO },
  );

  console.log(
    `[comprobantes] cron programado (${EXPRESION_CRON_PURGA_COMPROBANTES} ${ZONA_HORARIA_POR_DEFECTO})`,
  );
  return tarea;
}
