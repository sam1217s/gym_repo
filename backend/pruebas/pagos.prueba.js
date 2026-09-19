import peticion from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import {
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
import { sumarMeses } from '../src/utilidades/fechas.js';
import { limpiarColecciones } from './configuracion.js';

/**
 * Pagos y vencimientos: `periodoFin = periodoInicio + plan.duracionMeses` (meses
 * de CALENDARIO, no bloques de 30 dias), la referencia obligatoria en
 * transferencias, y el estado del miembro derivado de su ULTIMO pago.
 */

const CONTRASENA = 'ClaveInicial1';

const app = crearServidor();

async function montarGimnasio() {
  const tenant = await ejecutarSinTenant(async () => {

    return obtenerModelo('Tenant').create({
      nombre: 'Gimnasio',
      nit: '900111',
      slug: 'gimnasio-pagos',
    });
  });

  const { sedes, planMensual, miembros } = await ejecutarConTenant(tenant._id, async () => {
    const Sede = obtenerModelo('Sede');
    const norte = await Sede.create({ nombre: 'Norte', direccion: 'Calle 100' });
    const sur = await Sede.create({ nombre: 'Sur', direccion: 'Carrera 30' });

    const planMensual = await obtenerModelo('PlanMembresia').create({
      sede: norte._id,
      nombre: 'Mensual',
      precio: 60_000,
      duracionMeses: 1,
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
    .send({ identificador: email, contrasena: CONTRASENA })
    .expect(200);
  return agente;
}

function enDias(dias) {
  return new Date(Date.now() + dias * MILISEGUNDOS_POR_DIA);
}

beforeEach(limpiarColecciones);

describe('POST /api/pagos', () => {
  async function registrarPagoDesde(dueno, planMensual, miembro, periodoInicio) {
    return dueno
      .post('/api/pagos')
      .send({
        miembro: String(miembro._id),
        planMembresia: String(planMensual._id),
        metodoPago: METODOS_PAGO.EFECTIVO,
        periodoInicio,
      })
      .expect(201);
  }

  it('calcula periodoFin = periodoInicio + duracionMeses del plan', async () => {
    const { planMensual, miembros } = await montarGimnasio();
    const dueno = await entrarComo('owner@gimnasio-pagos.co');

    const respuesta = await registrarPagoDesde(dueno, planMensual, miembros.ana, '2026-07-09');

    // Un mes de calendario: del 9 de julio al 9 de agosto.
    expect(new Date(respuesta.body.data.periodoFin).getMonth()).toBe(7);
    expect(new Date(respuesta.body.data.periodoFin).getDate()).toBe(9);

    // Sin monto explicito, cobra el precio del plan.
    expect(respuesta.body.data.monto).toBe(60_000);
    // El pago queda en la sede del miembro.
    expect(respuesta.body.data.sede).toBe(String(miembros.ana.sede));
  });

  it('un plan medido en DIAS (pase de dia) vence al dia siguiente', async () => {
    const { tenant, sedes, miembros } = await montarGimnasio();
    const dueno = await entrarComo('owner@gimnasio-pagos.co');

    const pase = await ejecutarConTenant(tenant._id, () =>
      obtenerModelo('PlanMembresia').create({
        sede: sedes.norte._id, // el plan es de la sede de Ana
        nombre: 'Pase de dia',
        precio: 8_000,
        duracionDias: 1,
      }),
    );

    const respuesta = await dueno
      .post('/api/pagos')
      .send({
        miembro: String(miembros.ana._id),
        planMembresia: String(pase._id),
        metodoPago: METODOS_PAGO.EFECTIVO,
        periodoInicio: '2026-07-09',
      })
      .expect(201);

    const fin = new Date(respuesta.body.data.periodoFin);
    expect(fin.getMonth()).toBe(6); // julio
    expect(fin.getDate()).toBe(10); // 9 + 1 dia
  });

  it('un sede_admin solo ve los planes de SU sede', async () => {
    const { tenant, sedes } = await montarGimnasio();

    // La sede sur tiene su propio plan, con el mismo nombre y otro precio.
    await ejecutarConTenant(tenant._id, () =>
      obtenerModelo('PlanMembresia').create({
        sede: sedes.sur._id,
        nombre: 'Mensual',
        precio: 45_000,
        duracionMeses: 1,
      }),
    );

    const dueno = await entrarComo('owner@gimnasio-pagos.co');
    const todos = await dueno.get('/api/planes-membresia').expect(200);
    expect(todos.body.data).toHaveLength(2); // el dueno ve los de ambas sedes

    const recepcion = await entrarComo('norte@gimnasio-pagos.co');
    const suyos = await recepcion.get('/api/planes-membresia').expect(200);
    expect(suyos.body.data).toHaveLength(1);
    expect(suyos.body.data[0].precio).toBe(60_000); // el de la norte
  });

  it('no se puede cobrar con un plan de OTRA sede', async () => {
    const { planMensual, miembros } = await montarGimnasio();
    const dueno = await entrarComo('owner@gimnasio-pagos.co');

    // El plan Mensual es de la sede norte; Beto es de la sur. El dueno ve ambas
    // sedes, pero aun asi no puede cruzar el plan.
    const respuesta = await dueno
      .post('/api/pagos')
      .send({
        miembro: String(miembros.beto._id),
        planMembresia: String(planMensual._id),
        metodoPago: METODOS_PAGO.EFECTIVO,
      })
      .expect(400);

    expect(respuesta.body.error.mensaje).toMatch(/otra sede/i);
  });

  it('un plan no puede tener meses y dias a la vez', async () => {
    const { tenant, sedes } = await montarGimnasio();
    await expect(
      ejecutarConTenant(tenant._id, () =>
        obtenerModelo('PlanMembresia').create({
          sede: sedes.norte._id,
          nombre: 'Raro',
          precio: 1000,
          duracionMeses: 1,
          duracionDias: 7,
        }),
      ),
    ).rejects.toThrow(/exactamente una/i);
  });

  /**
   * Un mes NO son 30 dias. Quien paga el 31 de enero vence el 28 de febrero;
   * sumando 30 dias caeria el 2 de marzo y cobraria dias que nadie compro.
   */
  it('una mensualidad del 31 de enero vence el 28 de febrero, no 30 dias despues', async () => {
    const { planMensual, miembros } = await montarGimnasio();
    const dueno = await entrarComo('owner@gimnasio-pagos.co');

    const respuesta = await registrarPagoDesde(dueno, planMensual, miembros.ana, '2026-01-31');
    const periodoFin = new Date(respuesta.body.data.periodoFin);

    expect(periodoFin.getMonth()).toBe(1); // febrero
    expect(periodoFin.getDate()).toBe(28); // 2026 no es bisiesto
  });

  /**
   * `"2026-07-09"` es un dia, no un instante. Con `z.coerce.date()` seria
   * medianoche UTC —el 8 de julio en Bogota— y el periodo terminaria un dia
   * antes de lo que dice el formulario.
   */
  it('trata la fecha del formulario como dia civil, no como medianoche UTC', async () => {
    const { planMensual, miembros } = await montarGimnasio();
    const dueno = await entrarComo('owner@gimnasio-pagos.co');

    const respuesta = await registrarPagoDesde(dueno, planMensual, miembros.ana, '2026-07-09');
    const periodoInicio = new Date(respuesta.body.data.periodoInicio);

    expect(periodoInicio.getDate()).toBe(9);
    expect(periodoInicio.getMonth()).toBe(6);
  });

  it('en año bisiesto, el 31 de enero vence el 29 de febrero', async () => {
    const { planMensual, miembros } = await montarGimnasio();
    const dueno = await entrarComo('owner@gimnasio-pagos.co');

    const respuesta = await registrarPagoDesde(dueno, planMensual, miembros.ana, '2028-01-31');
    const periodoFin = new Date(respuesta.body.data.periodoFin);

    expect(periodoFin.getMonth()).toBe(1);
    expect(periodoFin.getDate()).toBe(29);
  });

  it('la referencia es opcional: una transferencia sin referencia se acepta', async () => {
    const { planMensual, miembros } = await montarGimnasio();
    const dueno = await entrarComo('owner@gimnasio-pagos.co');

    const base = {
      miembro: String(miembros.ana._id),
      planMembresia: String(planMensual._id),
    };

    // Sin referencia (cobro presencial / aprobacion desde la bandeja): se acepta.
    await dueno
      .post('/api/pagos')
      .send({ ...base, metodoPago: METODOS_PAGO.TRANSFERENCIA })
      .expect(201);

    // Con referencia: se guarda igual.
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

describe('PATCH /api/pagos/:id (corregir un pago)', () => {
  async function registrarPago(dueno, plan, miembro, periodoInicio) {
    const respuesta = await dueno
      .post('/api/pagos')
      .send({
        miembro: String(miembro._id),
        planMembresia: String(plan._id),
        metodoPago: METODOS_PAGO.EFECTIVO,
        periodoInicio,
      })
      .expect(201);
    return respuesta.body.data;
  }

  it('el dueño corrige el inicio y el vencimiento se RECALCULA', async () => {
    const { planMensual, miembros } = await montarGimnasio();
    const dueno = await entrarComo('owner@gimnasio-pagos.co');

    // Se tecleo mal: julio en vez de agosto.
    const pago = await registrarPago(dueno, planMensual, miembros.ana, '2026-07-01');

    const corregido = await dueno
      .patch(`/api/pagos/${pago._id}`)
      .send({ periodoInicio: '2026-08-01' })
      .expect(200);

    const inicio = new Date(corregido.body.data.periodoInicio);
    const fin = new Date(corregido.body.data.periodoFin);
    expect(inicio.getMonth()).toBe(7); // agosto
    expect(inicio.getDate()).toBe(1);
    // Un mes despues: 1 de septiembre. El fin NO se quedo en el viejo.
    expect(fin.getMonth()).toBe(8); // septiembre
    expect(fin.getDate()).toBe(1);
  });

  it('corregir el periodo reinicia las marcas de aviso ya enviadas', async () => {
    const { tenant, planMensual, miembros } = await montarGimnasio();
    const dueno = await entrarComo('owner@gimnasio-pagos.co');
    const pago = await registrarPago(dueno, planMensual, miembros.ana, '2026-07-01');

    await ejecutarConTenant(tenant._id, () =>
      obtenerModelo('Pago').updateOne(
        { _id: pago._id },
        { avisadoPorVencer: true, avisadoVencido: true },
      ),
    );

    await dueno.patch(`/api/pagos/${pago._id}`).send({ periodoInicio: '2026-08-01' }).expect(200);

    const enBase = await ejecutarConTenant(tenant._id, () =>
      obtenerModelo('Pago').findById(pago._id),
    );
    expect(enBase.avisadoPorVencer).toBe(false);
    expect(enBase.avisadoVencido).toBe(false);
  });

  it('cambiar solo el monto NO toca el periodo ni sus avisos', async () => {
    const { tenant, planMensual, miembros } = await montarGimnasio();
    const dueno = await entrarComo('owner@gimnasio-pagos.co');
    const pago = await registrarPago(dueno, planMensual, miembros.ana, '2026-07-01');

    await ejecutarConTenant(tenant._id, () =>
      obtenerModelo('Pago').updateOne({ _id: pago._id }, { avisadoPorVencer: true }),
    );

    const corregido = await dueno
      .patch(`/api/pagos/${pago._id}`)
      .send({ monto: 50_000 })
      .expect(200);

    expect(corregido.body.data.monto).toBe(50_000);
    expect(new Date(corregido.body.data.periodoFin).getDate()).toBe(1); // sin cambios
    const enBase = await ejecutarConTenant(tenant._id, () =>
      obtenerModelo('Pago').findById(pago._id),
    );
    expect(enBase.avisadoPorVencer).toBe(true); // no se reinicio
  });

  it('un sede_admin NO puede corregir un pago (es cosa del dueño)', async () => {
    const { planMensual, miembros } = await montarGimnasio();
    const dueno = await entrarComo('owner@gimnasio-pagos.co');
    const pago = await registrarPago(dueno, planMensual, miembros.ana, '2026-07-01');

    const norte = await entrarComo('norte@gimnasio-pagos.co');
    await norte
      .patch(`/api/pagos/${pago._id}`)
      .send({ periodoInicio: '2026-08-01' })
      .expect(403);
  });

  it('no deja mover el pago a un plan de OTRA sede', async () => {
    const { tenant, sedes, planMensual, miembros } = await montarGimnasio();
    const dueno = await entrarComo('owner@gimnasio-pagos.co');
    const pago = await registrarPago(dueno, planMensual, miembros.ana, '2026-07-01');

    // Un plan de la sede sur; el pago es de la norte (la sede de Ana).
    const planSur = await ejecutarConTenant(tenant._id, () =>
      obtenerModelo('PlanMembresia').create({
        sede: sedes.sur._id,
        nombre: 'Mensual',
        precio: 45_000,
        duracionMeses: 1,
      }),
    );

    const respuesta = await dueno
      .patch(`/api/pagos/${pago._id}`)
      .send({ planMembresia: String(planSur._id) })
      .expect(400);
    expect(respuesta.body.error.mensaje).toMatch(/otra sede/i);
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
    const periodoInicio = sumarMeses(periodoFin, -plan.duracionMeses);
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
