import peticion from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { ESTADOS_TENANT, ROLES } from '../src/config/constantes.js';
import { ejecutarConTenant, ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo } from '../src/modelos/indice.js';
import { crearServidor } from '../src/servidor.js';
import { cifrarContrasena } from '../src/utilidades/contrasena.js';
import { limpiarColecciones } from './configuracion.js';

/**
 * Core del gimnasio: sedes, usuarios, planes de membresia y miembros.
 *
 * Lo critico es el ALCANCE POR SEDE: el plugin ya garantiza que un gimnasio no
 * ve a otro; aqui se verifica la muralla interna, que un `sede_admin` no vea
 * ni toque lo que pertenece a la otra sede de SU PROPIO gimnasio.
 */

const CONTRASENA = 'ClaveInicial1';

const app = crearServidor();

/** Gimnasio completo: dueno, dos sedes y un sede_admin atado a la sede norte. */
async function crearGimnasio({ slug = 'gimnasio-a', dominio = 'gimnasio-a.co' } = {}) {
  const { tenant } = await ejecutarSinTenant(async () => {
    const plan = await obtenerModelo('PlanPlataforma').create({
      nombre: `Plan ${Math.random()}`,
      precioMensual: 100_000,
      limites: { maxSedes: 5, maxMiembros: 500, maxUsuarios: 10 },
    });

    return {
      tenant: await obtenerModelo('Tenant').create({
        nombre: 'Gimnasio',
        nit: '900111',
        slug,
        estado: ESTADOS_TENANT.ACTIVO,
        planPlataforma: plan._id,
      }),
    };
  });

  const sedes = await ejecutarConTenant(tenant._id, async () => {
    const Sede = obtenerModelo('Sede');
    const norte = await Sede.create({ nombre: 'Norte', direccion: 'Calle 100' });
    const sur = await Sede.create({ nombre: 'Sur', direccion: 'Carrera 30' });
    return { norte, sur };
  });

  const contrasenaHash = await cifrarContrasena(CONTRASENA);

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
      apellidos: 'Recepcion',
      email: `norte@${dominio}`,
      contrasenaHash,
      rol: ROLES.SEDE_ADMIN,
      debeCambiarContrasena: false,
    });

    return { dueno, adminNorte };
  });

  return { tenant, sedes, usuarios };
}

async function crearMiembroEn(tenantId, sedeId, documento) {
  return ejecutarConTenant(tenantId, () =>
    obtenerModelo('Miembro').create({
      sede: sedeId,
      nombres: 'Miembro',
      apellidos: documento,
      documento,
      telefono: '573001234567',
    }),
  );
}

async function entrarComo(email) {
  const agente = peticion.agent(app);
  await agente
    .post('/api/auth/iniciar-sesion')
    .send({ identificador: email, contrasena: CONTRASENA })
    .expect(200);
  return agente;
}

beforeEach(limpiarColecciones);

describe('alcance por sede (la muralla interna)', () => {
  it('un sede_admin NO ve los miembros de la otra sede de su gimnasio', async () => {
    const { tenant, sedes } = await crearGimnasio();
    await crearMiembroEn(tenant._id, sedes.norte._id, '111');
    await crearMiembroEn(tenant._id, sedes.sur._id, '222');

    const norte = await entrarComo('norte@gimnasio-a.co');
    const respuesta = await norte.get('/api/miembros').expect(200);

    expect(respuesta.body.data).toHaveLength(1);
    expect(respuesta.body.data[0].documento).toBe('111');
  });

  it('ni pidiendo la otra sede por query: su filtro gana', async () => {
    const { tenant, sedes } = await crearGimnasio();
    await crearMiembroEn(tenant._id, sedes.sur._id, '222');

    const norte = await entrarComo('norte@gimnasio-a.co');
    const respuesta = await norte
      .get('/api/miembros')
      .query({ sede: String(sedes.sur._id) })
      .expect(200);

    expect(respuesta.body.data).toHaveLength(0);
  });

  it('el dueno SI ve los miembros de todas sus sedes', async () => {
    const { tenant, sedes } = await crearGimnasio();
    await crearMiembroEn(tenant._id, sedes.norte._id, '111');
    await crearMiembroEn(tenant._id, sedes.sur._id, '222');

    const dueno = await entrarComo('owner@gimnasio-a.co');
    const respuesta = await dueno.get('/api/miembros').expect(200);

    expect(respuesta.body.data).toHaveLength(2);
  });

  it('un sede_admin no puede editar un miembro de la otra sede: para el no existe', async () => {
    const { tenant, sedes } = await crearGimnasio();
    const ajeno = await crearMiembroEn(tenant._id, sedes.sur._id, '222');

    const norte = await entrarComo('norte@gimnasio-a.co');
    await norte.patch(`/api/miembros/${ajeno._id}`).send({ nombres: 'Hackeado' }).expect(404);
  });

  it('un sede_admin crea miembros SIEMPRE en su sede, diga lo que diga el cuerpo', async () => {
    const { sedes } = await crearGimnasio();

    const norte = await entrarComo('norte@gimnasio-a.co');
    const respuesta = await norte
      .post('/api/miembros')
      .send({
        nombres: 'Ana',
        apellidos: 'Nueva',
        documento: '333',
        telefono: '573001234567',
        sede: String(sedes.sur._id), // intenta colarla en la sede sur
      })
      .expect(201);

    expect(respuesta.body.data.sede).toBe(String(sedes.norte._id));
  });

  it('un sede_admin no puede mover un miembro suyo a otra sede', async () => {
    const { tenant, sedes } = await crearGimnasio();
    const propio = await crearMiembroEn(tenant._id, sedes.norte._id, '111');

    const norte = await entrarComo('norte@gimnasio-a.co');
    await norte
      .patch(`/api/miembros/${propio._id}`)
      .send({ sede: String(sedes.sur._id) })
      .expect(403);
  });
});

