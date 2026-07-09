import peticion from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  ESTADOS_TENANT,
  ESTADOS_VENCIMIENTO,
  METODOS_PAGO,
  MILISEGUNDOS_POR_DIA,
  ROLES,
} from '../src/config/constantes.js';
import { ejecutarConTenant, ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo } from '../src/modelos/indice.js';
import { derivarEstado } from '../src/servicios/vencimientos.servicio.js';
import { crearServidor } from '../src/servidor.js';
import { cifrarContrasena } from '../src/utilidades/contrasena.js';
import { limpiarColecciones } from './configuracion.js';

/**
 * Pagos y vencimientos: `periodoFin = periodoInicio + plan.duracionDias`, la
 * referencia obligatoria en transferencias, y el estado del miembro derivado
 * de su ULTIMO pago (nunca guardado).
 */

const CONTRASENA = 'ClaveInicial1';

const app = crearServidor();

async function montarGimnasio() {
  const tenant = await ejecutarSinTenant(async () => {
    const plan = await obtenerModelo('PlanPlataforma').create({
      nombre: `Plan ${Math.random()}`,
      precioMensual: 100_000,
      limites: { maxSedes: 5, maxMiembros: 500, maxUsuarios: 10 },
    });

    return obtenerModelo('Tenant').create({
      nombre: 'Gimnasio',
      nit: '900111',
      slug: 'gimnasio-pagos',
      estado: ESTADOS_TENANT.ACTIVO,
      planPlataforma: plan._id,
    });
  });

  const { sedes, planMensual, miembros } = await ejecutarConTenant(tenant._id, async () => {
    const Sede = obtenerModelo('Sede');
    const norte = await Sede.create({ nombre: 'Norte', direccion: 'Calle 100' });
    const sur = await Sede.create({ nombre: 'Sur', direccion: 'Carrera 30' });

    const planMensual = await obtenerModelo('PlanMembresia').create({
      nombre: 'Mensual',
      precio: 60_000,
      duracionDias: 30,
    });

    const Miembro = obtenerModelo('Miembro');
    const ana = await Miembro.create({
      sede: norte._id,
      nombres: 'Ana',
      apellidos: 'Norte',
      documento: '111',
      telefono: '573001111111',
    });
    const beto = await Miembro.create({
      sede: sur._id,
      nombres: 'Beto',
      apellidos: 'Sur',
      documento: '222',
      telefono: '573002222222',
    });

    return { sedes: { norte, sur }, planMensual, miembros: { ana, beto } };
  });

  const contrasenaHash = await cifrarContrasena(CONTRASENA);

  await ejecutarSinTenant(async () => {
    const Usuario = obtenerModelo('Usuario');
    await Usuario.create({
      tenant: tenant._id,
      nombres: 'Laura',
      apellidos: 'Duena',
      email: 'owner@gimnasio-pagos.co',
      contrasenaHash,
      rol: ROLES.TENANT_OWNER,
      debeCambiarContrasena: false,
    });
    await Usuario.create({
      tenant: tenant._id,
      sede: sedes.norte._id,
      nombres: 'Carlos',
      apellidos: 'Norte',
      email: 'norte@gimnasio-pagos.co',
      contrasenaHash,
      rol: ROLES.SEDE_ADMIN,
      debeCambiarContrasena: false,
    });
  });

  return { tenant, sedes, planMensual, miembros };
}

async function entrarComo(email) {
  const agente = peticion.agent(app);
  await agente
    .post('/api/auth/iniciar-sesion')
    .send({ email, contrasena: CONTRASENA })
    .expect(200);
  return agente;
}

function enDias(dias) {
  return new Date(Date.now() + dias * MILISEGUNDOS_POR_DIA);
}

beforeEach(limpiarColecciones);

describe('POST /api/pagos', () => {
  it('calcula periodoFin = periodoInicio + duracionDias del plan', async () => {
    const { planMensual, miembros } = await montarGimnasio();
    const dueno = await entrarComo('owner@gimnasio-pagos.co');

    const periodoInicio = new Date('2026-07-01T00:00:00.000Z');
    const respuesta = await dueno
      .post('/api/pagos')
      .send({
        miembro: String(miembros.ana._id),
        planMembresia: String(planMensual._id),
        metodoPago: METODOS_PAGO.EFECTIVO,
        periodoInicio: periodoInicio.toISOString(),
      })
      .expect(201);

    const esperado = new Date(periodoInicio.getTime() + 30 * MILISEGUNDOS_POR_DIA);
    expect(new Date(respuesta.body.data.periodoFin).toISOString()).toBe(esperado.toISOString());

    // Sin monto explicito, cobra el precio del plan.
    expect(respuesta.body.data.monto).toBe(60_000);
    // El pago queda en la sede del miembro.
    expect(respuesta.body.data.sede).toBe(String(miembros.ana.sede));
  });

  it('rechaza una transferencia sin referencia; el efectivo no la necesita', async () => {
    const { planMensual, miembros } = await montarGimnasio();
    const dueno = await entrarComo('owner@gimnasio-pagos.co');

    const base = {
      miembro: String(miembros.ana._id),
      planMembresia: String(planMensual._id),
    };

    const invalida = await dueno
      .post('/api/pagos')
      .send({ ...base, metodoPago: METODOS_PAGO.TRANSFERENCIA })
      .expect(400);
    expect(invalida.body.error.detalles).toEqual(
      expect.arrayContaining([expect.objectContaining({ campo: 'referencia' })]),
    );

    await dueno
      .post('/api/pagos')
      .send({ ...base, metodoPago: METODOS_PAGO.TRANSFERENCIA, referencia: 'TRF-001' })
      .expect(201);

    await dueno.post('/api/pagos').send({ ...base, metodoPago: METODOS_PAGO.EFECTIVO }).expect(201);
  });

  it('un sede_admin no puede cobrarle a un miembro de otra sede', async () => {
    const { planMensual, miembros } = await montarGimnasio();
    const norte = await entrarComo('norte@gimnasio-pagos.co');

    await norte
      .post('/api/pagos')
      .send({
        miembro: String(miembros.beto._id), // miembro de la sede sur
        planMembresia: String(planMensual._id),
        metodoPago: METODOS_PAGO.EFECTIVO,
      })
      .expect(404);
  });

  it('rechaza un plan archivado', async () => {
    const { tenant, planMensual, miembros } = await montarGimnasio();
    await ejecutarConTenant(tenant._id, () =>
      obtenerModelo('PlanMembresia').updateOne({ _id: planMensual._id }, { activo: false }),
    );

    const dueno = await entrarComo('owner@gimnasio-pagos.co');
    await dueno
      .post('/api/pagos')
      .send({
        miembro: String(miembros.ana._id),
        planMembresia: String(planMensual._id),
        metodoPago: METODOS_PAGO.EFECTIVO,
      })
      .expect(400);
  });
});

