import peticion from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { ESTADOS_TENANT, ROLES } from '../src/config/constantes.js';
import { ejecutarConTenant, ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo } from '../src/modelos/indice.js';
import { crearServidor } from '../src/servidor.js';
import { cifrarContrasena } from '../src/utilidades/contrasena.js';
import { limpiarColecciones } from './configuracion.js';

/**
 * Inventario por sede. Lo critico: un sede_admin solo ve y toca el inventario
 * de SU sede, y las existencias nunca bajan de 0.
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
      nombre: 'GymInv',
      nit: '900111',
      slug: 'gyminv',
      estado: ESTADOS_TENANT.ACTIVO,
      planPlataforma: plan._id,
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
      email: 'owner@gyminv.co', contrasenaHash: hash, rol: ROLES.TENANT_OWNER, debeCambiarContrasena: false,
    });
    await Usuario.create({
      tenant: tenant._id, sede: sedes.norte._id, nombres: 'Carlos', apellidos: 'Norte',
      email: 'norte@gyminv.co', contrasenaHash: hash, rol: ROLES.SEDE_ADMIN, debeCambiarContrasena: false,
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

describe('Inventario por sede', () => {
  it('el dueno crea un producto con existencias y precio', async () => {
    const { sedes } = await montarGimnasio();
    const dueno = await entrarComo('owner@gyminv.co');

    const respuesta = await dueno
      .post('/api/inventario')
      .send({ nombre: 'Proteina', sede: String(sedes.norte._id), cantidad: 10, precio: 90_000 })
      .expect(201);

    expect(respuesta.body.data).toMatchObject({ nombre: 'Proteina', cantidad: 10, precio: 90_000 });
    expect(respuesta.body.data.sede).toBe(String(sedes.norte._id));
  });

  it('rechaza un producto sin precio', async () => {
    const { sedes } = await montarGimnasio();
    const dueno = await entrarComo('owner@gyminv.co');

    await dueno
      .post('/api/inventario')
      .send({ nombre: 'Sin precio', sede: String(sedes.norte._id), cantidad: 5 })
      .expect(400);
  });

  it('un sede_admin solo ve el inventario de SU sede', async () => {
    const { sedes } = await montarGimnasio();
    const dueno = await entrarComo('owner@gyminv.co');
    await dueno.post('/api/inventario').send({ nombre: 'Norte-item', sede: String(sedes.norte._id), precio: 1_000 }).expect(201);
    await dueno.post('/api/inventario').send({ nombre: 'Sur-item', sede: String(sedes.sur._id), precio: 1_000 }).expect(201);

    const recepcion = await entrarComo('norte@gyminv.co');
    const respuesta = await recepcion.get('/api/inventario').expect(200);

    expect(respuesta.body.data).toHaveLength(1);
    expect(respuesta.body.data[0].nombre).toBe('Norte-item');
  });

  it('un sede_admin crea siempre en SU sede, aunque mande otra', async () => {
    const { sedes } = await montarGimnasio();
    const recepcion = await entrarComo('norte@gyminv.co');

    const respuesta = await recepcion
      .post('/api/inventario')
      .send({ nombre: 'Toalla', sede: String(sedes.sur._id), precio: 1_000 }) // intenta la sur
      .expect(201);

    expect(respuesta.body.data.sede).toBe(String(sedes.norte._id)); // se fuerza la norte
  });

  it('ajusta las existencias: suma y resta', async () => {
    const { sedes } = await montarGimnasio();
    const dueno = await entrarComo('owner@gyminv.co');
    const creado = await dueno
      .post('/api/inventario')
      .send({ nombre: 'Agua', sede: String(sedes.norte._id), cantidad: 5, precio: 3_000 })
      .expect(201);
    const id = creado.body.data._id;

    const sumado = await dueno.patch(`/api/inventario/${id}/ajuste`).send({ delta: 3 }).expect(200);
    expect(sumado.body.data.cantidad).toBe(8);

    const restado = await dueno.patch(`/api/inventario/${id}/ajuste`).send({ delta: -2 }).expect(200);
    expect(restado.body.data.cantidad).toBe(6);
  });

  it('no deja sacar mas existencias de las que hay', async () => {
    const { sedes } = await montarGimnasio();
    const dueno = await entrarComo('owner@gyminv.co');
    const creado = await dueno
      .post('/api/inventario')
      .send({ nombre: 'Barra', sede: String(sedes.norte._id), cantidad: 2, precio: 1_000 })
      .expect(201);

    const respuesta = await dueno.patch(`/api/inventario/${creado.body.data._id}/ajuste`).send({ delta: -5 }).expect(400);
    expect(respuesta.body.error.mensaje).toMatch(/existencias suficientes/i);
  });

  it('un sede_admin no puede ajustar un producto de otra sede (404)', async () => {
    const { sedes } = await montarGimnasio();
    const dueno = await entrarComo('owner@gyminv.co');
    const sur = await dueno
      .post('/api/inventario')
      .send({ nombre: 'Item-sur', sede: String(sedes.sur._id), cantidad: 1, precio: 1_000 })
      .expect(201);

    const recepcion = await entrarComo('norte@gyminv.co');
    await recepcion.patch(`/api/inventario/${sur.body.data._id}/ajuste`).send({ delta: 1 }).expect(404);
  });
});
