import peticion from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { ESTADOS_MAQUINA, ESTADOS_TENANT, ROLES } from '../src/config/constantes.js';
import { ejecutarConTenant, ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo } from '../src/modelos/indice.js';
import { crearServidor } from '../src/servidor.js';
import { cifrarContrasena } from '../src/utilidades/contrasena.js';
import { limpiarColecciones } from './configuracion.js';

/**
 * Maquinas e implementos por sede, con estado de mantenimiento. Lo critico: un
 * sede_admin solo ve y toca las maquinas de SU sede, y el estado se puede pasar
 * a mantenimiento/danada para que el dueño lo sepa.
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
      nombre: 'GymMaq',
      nit: '900222',
      slug: 'gymmaq',
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
      email: 'owner@gymmaq.co', contrasenaHash: hash, rol: ROLES.TENANT_OWNER, debeCambiarContrasena: false,
    });
    await Usuario.create({
      tenant: tenant._id, sede: sedes.norte._id, nombres: 'Carlos', apellidos: 'Norte',
      email: 'norte@gymmaq.co', contrasenaHash: hash, rol: ROLES.SEDE_ADMIN, debeCambiarContrasena: false,
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

describe('Maquinas por sede', () => {
  it('el dueno registra una maquina y arranca operativa', async () => {
    const { sedes } = await montarGimnasio();
    const dueno = await entrarComo('owner@gymmaq.co');

    const respuesta = await dueno
      .post('/api/maquinas')
      .send({ nombre: 'Caminadora 1', sede: String(sedes.norte._id) })
      .expect(201);

    expect(respuesta.body.data).toMatchObject({ nombre: 'Caminadora 1', estado: ESTADOS_MAQUINA.OPERATIVA });
    expect(respuesta.body.data.sede).toBe(String(sedes.norte._id));
  });

  it('marca una maquina como danada con una nota', async () => {
    const { sedes } = await montarGimnasio();
    const dueno = await entrarComo('owner@gymmaq.co');
    const creada = await dueno
      .post('/api/maquinas')
      .send({ nombre: 'Polea', sede: String(sedes.norte._id) })
      .expect(201);

    const actualizada = await dueno
      .patch(`/api/maquinas/${creada.body.data._id}`)
      .send({ estado: ESTADOS_MAQUINA.DANADA, nota: 'Cable roto' })
      .expect(200);

    expect(actualizada.body.data).toMatchObject({ estado: ESTADOS_MAQUINA.DANADA, nota: 'Cable roto' });
  });

  it('rechaza un estado invalido', async () => {
    const { sedes } = await montarGimnasio();
    const dueno = await entrarComo('owner@gymmaq.co');

    await dueno
      .post('/api/maquinas')
      .send({ nombre: 'Banca', sede: String(sedes.norte._id), estado: 'rota_total' })
      .expect(400);
  });

  it('un sede_admin solo ve las maquinas de SU sede', async () => {
    const { sedes } = await montarGimnasio();
    const dueno = await entrarComo('owner@gymmaq.co');
    await dueno.post('/api/maquinas').send({ nombre: 'Norte-maq', sede: String(sedes.norte._id) }).expect(201);
    await dueno.post('/api/maquinas').send({ nombre: 'Sur-maq', sede: String(sedes.sur._id) }).expect(201);

    const recepcion = await entrarComo('norte@gymmaq.co');
    const respuesta = await recepcion.get('/api/maquinas').expect(200);

    expect(respuesta.body.data).toHaveLength(1);
    expect(respuesta.body.data[0].nombre).toBe('Norte-maq');
  });

  it('filtra por estado (solo las que requieren atencion)', async () => {
    const { sedes } = await montarGimnasio();
    const dueno = await entrarComo('owner@gymmaq.co');
    await dueno.post('/api/maquinas').send({ nombre: 'Op', sede: String(sedes.norte._id) }).expect(201);
    await dueno
      .post('/api/maquinas')
      .send({ nombre: 'Rota', sede: String(sedes.norte._id), estado: ESTADOS_MAQUINA.DANADA })
      .expect(201);

    const respuesta = await dueno.get('/api/maquinas').query({ estado: ESTADOS_MAQUINA.DANADA }).expect(200);
    expect(respuesta.body.data).toHaveLength(1);
    expect(respuesta.body.data[0].nombre).toBe('Rota');
  });

  it('un sede_admin no puede tocar una maquina de otra sede (404)', async () => {
    const { sedes } = await montarGimnasio();
    const dueno = await entrarComo('owner@gymmaq.co');
    const sur = await dueno
      .post('/api/maquinas')
      .send({ nombre: 'Maq-sur', sede: String(sedes.sur._id) })
      .expect(201);

    const recepcion = await entrarComo('norte@gymmaq.co');
    await recepcion
      .patch(`/api/maquinas/${sur.body.data._id}`)
      .send({ estado: ESTADOS_MAQUINA.MANTENIMIENTO })
      .expect(404);
  });
});