describe('derivarEstado (la regla, en unitario)', () => {
  const ahora = new Date();

  it.each([
    ['sin pagos', null, ESTADOS_VENCIMIENTO.SIN_PAGOS],
    ['vencido ayer', { periodoFin: enDias(-1) }, ESTADOS_VENCIMIENTO.VENCIDO],
    ['vence en 2 dias', { periodoFin: enDias(2) }, ESTADOS_VENCIMIENTO.POR_VENCER],
    ['vence en 30 dias', { periodoFin: enDias(30) }, ESTADOS_VENCIMIENTO.AL_DIA],
  ])('%s -> %s', (_nombre, ultimoPago, esperado) => {
    expect(derivarEstado(ultimoPago, ahora)).toBe(esperado);
  });
});

describe('GET /api/vencimientos', () => {
  async function pagarConVencimiento(tenantId, miembro, plan, diasHastaVencer) {
    const periodoFin = enDias(diasHastaVencer);
    const periodoInicio = new Date(periodoFin.getTime() - plan.duracionDias * MILISEGUNDOS_POR_DIA);
    const registradoPor = await ejecutarSinTenant(() =>
      obtenerModelo('Usuario').findOne({ email: 'owner@gimnasio-pagos.co' }),
    );

    return ejecutarConTenant(tenantId, () =>
      obtenerModelo('Pago').create({
        sede: miembro.sede,
        miembro: miembro._id,
        planMembresia: plan._id,
        monto: plan.precio,
        metodoPago: METODOS_PAGO.EFECTIVO,
        periodoInicio,
        periodoFin,
        registradoPor: registradoPor._id,
      }),
    );
  }

  it('deriva el estado del ULTIMO pago, no de cualquiera', async () => {
    const { tenant, planMensual, miembros } = await montarGimnasio();

    // Ana: un pago viejo ya vencido y una renovacion vigente. Manda la renovacion.
    await pagarConVencimiento(tenant._id, miembros.ana, planMensual, -20);
    await pagarConVencimiento(tenant._id, miembros.ana, planMensual, 10);

    // Beto: solo un pago que vence en 2 dias.
    await pagarConVencimiento(tenant._id, miembros.beto, planMensual, 2);

    const dueno = await entrarComo('owner@gimnasio-pagos.co');
    const respuesta = await dueno.get('/api/vencimientos').expect(200);

    const porDocumento = Object.fromEntries(
      respuesta.body.data.map((fila) => [fila.miembro.documento, fila]),
    );

    expect(porDocumento['111'].estado).toBe(ESTADOS_VENCIMIENTO.AL_DIA);
    expect(porDocumento['222'].estado).toBe(ESTADOS_VENCIMIENTO.POR_VENCER);
  });

  it('un miembro sin pagos aparece como sin_pagos', async () => {
    await montarGimnasio();

    const dueno = await entrarComo('owner@gimnasio-pagos.co');
    const respuesta = await dueno.get('/api/vencimientos').expect(200);

    expect(respuesta.body.data).toHaveLength(2);
    expect(respuesta.body.data.every((fila) => fila.estado === ESTADOS_VENCIMIENTO.SIN_PAGOS)).toBe(
      true,
    );
  });

  it('un sede_admin solo ve los vencimientos de su sede', async () => {
    const { tenant, planMensual, miembros } = await montarGimnasio();
    await pagarConVencimiento(tenant._id, miembros.ana, planMensual, 5);
    await pagarConVencimiento(tenant._id, miembros.beto, planMensual, -5);

    const norte = await entrarComo('norte@gimnasio-pagos.co');
    const respuesta = await norte.get('/api/vencimientos').expect(200);

    expect(respuesta.body.data).toHaveLength(1);
    expect(respuesta.body.data[0].miembro.documento).toBe('111');
  });
});
