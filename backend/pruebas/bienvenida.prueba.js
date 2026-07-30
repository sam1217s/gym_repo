import { beforeEach, describe, expect, it } from 'vitest';

import { ESTADOS_TENANT, PLANTILLA_BIENVENIDA } from '../src/config/constantes.js';
import { ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo } from '../src/modelos/indice.js';
import {
  construirVariablesBienvenida,
  darBienvenida,
} from '../src/servicios/bienvenida.servicio.js';
import { limpiarColecciones } from './configuracion.js';

/**
 * Bienvenida por WhatsApp al registrar un miembro. Lo critico: que sea
 * best-effort (nunca tumba el alta) y que use la plantilla de BIENVENIDA, no la
 * de vencimiento.
 */

async function crearTenant(config = {}) {
  return ejecutarSinTenant(async () => {
    const plan = await obtenerModelo('PlanPlataforma').create({
      nombre: `Plan ${Math.random()}`,
      precioMensual: 100_000,
      limites: { maxSedes: 5, maxMiembros: 500, maxUsuarios: 10 },
    });
    return obtenerModelo('Tenant').create({
      nombre: 'GymBienvenida',
      nit: '900888',
      slug: `gymb-${Math.random().toString(36).slice(2, 8)}`,
      estado: ESTADOS_TENANT.ACTIVO,
      planPlataforma: plan._id,
      config,
    });
  });
}

beforeEach(limpiarColecciones);

describe('Bienvenida por WhatsApp', () => {
  it('las variables son [nombre, gimnasio], en ese orden', () => {
    expect(
      construirVariablesBienvenida({ miembro: { nombres: 'Ana' }, tenant: { nombre: 'Gym' } }),
    ).toEqual(['Ana', 'Gym']);
  });

  it('envia con la plantilla de BIENVENIDA cuando el miembro tiene telefono', async () => {
    const tenant = await crearTenant();
    const enviados = [];
    let opcionesRecibidas = null;
    const crearProveedor = (_config, opciones) => {
      opcionesRecibidas = opciones;
      return { habilitado: true, enviar: async (p) => enviados.push(p) };
    };

    const r = await darBienvenida({ nombres: 'Ana', telefono: '573001' }, tenant._id, {
      crearProveedor,
    });

    expect(r.enviado).toBe(true);
    // Usa la plantilla de bienvenida, NO la de vencimiento.
    expect(opcionesRecibidas.plantilla).toBe(PLANTILLA_BIENVENIDA);
    expect(enviados).toHaveLength(1);
    expect(enviados[0].telefono).toBe('573001');
    expect(enviados[0].variables).toEqual(['Ana', 'GymBienvenida']);
  });

  it('no envia si el miembro no tiene telefono', async () => {
    const tenant = await crearTenant();
    const crearProveedor = () => {
      throw new Error('no deberia crearse el proveedor');
    };
    const r = await darBienvenida({ nombres: 'Ana' }, tenant._id, { crearProveedor });
    expect(r).toEqual({ enviado: false, motivo: 'sin_telefono' });
  });

  it('es best-effort: si el proveedor falla, NO lanza', async () => {
    const tenant = await crearTenant();
    const crearProveedor = () => ({
      habilitado: true,
      enviar: async () => {
        throw new Error('meta 400');
      },
    });

    const r = await darBienvenida({ nombres: 'Ana', telefono: '573001' }, tenant._id, {
      crearProveedor,
    });
    expect(r.enviado).toBe(false);
    expect(r.motivo).toBe('meta 400');
  });

  it('sin canal configurado no envia (proveedor por defecto = ninguno)', async () => {
    const tenant = await crearTenant(); // sin config.whatsapp
    const r = await darBienvenida({ nombres: 'Ana', telefono: '573001' }, tenant._id);
    expect(r).toEqual({ enviado: false, motivo: 'proveedor_ninguno' });
  });
});
