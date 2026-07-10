import peticion from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  ESTADOS_TENANT,
  METODOS_PAGO,
  MILISEGUNDOS_POR_DIA,
  ROLES,
} from '../src/config/constantes.js';
import { ejecutarConTenant, ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo } from '../src/modelos/indice.js';
import { crearServidor } from '../src/servidor.js';
import { cifrarContrasena } from '../src/utilidades/contrasena.js';
import { sumarMeses } from '../src/utilidades/fechas.js';
import { limpiarColecciones } from './configuracion.js';

/**
 * GET /api/reportes: ingresos del mes por sede (con su split efectivo vs
 * transferencia) y el conteo de miembros por estado. Lo critico: el aggregate
 * respeta el alcance por sede y el aislamiento por tenant, y los pagos fuera
 * del mes en curso no cuentan.
 */

const CONTRASENA = 'ClaveInicial1';

const app = crearServidor();

async function montarGimnasio(slug = 'gimnasio-reportes') {
  const tenant = await ejecutarSinTenant(async () => {
    const plan = await obtenerModelo('PlanPlataforma').create({
      nombre: `Plan ${Math.random()}`,
      precioMensual: 100_000,
      limites: { maxSedes: 5, maxMiembros: 500, maxUsuarios: 10 },
    });

    return obtenerModelo('Tenant').create({
      nombre: 'Gimnasio',
      nit: '900111',
      slug,
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
  const dominio = `${slug}.co`;

  const usuarios = await ejecutarSinTenant(async () => {
    const Usuario = obtenerModelo('Usuario');
    const dueno = await Usuario.create({
      tenant: tenant._id,
      nombres: 'Laura',
      apellidos: 'Duena',
      email: `owner@${dominio}`,
      contrasenaHash,
      rol: ROLES.TENANT_OWNER,
      debeCambiarContrasena: false,
    });
    const adminNorte = await Usuario.create({
      tenant: tenant._id,
      sede: sedes.norte._id,
      nombres: 'Carlos',
      apellidos: 'Norte',
      email: `norte@${dominio}`,
      contrasenaHash,
      rol: ROLES.SEDE_ADMIN,
      debeCambiarContrasena: false,
    });
    return { dueno, adminNorte };
  });

  return { tenant, sedes, planMensual, miembros, usuarios, dominio };
}

async function registrarPago(tenantId, { miembro, sede, planMembresia, registradoPor, monto, metodoPago, fechaPago }) {
  return ejecutarConTenant(tenantId, () =>
    obtenerModelo('Pago').create({
      sede: sede._id,
      miembro: miembro._id,
      planMembresia: planMembresia._id,
      monto,
      metodoPago,
      fechaPago,
      periodoInicio: fechaPago,
      periodoFin: sumarMeses(fechaPago, planMembresia.duracionMeses),
      registradoPor: registradoPor._id,
    }),
  );
}

async function entrarComo(email) {
  const agente = peticion.agent(app);
  await agente
    .post('/api/auth/iniciar-sesion')
    .send({ email, contrasena: CONTRASENA })
    .expect(200);
  return agente;
}

/**
 * Un dia a mitad del mes N-esimo hacia atras. Se usa el dia 15 y no
 * `setMonth(-1)` porque restar un mes al 31 de julio da el 1 de julio: el dia
 * 15 existe en todos los meses.
 */
function haceMeses(meses) {
  const ahora = new Date();
  return new Date(ahora.getFullYear(), ahora.getMonth() - meses, 15);
}

beforeEach(limpiarColecciones);

describe('GET /api/reportes', () => {
  it('agrupa los ingresos del mes por sede, separando efectivo de transferencia', async () => {
    const { tenant, sedes, planMensual, miembros, usuarios } = await montarGimnasio();

    await registrarPago(tenant._id, {
      miembro: miembros.ana,
      sede: sedes.norte,
      planMembresia: planMensual,
      registradoPor: usuarios.dueno,
      monto: 60_000,
      metodoPago: METODOS_PAGO.EFECTIVO,
      fechaPago: new Date(),
    });
    await registrarPago(tenant._id, {
      miembro: miembros.ana,
      sede: sedes.norte,
      planMembresia: planMensual,
      registradoPor: usuarios.dueno,
      monto: 60_000,
      metodoPago: METODOS_PAGO.TRANSFERENCIA,
      fechaPago: new Date(),
    });
    await registrarPago(tenant._id, {
      miembro: miembros.beto,
      sede: sedes.sur,
      planMembresia: planMensual,
      registradoPor: usuarios.dueno,
      monto: 60_000,
      metodoPago: METODOS_PAGO.EFECTIVO,
      fechaPago: new Date(),
    });

    const dueno = await entrarComo(usuarios.dueno.email);
    const respuesta = await dueno.get('/api/reportes').expect(200);

    expect(respuesta.body.data.totalMes).toBe(180_000);

    const porNombre = Object.fromEntries(
      respuesta.body.data.ingresosPorSede.map((fila) => [fila.sedeNombre, fila]),
    );
    expect(porNombre.Norte).toMatchObject({ efectivo: 60_000, transferencia: 60_000, total: 120_000 });
    expect(porNombre.Sur).toMatchObject({ efectivo: 60_000, transferencia: 0, total: 60_000 });
  });

  it('una sede sin ingresos aparece en cero, no desaparece', async () => {
    const { usuarios } = await montarGimnasio();

    const dueno = await entrarComo(usuarios.dueno.email);
    const respuesta = await dueno.get('/api/reportes').expect(200);

    expect(respuesta.body.data.ingresosPorSede).toHaveLength(2);
    expect(respuesta.body.data.totalMes).toBe(0);
    expect(respuesta.body.data.ingresosPorSede.every((fila) => fila.total === 0)).toBe(true);
  });

  it('un pago del mes pasado no cuenta en el reporte del mes actual', async () => {
    const { tenant, sedes, planMensual, miembros, usuarios } = await montarGimnasio();

    await registrarPago(tenant._id, {
      miembro: miembros.ana,
      sede: sedes.norte,
      planMembresia: planMensual,
      registradoPor: usuarios.dueno,
      monto: 60_000,
      metodoPago: METODOS_PAGO.EFECTIVO,
      fechaPago: haceMeses(2),
    });

    const dueno = await entrarComo(usuarios.dueno.email);
    const respuesta = await dueno.get('/api/reportes').expect(200);

    expect(respuesta.body.data.totalMes).toBe(0);
  });

  it('compara contra el mes anterior y calcula la variacion', async () => {
    const { tenant, sedes, planMensual, miembros, usuarios } = await montarGimnasio();

    // Mes anterior: 100.000. Mes actual: 150.000 -> +50%.
    await registrarPago(tenant._id, {
      miembro: miembros.ana,
      sede: sedes.norte,
      planMembresia: planMensual,
      registradoPor: usuarios.dueno,
      monto: 100_000,
      metodoPago: METODOS_PAGO.EFECTIVO,
      fechaPago: haceMeses(1),
    });
    await registrarPago(tenant._id, {
      miembro: miembros.ana,
      sede: sedes.norte,
      planMembresia: planMensual,
      registradoPor: usuarios.dueno,
      monto: 150_000,
      metodoPago: METODOS_PAGO.EFECTIVO,
      fechaPago: new Date(),
    });

    const dueno = await entrarComo(usuarios.dueno.email);
    const respuesta = await dueno.get('/api/reportes').expect(200);

    expect(respuesta.body.data.totalMes).toBe(150_000);
    expect(respuesta.body.data.totalMesAnterior).toBe(100_000);
    expect(respuesta.body.data.variacion).toBeCloseTo(0.5);
  });

  it('sin ingresos el mes pasado la variacion es null, no un 100% inventado', async () => {
    const { tenant, sedes, planMensual, miembros, usuarios } = await montarGimnasio();

    await registrarPago(tenant._id, {
      miembro: miembros.ana,
      sede: sedes.norte,
      planMembresia: planMensual,
      registradoPor: usuarios.dueno,
      monto: 60_000,
      metodoPago: METODOS_PAGO.EFECTIVO,
      fechaPago: new Date(),
    });

    const dueno = await entrarComo(usuarios.dueno.email);
    const respuesta = await dueno.get('/api/reportes').expect(200);

    expect(respuesta.body.data.totalMesAnterior).toBe(0);
    expect(respuesta.body.data.variacion).toBeNull();
  });

  it('un pago de hace dos meses no cuenta como "mes anterior"', async () => {
    const { tenant, sedes, planMensual, miembros, usuarios } = await montarGimnasio();

    await registrarPago(tenant._id, {
      miembro: miembros.ana,
      sede: sedes.norte,
      planMembresia: planMensual,
      registradoPor: usuarios.dueno,
      monto: 90_000,
      metodoPago: METODOS_PAGO.EFECTIVO,
      fechaPago: haceMeses(2),
    });

    const dueno = await entrarComo(usuarios.dueno.email);
    const respuesta = await dueno.get('/api/reportes').expect(200);

    expect(respuesta.body.data.totalMesAnterior).toBe(0);
  });

  it('un sede_admin solo ve los ingresos y miembros de su sede', async () => {
    const { tenant, sedes, planMensual, miembros, usuarios } = await montarGimnasio();

    await registrarPago(tenant._id, {
      miembro: miembros.ana,
      sede: sedes.norte,
      planMembresia: planMensual,
      registradoPor: usuarios.dueno,
      monto: 60_000,
      metodoPago: METODOS_PAGO.EFECTIVO,
      fechaPago: new Date(),
    });
    await registrarPago(tenant._id, {
      miembro: miembros.beto,
      sede: sedes.sur,
      planMembresia: planMensual,
      registradoPor: usuarios.dueno,
      monto: 60_000,
      metodoPago: METODOS_PAGO.TRANSFERENCIA,
      fechaPago: new Date(),
    });

    const norte = await entrarComo(usuarios.adminNorte.email);
    const respuesta = await norte.get('/api/reportes').expect(200);

    expect(respuesta.body.data.ingresosPorSede).toHaveLength(1);
    expect(respuesta.body.data.ingresosPorSede[0].sedeNombre).toBe('Norte');
    expect(respuesta.body.data.totalMes).toBe(60_000);
    expect(respuesta.body.data.miembros.total).toBe(1);
  });

  it('el conteo de miembros coincide con /api/vencimientos (misma consulta)', async () => {
    const { tenant, sedes, planMensual, miembros, usuarios } = await montarGimnasio();

    await registrarPago(tenant._id, {
      miembro: miembros.ana,
      sede: sedes.norte,
      planMembresia: planMensual,
      registradoPor: usuarios.dueno,
      monto: 60_000,
      metodoPago: METODOS_PAGO.EFECTIVO,
      fechaPago: new Date(),
    });

    const dueno = await entrarComo(usuarios.dueno.email);
    const [reporte, vencimientos] = await Promise.all([
      dueno.get('/api/reportes').expect(200),
      dueno.get('/api/vencimientos').expect(200),
    ]);

    expect(reporte.body.data.miembros.total).toBe(vencimientos.body.data.length);
    const alDiaEnVencimientos = vencimientos.body.data.filter((fila) => fila.estado === 'al_dia').length;
    expect(reporte.body.data.miembros.al_dia).toBe(alDiaEnVencimientos);
  });

  it('dos gimnasios no se mezclan en el reporte (aislamiento por tenant)', async () => {
    const a = await montarGimnasio('gimnasio-reportes-a');
    const b = await montarGimnasio('gimnasio-reportes-b');

    await registrarPago(a.tenant._id, {
      miembro: a.miembros.ana,
      sede: a.sedes.norte,
      planMembresia: a.planMensual,
      registradoPor: a.usuarios.dueno,
      monto: 60_000,
      metodoPago: METODOS_PAGO.EFECTIVO,
      fechaPago: new Date(),
    });
    await registrarPago(b.tenant._id, {
      miembro: b.miembros.ana,
      sede: b.sedes.norte,
      planMembresia: b.planMensual,
      registradoPor: b.usuarios.dueno,
      monto: 999_000,
      metodoPago: METODOS_PAGO.EFECTIVO,
      fechaPago: new Date(),
    });

    const duenoA = await entrarComo(a.usuarios.dueno.email);
    const respuesta = await duenoA.get('/api/reportes').expect(200);

    expect(respuesta.body.data.totalMes).toBe(60_000);
  });
});
