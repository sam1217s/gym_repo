import peticion from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { ESTADOS_TENANT, ROLES } from '../src/config/constantes.js';
import { ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo } from '../src/modelos/indice.js';
import { crearServidor } from '../src/servidor.js';
import { cifrarContrasena } from '../src/utilidades/contrasena.js';
import { limpiarColecciones } from './configuracion.js';

/**
 * Config del cobro en linea a miembros (llaves Wompi del gimnasio). La configura
 * el SUPER_ADMIN por gimnasio, no el dueno. Lo critico: que los SECRETOS nunca
 * vuelvan al cliente, y que un dueno no pueda tocarlas.
 */

const CONTRASENA = 'ClaveInicial1';
const app = crearServidor();

const LLAVES = {
  llavePublica: 'pub_prod_llave',
  secretoIntegridad: 'prod_integrity_secreto',
  secretoEventos: 'prod_events_secreto',
};

async function montar() {
  return ejecutarSinTenant(async () => {
    const hash = await cifrarContrasena(CONTRASENA);
    const plan = await obtenerModelo('PlanPlataforma').create({
      nombre: `Plan ${Math.random()}`,
      precioMensual: 100_000,
      limites: { maxSedes: 2, maxMiembros: 5, maxUsuarios: 3 },
    });
    const tenant = await obtenerModelo('Tenant').create({
      nombre: 'GlowUp',
      nit: '900111',
      slug: 'glowup',
      estado: ESTADOS_TENANT.ACTIVO,
      planPlataforma: plan._id,
    });
    await obtenerModelo('Usuario').create({
      tenant: null,
      nombres: 'Super',
      apellidos: 'Admin',
      email: 'admin@gymsaas.co',
      contrasenaHash: hash,
      rol: ROLES.SUPER_ADMIN,
      debeCambiarContrasena: false,
    });
    await obtenerModelo('Usuario').create({
      tenant: tenant._id,
      nombres: 'Laura',
      apellidos: 'Duena',
      email: 'owner@glowup.co',
      contrasenaHash: hash,
      rol: ROLES.TENANT_OWNER,
      debeCambiarContrasena: false,
    });
    return { tenant };
  });
}

async function entrarComo(email) {
  const agente = peticion.agent(app);
  await agente.post('/api/auth/iniciar-sesion').send({ identificador: email, contrasena: CONTRASENA }).expect(200);
  return agente;
}

const rutaCobros = (id) => `/api/plataforma/tenants/${id}/cobros`;

beforeEach(limpiarColecciones);

describe('Cobros del gimnasio (config del super_admin)', () => {
  it('arranca sin configurar y trae la URL del webhook a registrar', async () => {
    const { tenant } = await montar();
    const admin = await entrarComo('admin@gymsaas.co');

    const respuesta = await admin.get(rutaCobros(tenant._id)).expect(200);
    expect(respuesta.body.data.configurado).toBe(false);
    expect(respuesta.body.data.urlWebhook).toMatch(/\/api\/webhooks\/wompi-miembro$/);
  });

  it('el super_admin guarda las llaves de un gimnasio, SIN devolver los secretos', async () => {
    const { tenant } = await montar();
    const admin = await entrarComo('admin@gymsaas.co');

    const respuesta = await admin.put(rutaCobros(tenant._id)).send(LLAVES).expect(200);
    expect(respuesta.body.data.configurado).toBe(true);
    expect(respuesta.body.data.llavePublica).toBe(LLAVES.llavePublica);
    expect(JSON.stringify(respuesta.body)).not.toContain(LLAVES.secretoIntegridad);
    expect(JSON.stringify(respuesta.body)).not.toContain(LLAVES.secretoEventos);

    // Pero SI se guardaron: el pago de miembro los necesita.
    const guardado = await ejecutarSinTenant(() => obtenerModelo('Tenant').findById(tenant._id));
    expect(guardado.config.wompi.secretoEventos).toBe(LLAVES.secretoEventos);
  });

  it('exige las tres llaves', async () => {
    const { tenant } = await montar();
    const admin = await entrarComo('admin@gymsaas.co');
    await admin.put(rutaCobros(tenant._id)).send({ llavePublica: 'solo-una' }).expect(400);
  });

  it('un dueno NO puede tocar las llaves de cobros (403: es cosa del super_admin)', async () => {
    const { tenant } = await montar();
    const duena = await entrarComo('owner@glowup.co');

    await duena.get(rutaCobros(tenant._id)).expect(403);
    await duena.put(rutaCobros(tenant._id)).send(LLAVES).expect(403);
  });

  it('sin sesion, 401', async () => {
    const { tenant } = await montar();
    await peticion(app).get(rutaCobros(tenant._id)).expect(401);
  });
});
