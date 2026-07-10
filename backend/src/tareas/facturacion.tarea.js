import cron from 'node-cron';

import { EXPRESION_CRON_FACTURACION, ZONA_HORARIA_POR_DEFECTO } from '../config/constantes.js';
import { ejecutarSinTenant } from '../contexto/contextoTenant.js';
import {
  generarFacturasDelMes,
  suspenderMorosos,
} from '../servicios/facturacionPlataforma.servicio.js';

/**
 * Cobranza diaria.
 *
 * Corre entera dentro de `ejecutarSinTenant`: `Tenant` y `FacturaPlataforma`
 * son colecciones de plataforma y esta tarea trabaja para GymSaaS, no para un
 * gimnasio en particular. Es lo contrario del cron de vencimientos, que abre un
 * contexto por gimnasio.
 *
 * Generar es idempotente (indice unico `{ tenant, periodoInicio }`), asi que
 * correrla varias veces al dia no duplica facturas ni cobros.
 */

export async function ejecutarCobranza(ahora = new Date()) {
  return ejecutarSinTenant(async () => {
    const creadas = await generarFacturasDelMes(ahora);
    const suspendidos = await suspenderMorosos(ahora);

    return { facturasCreadas: creadas.length, gimnasiosSuspendidos: suspendidos.length };
  });
}

/** Programa la cobranza diaria. Devuelve la tarea para poder detenerla al apagar. */
export function programarCobranza() {
  const tarea = cron.schedule(
    EXPRESION_CRON_FACTURACION,
    () => {
      ejecutarCobranza().catch((error) => {
        console.error('[cobranza] la corrida diaria fallo:', error.message);
      });
    },
    { timezone: ZONA_HORARIA_POR_DEFECTO },
  );

  console.log(`[cobranza] cron programado (${EXPRESION_CRON_FACTURACION} ${ZONA_HORARIA_POR_DEFECTO})`);
  return tarea;
}