describe('roles sobre sedes, usuarios y planes de membresia', () => {
  it('un sede_admin puede LEER sedes y planes pero no escribirlos', async () => {
    await crearGimnasio();
    const norte = await entrarComo('norte@gimnasio-a.co');

    await norte.get('/api/sedes').expect(200);
    await norte.get('/api/planes-membresia').expect(200);

    await norte.post('/api/sedes').send({ nombre: 'Pirata', direccion: 'X' }).expect(403);
    await norte
      .post('/api/planes-membresia')
      .send({ nombre: 'Pirata', precio: 1, duracionMeses: 1 })
      .expect(403);
    await norte.get('/api/usuarios').expect(403);
  });

  it('el dueno crea un sede_admin que nace obligado a cambiar la contrasena', async () => {
    const { sedes } = await crearGimnasio();
    const dueno = await entrarComo('owner@gimnasio-a.co');

    const respuesta = await dueno
      .post('/api/usuarios')
      .send({
        nombres: 'Nueva',
        apellidos: 'Admin',
        email: 'sur@gimnasio-a.co',
        contrasenaInicial: 'ClaveDeSur123',
        sede: String(sedes.sur._id),
      })
      .expect(201);

    expect(respuesta.body.data.rol).toBe(ROLES.SEDE_ADMIN);
    expect(respuesta.body.data.debeCambiarContrasena).toBe(true);
    expect(JSON.stringify(respuesta.body)).not.toContain('contrasenaHash');

    // Y puede entrar con su clave inicial.
    await peticion(app)
      .post('/api/auth/iniciar-sesion')
      .send({ identificador: 'sur@gimnasio-a.co', contrasena: 'ClaveDeSur123' })
      .expect(200);
  });

  it('desactivar un sede_admin lo saca de su sesion abierta', async () => {
    const { usuarios } = await crearGimnasio();
    const norte = await entrarComo('norte@gimnasio-a.co');
    const dueno = await entrarComo('owner@gimnasio-a.co');

    await dueno
      .patch(`/api/usuarios/${usuarios.adminNorte._id}`)
      .send({ activo: false })
      .expect(200);

    await norte.get('/api/miembros').expect(401);
  });

  it('el dueno no puede administrarse a si mismo por este CRUD', async () => {
    const { usuarios } = await crearGimnasio();
    const dueno = await entrarComo('owner@gimnasio-a.co');

    await dueno
      .patch(`/api/usuarios/${usuarios.dueno._id}`)
      .send({ activo: false })
      .expect(404);
  });

  it('el dueno elimina a un sede_admin, pero NO a si mismo ni a otro dueno', async () => {
    const { usuarios } = await crearGimnasio();
    const dueno = await entrarComo('owner@gimnasio-a.co');

    // A si mismo: 404 (el CRUD del dueno solo alcanza sede_admin).
    await dueno.delete(`/api/usuarios/${usuarios.dueno._id}`).expect(404);

    // A un sede_admin: se borra y desaparece de la lista.
    await dueno.delete(`/api/usuarios/${usuarios.adminNorte._id}`).expect(200);
    const lista = await dueno.get('/api/usuarios').expect(200);
    expect(lista.body.data.some((u) => u._id === String(usuarios.adminNorte._id))).toBe(false);
  });

  it('un dueno no puede tocar usuarios de OTRO gimnasio (aislamiento manual de Usuario)', async () => {
    await crearGimnasio();
    const otro = await crearGimnasio({ slug: 'gimnasio-b', dominio: 'gimnasio-b.co' });

    const duenoA = await entrarComo('owner@gimnasio-a.co');

    // Lo lista: solo ve su gimnasio.
    const lista = await duenoA.get('/api/usuarios').expect(200);
    expect(lista.body.data.every((usuario) => usuario.email.endsWith('gimnasio-a.co'))).toBe(true);

    // Lo edita: el sede_admin del otro gimnasio no existe para el.
    await duenoA
      .patch(`/api/usuarios/${otro.usuarios.adminNorte._id}`)
      .send({ activo: false })
      .expect(404);
  });

  it('CRUD de sede y de plan de membresia con nombres duplicados en 409', async () => {
    const { sedes } = await crearGimnasio();
    const dueno = await entrarComo('owner@gimnasio-a.co');

    await dueno.post('/api/sedes').send({ nombre: 'Norte', direccion: 'X' }).expect(409);

    // El nombre del plan solo choca DENTRO de la misma sede.
    await dueno
      .post('/api/planes-membresia')
      .send({ nombre: 'Mensual', precio: 60_000, duracionMeses: 1, sede: String(sedes.norte._id) })
      .expect(201);
    await dueno
      .post('/api/planes-membresia')
      .send({ nombre: 'Mensual', precio: 1, duracionMeses: 1, sede: String(sedes.norte._id) })
      .expect(409);

    // La otra sede si puede tener su propio plan "Mensual", a otro precio.
    await dueno
      .post('/api/planes-membresia')
      .send({ nombre: 'Mensual', precio: 45_000, duracionMeses: 1, sede: String(sedes.sur._id) })
      .expect(201);
  });
});
