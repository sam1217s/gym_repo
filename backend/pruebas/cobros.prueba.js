import peticion from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { ESTADOS_TENANT, ROLES } from '../src/config/constantes.js';
import { ejecutarConTenant, ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo } from '../src/modelos/indice.js';
import { crearServidor } from '../src/servidor.js';
import { cifrarContrasena } from '../src/utilidades/contrasena.js';
import { limpiarColecciones } from './configuracion.js';

/**
 * Config del cobro en linea a miembros (llaves Wompi del dueno). Lo critico:
 * que los SECRETOS nunca vuelvan al cliente, y que solo el dueno pueda tocarlas.
 */

const CONTRASENA = 'ClaveInicial1';
const app = crearServidor();

const LLAVES = {
  llavePublica: 'pub_prod_llave',
  secretoIntegridad: 'prod_integrity_secreto',
  secretoEventos: 'prod_events_secreto',
};

async function montarGimnasio() {
  return ejecutarSinTenant(async () => {
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
    const hash = await cifrarContrasena(CONTRASENA);
    await obtenerModelo('Usuario').create({
      tenant: tenant._id,
      nombres: 'Laura',
      apellidos: 'Duena',
      email: 'owner@glowup.co',
      contrasenaHash: hash,
      rol: ROLES.TENANT_OWNER,
      debeCambiarContrasena: false,
    });
    const sede = await ejecutarConTenant(tenant._id, () =>
      obtenerModelo('Sede').create({ nombre: 'Norte', direccion: 'Calle 100' }),
    );
    await obtenerModelo('Usuario').create({
      tenant: tenant._id,
      sede: sede._id,
      nombres: 'Carlos',
      apellidos: 'Recepcion',
      email: 'recepcion@glowup.co',
      contrasenaHash: hash,
      rol: ROLES.SEDE_ADMIN,
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

beforeEach(limpiarColecciones);

describe('GET/PUT /api/cobros (llaves Wompi del dueno)', () => {
  it('arranca sin configurar y trae la URL del webhook a registrar', async () => {
    await montarGimnasio();
    const duena = await entrarComo('owner@glowup.co');

    const respuesta = await duena.get('/api/cobros').expect(200);
    expect(respuesta.body.data.configurado).toBe(false);
    expect(respuesta.body.data.urlWebhook).toMatch(/\/api\/webhooks\/wompi-miembro$/);
  });

  it('el dueno guarda las llaves y quedan activas, SIN devolver los secretos', async () => {
    const { tenant } = await montarGimnasio();
    const duena = await entrarComo('owner@glowup.co');

    const respuesta = await duena.put('/api/cobros').send(LLAVES).expect(200);
    expect(respuesta.body.data.configurado).toBe(true);
    expect(respuesta.body.data.llavePublica).toBe(LLAVES.llavePublica);
    // Los secretos JAMAS salen al cliente.
    expect(JSON.stringify(respuesta.body)).not.toContain(LLAVES.secretoIntegridad);
    expect(JSON.stringify(respuesta.body)).not.toContain(LLAVES.secretoEventos);

    // Pero SI se guardaron: el pago de miembro los necesita.
    const guardado = await ejecutarSinTenant(() => obtenerModelo('Tenant').findById(tenant._id));
    expect(guardado.config.wompi.secretoEventos).toBe(LLAVES.secretoEventos);
  });

  it('exige las tres llaves', async () => {
    await montarGimnasio();
    const duena = await entrarComo('owner@glowup.co');
    await duena.put('/api/cobros').send({ llavePublica: 'solo-una' }).expect(400);
  });

  it('un sede_admin no puede ver ni tocar las llaves (403)', async () => {
    await montarGimnasio();
    const recepcion = await entrarComo('recepcion@glowup.co');

    await recepcion.get('/api/cobros').expect(403);
    await recepcion.put('/api/cobros').send(LLAVES).expect(403);
  });

  it('sin sesion, 401', async () => {
    await montarGimnasio();
    await peticion(app).get('/api/cobros').expect(401);
  });
});
