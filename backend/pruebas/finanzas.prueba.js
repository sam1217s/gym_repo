import peticion from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { CATEGORIAS_GASTO, ROLES } from '../src/config/constantes.js';
import { ejecutarConTenant, ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo } from '../src/modelos/indice.js';
import { crearServidor } from '../src/servidor.js';
import { cifrarContrasena } from '../src/utilidades/contrasena.js';
import { limpiarColecciones } from './configuracion.js';

/**
 * Finanzas: gastos por sede + gastos generales del gimnasio, y deudas con saldo.
 * Lo critico: cada sede solo ve lo suyo, los gastos generales son del dueño, y
 * el saldo de una deuda se DERIVA de sus abonos (no se guarda).
 */

const CONTRASENA = 'ClaveInicial1';
const app = crearServidor();

async function montarGimnasio() {
  const tenant = await ejecutarSinTenant(async () => {
    return obtenerModelo('Tenant').create({
      nombre: 'GymFin',
      nit: '900666',
      slug: 'gymfin',
    });
  });

  const sedes = await ejecutarConTenant(tenant._id, async () => {
    const Sede = obtenerModelo('Sede');
    const norte = await Sede.create({ nombre: 'Norte', direccion: 'Calle 100' });
    const sur = await Sede.create({ nombre: 'Sur', direccion: 'Carrera 30' });
    return { norte, sur };
  });

  const hash = await cifrarContrasena(CONTRASENA);
  await ejecutarSinTenant(async () => {
    const Usuario = obtenerModelo('Usuario');
    await Usuario.create({
      tenant: tenant._id, nombres: 'Laura', apellidos: 'Duena',
      email: 'owner@gymfin.co', contrasenaHash: hash, rol: ROLES.TENANT_OWNER, debeCambiarContrasena: false,
    });
    await Usuario.create({
      tenant: tenant._id, sede: sedes.norte._id, nombres: 'Carlos', apellidos: 'Norte',
      email: 'norte@gymfin.co', contrasenaHash: hash, rol: ROLES.SEDE_ADMIN, debeCambiarContrasena: false,
    });
  });

  return { tenant, sedes };
}

async function entrarComo(email) {
  const agente = peticion.agent(app);
  await agente.post('/api/auth/iniciar-sesion').send({ identificador: email, contrasena: CONTRASENA }).expect(200);
  return agente;
}

beforeEach(limpiarColecciones);

describe('Finanzas: gastos por sede y generales', () => {
  it('el resumen separa lo de cada sede de lo general y suma el consolidado', async () => {
    const { sedes } = await montarGimnasio();
    const dueno = await entrarComo('owner@gymfin.co');

    await dueno.post('/api/gastos').send({
      categoria: CATEGORIAS_GASTO.ARRIENDO, concepto: 'Arriendo Norte', monto: 1_500_000, sede: String(sedes.norte._id),
    }).expect(201);
    await dueno.post('/api/gastos').send({
      categoria: CATEGORIAS_GASTO.SERVICIOS, concepto: 'Luz Norte', monto: 300_000, sede: String(sedes.norte._id),
    }).expect(201);
    await dueno.post('/api/gastos').send({
      categoria: CATEGORIAS_GASTO.EMPLEADOS, concepto: 'Nomina Sur', monto: 2_000_000, sede: String(sedes.sur._id),
    }).expect(201);
    // Sin sede = gasto del gimnasio entero (obligacion del dueño).
    await dueno.post('/api/gastos').send({
      categoria: CATEGORIAS_GASTO.OTROS, concepto: 'Contador', monto: 500_000,
    }).expect(201);

    const respuesta = await dueno.get('/api/gastos/resumen').expect(200);
    const { porSede, general, total } = respuesta.body.data;

    const norte = porSede.find((s) => s.sedeNombre === 'Norte');
    expect(norte.total).toBe(1_800_000);
    expect(norte.porCategoria.arriendo).toBe(1_500_000);
    expect(norte.porCategoria.servicios).toBe(300_000);

    expect(porSede.find((s) => s.sedeNombre === 'Sur').total).toBe(2_000_000);
    expect(general.total).toBe(500_000);
    expect(total).toBe(4_300_000); // 1.8M + 2M + 0.5M
  });

  it('un sede_admin solo ve los gastos de SU sede, y nunca los generales', async () => {
    const { sedes } = await montarGimnasio();
    const dueno = await entrarComo('owner@gymfin.co');
    await dueno.post('/api/gastos').send({
      categoria: CATEGORIAS_GASTO.ARRIENDO, concepto: 'Arriendo Norte', monto: 100, sede: String(sedes.norte._id),
    }).expect(201);
    await dueno.post('/api/gastos').send({
      categoria: CATEGORIAS_GASTO.ARRIENDO, concepto: 'Arriendo Sur', monto: 200, sede: String(sedes.sur._id),
    }).expect(201);
    await dueno.post('/api/gastos').send({
      categoria: CATEGORIAS_GASTO.OTROS, concepto: 'Credito del dueño', monto: 900,
    }).expect(201);

    const recepcion = await entrarComo('norte@gymfin.co');
    const respuesta = await recepcion.get('/api/gastos').expect(200);

    expect(respuesta.body.data).toHaveLength(1);
    expect(respuesta.body.data[0].concepto).toBe('Arriendo Norte');
  });

  it('un sede_admin registra siempre en SU sede, aunque mande otra o ninguna', async () => {
    const { sedes } = await montarGimnasio();
    const recepcion = await entrarComo('norte@gymfin.co');

    // Intenta un gasto general (sin sede): se le fuerza la suya.
    const general = await recepcion.post('/api/gastos').send({
      categoria: CATEGORIAS_GASTO.SERVICIOS, concepto: 'Agua', monto: 50,
    }).expect(201);
    expect(general.body.data.sede).toBe(String(sedes.norte._id));

    // Intenta imputarlo a la otra sede: tambien se le fuerza la suya.
    const ajena = await recepcion.post('/api/gastos').send({
      categoria: CATEGORIAS_GASTO.SERVICIOS, concepto: 'Internet', monto: 60, sede: String(sedes.sur._id),
    }).expect(201);
    expect(ajena.body.data.sede).toBe(String(sedes.norte._id));
  });
});

