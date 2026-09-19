import { beforeEach, describe, expect, it } from 'vitest';

import { PLANTILLA_RECIBO } from '../src/config/constantes.js';
import { ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo } from '../src/modelos/indice.js';
import {
  construirVariablesRecibo,
  enviarReciboPago,
} from '../src/servicios/recibo.servicio.js';
import { limpiarColecciones } from './configuracion.js';

/**
 * Recibo de pago por WhatsApp. Lo critico: best-effort (nunca tumba el pago) y
 * que use la plantilla de RECIBO con nombre, gimnasio, valor y vencimiento.
 */

async function crearTenant(config = {}) {
  return ejecutarSinTenant(async () => {
    return obtenerModelo('Tenant').create({
      nombre: 'GymRecibo',
      nit: '900999',
      slug: `gymr-${Math.random().toString(36).slice(2, 8)}`,
      config,
    });
  });
}

const PAGO = { monto: 70_000, periodoFin: new Date('2026-08-23T05:00:00.000Z') };

beforeEach(limpiarColecciones);

describe('Recibo de pago por WhatsApp', () => {
  it('las variables son [nombre, gimnasio, valor, fecha]', () => {
    const vars = construirVariablesRecibo({
      miembro: { nombres: 'Ana' },
      tenant: { nombre: 'Gym' },
      pago: PAGO,
    });
    expect(vars[0]).toBe('Ana');
    expect(vars[1]).toBe('Gym');
    expect(vars[2]).toBe('$70.000');
    expect(vars[3]).toMatch(/^\d{2}\/\d{2}\/\d{4}$/); // DD/MM/YYYY
  });

  it('envia con la plantilla de RECIBO cuando el miembro tiene telefono', async () => {
    const tenant = await crearTenant();
    const enviados = [];
    let opcionesRecibidas = null;
    const crearProveedor = (opciones) => {
      opcionesRecibidas = opciones;
      return { habilitado: true, enviar: async (p) => enviados.push(p) };
    };

    const r = await enviarReciboPago(PAGO, { nombres: 'Ana', telefono: '573001' }, tenant._id, {
      crearProveedor,
    });

    expect(r.enviado).toBe(true);
    expect(opcionesRecibidas.plantilla).toBe(PLANTILLA_RECIBO);
    expect(enviados[0].telefono).toBe('573001');
    expect(enviados[0].variables[2]).toBe('$70.000');
  });

  it('no envia si el miembro no tiene telefono', async () => {
    const tenant = await crearTenant();
    const r = await enviarReciboPago(PAGO, { nombres: 'Ana' }, tenant._id, {
      crearProveedor: () => {
        throw new Error('no deberia crearse');
      },
    });
    expect(r).toEqual({ enviado: false, motivo: 'sin_telefono' });
  });

  it('es best-effort: si el proveedor falla, NO lanza', async () => {
    const tenant = await crearTenant();
    const r = await enviarReciboPago(PAGO, { nombres: 'Ana', telefono: '573001' }, tenant._id, {
      crearProveedor: () => ({
        habilitado: true,
        enviar: async () => {
          throw new Error('meta 400');
        },
      }),
    });
    expect(r).toEqual({ enviado: false, motivo: 'meta 400' });
  });

  it('sin canal configurado no envia (proveedor por defecto = ninguno)', async () => {
    const tenant = await crearTenant();
    const r = await enviarReciboPago(PAGO, { nombres: 'Ana', telefono: '573001' }, tenant._id);
    expect(r).toEqual({ enviado: false, motivo: 'proveedor_ninguno' });
  });
});
