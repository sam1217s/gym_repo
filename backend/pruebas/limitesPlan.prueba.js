import peticion from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { ESTADOS_TENANT, ROLES } from '../src/config/constantes.js';
import { ejecutarConTenant, ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo } from '../src/modelos/indice.js';
import { crearServidor } from '../src/servidor.js';
import { cifrarContrasena } from '../src/utilidades/contrasena.js';
import { limpiarColecciones } from './configuracion.js';

/**
 * Limites del `PlanPlataforma`. El plan de estas pruebas es deliberadamente
 * pequeño (1 sede, 2 miembros, 2 usuarios) para chocar contra el techo rapido.
 *
 * Se cuentan solo los recursos ACTIVOS: dar de baja a un miembro libera cupo.
 */

const CONTRASENA = 'ClaveInicial1';

const app = crearServidor();

async function montarGimnasio() {
  const { tenant } = await ejecutarSinTenant(async () => {
    const plan = await obtenerModelo('PlanPlataforma').create({
      nombre: `Plan ${Math.random()}`,
      precioMensual: 80_000,
      limites: { maxSedes: 1, maxMiembros: 2, maxUsuarios: 2 },
    });

    const tenant = await obtenerModelo('Tenant').create({
      nombre: 'Gimnasio Limitado',
      nit: '900111',
      slug: 'gimnasio-limitado',
      estado: ESTADOS_TENANT.ACTIVO,
      planPlataforma: plan._id,
    });

    return { tenant };
  });

  const sede = await ejecutarConTenant(tenant._id, () =>
    obtenerModelo('Sede').create({ nombre: 'Norte', direccion: 'Calle 100' }),
  );

  await ejecutarSinTenant(async () =>
    obtenerModelo('Usuario').create({
      tenant: tenant._id,
      nombres: 'Laura',
      apellidos: 'Duena',
      email: 'owner@gimnasio-limitado.co',
      contrasenaHash: await cifrarContrasena(CONTRASENA),
      rol: ROLES.TENANT_OWNER,
      debeCambiarContrasena: false,
    }),
  );

  return { tenant, sede };
}

async function entrarComoDuena() {
  const agente = peticion.agent(app);
  await agente
    .post('/api/auth/iniciar-sesion')
    .send({ email: 'owner@gimnasio-limitado.co', contrasena: CONTRASENA })
    .expect(200);
  return agente;
}

/** Un `tenant_owner` ve todas las sedes, asi que tiene que decir en cual registra. */
const miembro = (documento, sedeId) => ({
  nombres: 'Ana',
  apellidos: documento,
  documento,
  telefono: '573001234567',
  ...(sedeId ? { sede: String(sedeId) } : {}),
});

beforeEach(limpiarColecciones);

describe('limite de sedes', () => {
  it('con el plan lleno, crear otra sede da 403 con un mensaje util', async () => {
    await montarGimnasio(); // el plan permite 1 sede, y ya existe una
    const duena = await entrarComoDuena();

    const respuesta = await duena
      .post('/api/sedes')
      .send({ nombre: 'Sur', direccion: 'Carrera 30' })
      .expect(403);

    expect(respuesta.body.error.mensaje).toMatch(/hasta 1 sede/i);
    expect(respuesta.body.error.mensaje).toMatch(/Cambia de plan/i);
  });

  it('desactivar la sede libera el cupo', async () => {
    const { tenant, sede } = await montarGimnasio();
    await ejecutarConTenant(tenant._id, () =>
      obtenerModelo('Sede').updateOne({ _id: sede._id }, { activa: false }),
    );

    const duena = await entrarComoDuena();
    await duena.post('/api/sedes').send({ nombre: 'Sur', direccion: 'Carrera 30' }).expect(201);
  });
});

describe('limite de miembros', () => {
  it('deja llegar al tope y bloquea el siguiente', async () => {
    const { sede } = await montarGimnasio();
    const duena = await entrarComoDuena();

    await duena.post('/api/miembros').send(miembro('111', sede._id)).expect(201);
    await duena.post('/api/miembros').send(miembro('222', sede._id)).expect(201);

    const respuesta = await duena.post('/api/miembros').send(miembro('333', sede._id)).expect(403);
    expect(respuesta.body.error.mensaje).toMatch(/hasta 2 miembro/i);
  });

  it('un miembro dado de baja no ocupa cupo', async () => {
    const { sede } = await montarGimnasio();
    const duena = await entrarComoDuena();

    const primero = await duena.post('/api/miembros').send(miembro('111', sede._id)).expect(201);
    await duena.post('/api/miembros').send(miembro('222', sede._id)).expect(201);

    await duena.patch(`/api/miembros/${primero.body.data._id}`).send({ activo: false }).expect(200);

    await duena.post('/api/miembros').send(miembro('333', sede._id)).expect(201);
  });
});

describe('limite de usuarios', () => {
  it('cuenta al dueno y bloquea cuando se llena', async () => {
    const { sede } = await montarGimnasio();
    const duena = await entrarComoDuena();

    const nuevoAdmin = {
      nombres: 'Carlos',
      apellidos: 'Sede',
      contrasenaInicial: 'ClaveDeSede123',
      sede: String(sede._id),
    };

    // El plan permite 2 usuarios y la duena ya es uno.
    await duena.post('/api/usuarios').send({ ...nuevoAdmin, email: 'uno@gimnasio-limitado.co' }).expect(201);

    const respuesta = await duena
      .post('/api/usuarios')
      .send({ ...nuevoAdmin, email: 'dos@gimnasio-limitado.co' })
      .expect(403);

    expect(respuesta.body.error.mensaje).toMatch(/hasta 2 usuario/i);
  });
});

describe('el limite no se cuela entre gimnasios', () => {
  it('los miembros de otro gimnasio no consumen el cupo de este', async () => {
    const { sede } = await montarGimnasio();

    // Otro gimnasio, con su propio plan y sus propios miembros.
    const otroTenant = await ejecutarSinTenant(async () => {
      const plan = await obtenerModelo('PlanPlataforma').create({
        nombre: `Plan ${Math.random()}`,
        precioMensual: 80_000,
        limites: { maxSedes: 5, maxMiembros: 50, maxUsuarios: 5 },
      });
      return obtenerModelo('Tenant').create({
        nombre: 'Otro',
        nit: '900222',
        slug: 'otro-gimnasio',
        estado: ESTADOS_TENANT.ACTIVO,
        planPlataforma: plan._id,
      });
    });

    await ejecutarConTenant(otroTenant._id, async () => {
      const sedeAjena = await obtenerModelo('Sede').create({ nombre: 'Unica', direccion: 'X' });
      const Miembro = obtenerModelo('Miembro');
      for (const documento of ['a1', 'a2', 'a3', 'a4']) {
        await Miembro.create(miembro(documento, sedeAjena._id));
      }
    });

    // El gimnasio limitado sigue teniendo sus 2 cupos intactos.
    const duena = await entrarComoDuena();
    await duena.post('/api/miembros').send(miembro('111', sede._id)).expect(201);
    await duena.post('/api/miembros').send(miembro('222', sede._id)).expect(201);
    await duena.post('/api/miembros').send(miembro('333', sede._id)).expect(403);
  });
});