describe('Finanzas: deudas con saldo', () => {
  it('el saldo se deriva de los abonos y el abono queda como gasto del mes', async () => {
    await montarGimnasio();
    const dueno = await entrarComo('owner@gymfin.co');

    const creada = await dueno.post('/api/deudas').send({
      descripcion: 'Credito banco', acreedor: 'Bancolombia', montoTotal: 20_000_000,
    }).expect(201);
    expect(creada.body.data).toMatchObject({ pagado: 0, saldo: 20_000_000, saldada: false });

    const abonada = await dueno
      .post(`/api/deudas/${creada.body.data._id}/abonos`)
      .send({ monto: 4_800_000 })
      .expect(201);
    expect(abonada.body.data).toMatchObject({ pagado: 4_800_000, saldo: 15_200_000, saldada: false });

    // El abono cuenta como egreso: aparece en el resumen bajo la categoria deuda.
    const resumen = await dueno.get('/api/gastos/resumen').expect(200);
    expect(resumen.body.data.general.porCategoria.deuda).toBe(4_800_000);
    expect(resumen.body.data.total).toBe(4_800_000);
  });

  it('no deja abonar mas que el saldo pendiente', async () => {
    await montarGimnasio();
    const dueno = await entrarComo('owner@gymfin.co');
    const creada = await dueno
      .post('/api/deudas')
      .send({ descripcion: 'Prestamo maquinas', montoTotal: 1_000_000 })
      .expect(201);

    const respuesta = await dueno
      .post(`/api/deudas/${creada.body.data._id}/abonos`)
      .send({ monto: 1_500_000 })
      .expect(400);

    expect(respuesta.body.error.mensaje).toMatch(/supera el saldo/i);
  });

  it('al saldarla queda en cero y no admite mas abonos', async () => {
    await montarGimnasio();
    const dueno = await entrarComo('owner@gymfin.co');
    const creada = await dueno
      .post('/api/deudas')
      .send({ descripcion: 'Cuenta proveedor', montoTotal: 500_000 })
      .expect(201);

    const saldada = await dueno
      .post(`/api/deudas/${creada.body.data._id}/abonos`)
      .send({ monto: 500_000 })
      .expect(201);
    expect(saldada.body.data).toMatchObject({ saldo: 0, saldada: true });

    await dueno
      .post(`/api/deudas/${creada.body.data._id}/abonos`)
      .send({ monto: 1 })
      .expect(400);
  });

  it('las deudas son solo del dueño: un sede_admin recibe 403', async () => {
    await montarGimnasio();
    const recepcion = await entrarComo('norte@gymfin.co');
    await recepcion.get('/api/deudas').expect(403);
  });
});
