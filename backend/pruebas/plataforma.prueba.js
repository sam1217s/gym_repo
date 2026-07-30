import peticion from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { obtenerConexion } from '../src/config/baseDatos.js';
import { ESTADOS_TENANT, ROLES } from '../src/config/constantes.js';
import { ejecutarConTenant, ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo } from '../src/modelos/indice.js';
import { crearServidor } from '../src/servidor.js';
import { cifrarContrasena } from '../src/utilidades/contrasena.js';
import { limpiarColecciones } from './configuracion.js';

/**
 * Rutas de plataforma: la frontera plataforma -> tenant.
 *
 * Lo critico aqui es en negativo: NADIE que no sea super_admin entra, y un
 * onboarding a medias no deja un tenant huerfano.
 */

const CONTRASENA = 'ClaveInicial1';
const CONTRASENA_DUENO_NUEVO = 'ClaveDueno123';

const app = crearServidor();

/** Cada ruta de plataforma con su metodo, para recorrerlas todas en negativo. */
const RUTAS_PLATAFORMA = [
  ['get', '/api/plataforma/planes'],
  ['post', '/api/plataforma/planes'],
  ['get', '/api/plataforma/planes/000000000000000000000000'],
  ['patch', '/api/plataforma/planes/000000000000000000000000'],
  ['delete', '/api/plataforma/planes/000000000000000000000000'],
  ['get', '/api/plataforma/tenants'],
  ['post', '/api/plataforma/tenants'],
  ['get', '/api/plataforma/tenants/000000000000000000000000'],
  ['patch', '/api/plataforma/tenants/000000000000000000000000/suspender'],
  ['patch', '/api/plataforma/tenants/000000000000000000000000/reactivar'],
  ['patch', '/api/plataforma/tenants/000000000000000000000000/cancelar'],
];

async function crearSuperAdmin() {
  return ejecutarSinTenant(async () =>
    obtenerModelo('Usuario').create({
      tenant: null,
      nombres: 'Root',
      apellidos: 'Plataforma',
      email: 'root@gymsaas.co',
      contrasenaHash: await cifrarContrasena(CONTRASENA),
      rol: ROLES.SUPER_ADMIN,
      debeCambiarContrasena: false,
    }),
  );
}

async function crearPlanPlataforma(sobrescribir = {}) {
  return ejecutarSinTenant(() =>
    obtenerModelo('PlanPlataforma').create({
      nombre: `Plan ${Math.random()}`,
      precioMensual: 100_000,
      limites: { maxSedes: 3, maxMiembros: 500, maxUsuarios: 5 },
      ...sobrescribir,
    }),
  );
}

async function crearGimnasioConDuena(plan, { slug = 'gimnasio-existente' } = {}) {
  return ejecutarSinTenant(async () => {
    const tenant = await obtenerModelo('Tenant').create({
      nombre: 'Gimnasio Existente',
      nit: '900111',
      slug,
      estado: ESTADOS_TENANT.ACTIVO,
      planPlataforma: plan._id,
    });

    const duena = await obtenerModelo('Usuario').create({
      tenant: tenant._id,
      nombres: 'Laura',
      apellidos: 'Duena',
      email: 'laura@gimnasio-existente.co',
      contrasenaHash: await cifrarContrasena(CONTRASENA),
      rol: ROLES.TENANT_OWNER,
      debeCambiarContrasena: false,
    });

    return { tenant, duena };
  });
}

/** Devuelve un agente de supertest ya autenticado con ese email. */
async function entrarComo(email) {
  const agente = peticion.agent(app);
  await agente
    .post('/api/auth/iniciar-sesion')
    .send({ identificador: email, contrasena: CONTRASENA })
    .expect(200);
  return agente;
}

function cuerpoOnboarding(plan, sobrescribir = {}) {
  return {
    gimnasio: {
      nombre: 'PowerZone',
      nit: '901234567-8',
      slug: 'powerzone',
      planPlataforma: String(plan._id),
      ...sobrescribir.gimnasio,
    },
    dueno: {
      nombres: 'Marta',
      apellidos: 'Gomez',
      email: 'marta@powerzone.co',
      contrasenaInicial: CONTRASENA_DUENO_NUEVO,
      ...sobrescribir.dueno,
    },
    sede: {
      nombre: 'Sede Principal',
      direccion: 'Calle 45 #12-30',
      telefono: '6015550101',
      ...sobrescribir.sede,
    },
  };
}

beforeEach(async () => {
  await limpiarColecciones();
  vi.restoreAllMocks();
});

describe('proteccion de las rutas de plataforma', () => {
  it('sin sesion, todas devuelven 401', async () => {
    for (const [metodo, ruta] of RUTAS_PLATAFORMA) {
      await peticion(app)[metodo](ruta).expect(401);
    }
  });

  it('un tenant_owner recibe 403 en TODAS las rutas de plataforma', async () => {
    const plan = await crearPlanPlataforma();
    await crearGimnasioConDuena(plan);
    const agente = await entrarComo('laura@gimnasio-existente.co');

    for (const [metodo, ruta] of RUTAS_PLATAFORMA) {
      const respuesta = await agente[metodo](ruta);
      expect(respuesta.status, `${metodo.toUpperCase()} ${ruta}`).toBe(403);
    }
  });
});

describe('planes de plataforma', () => {
  it('crea, lista y actualiza un plan', async () => {
    await crearSuperAdmin();
    const agente = await entrarComo('root@gymsaas.co');

    const creacion = await agente
      .post('/api/plataforma/planes')
      .send({
        nombre: 'Basico',
        precioMensual: 80_000,
        limites: { maxSedes: 1, maxMiembros: 50, maxUsuarios: 3 },
        features: { whatsapp: false, reportes: true },
      })
      .expect(201);

    expect(creacion.body.data.nombre).toBe('Basico');

    const listado = await agente.get('/api/plataforma/planes').expect(200);
    expect(listado.body.data).toHaveLength(1);

    const actualizacion = await agente
      .patch(`/api/plataforma/planes/${creacion.body.data._id}`)
      .send({ precioMensual: 90_000, limites: { maxSedes: 2 } })
      .expect(200);

    expect(actualizacion.body.data.precioMensual).toBe(90_000);
    expect(actualizacion.body.data.limites.maxSedes).toBe(2);
    // Las claves de `limites` que no viajaron no se pisan.
    expect(actualizacion.body.data.limites.maxMiembros).toBe(50);
  });

  it('rechaza un nombre de plan duplicado con 409', async () => {
    await crearSuperAdmin();
    await crearPlanPlataforma({ nombre: 'Basico' });
    const agente = await entrarComo('root@gymsaas.co');

    await agente
      .post('/api/plataforma/planes')
      .send({
        nombre: 'Basico',
        precioMensual: 80_000,
        limites: { maxSedes: 1, maxMiembros: 50, maxUsuarios: 3 },
      })
      .expect(409);
  });

  it('DELETE archiva el plan en lugar de borrarlo', async () => {
    await crearSuperAdmin();
    const plan = await crearPlanPlataforma();
    const agente = await entrarComo('root@gymsaas.co');

    const respuesta = await agente.delete(`/api/plataforma/planes/${plan._id}`).expect(200);
    expect(respuesta.body.data.activo).toBe(false);

    // Sigue existiendo: los tenants que lo referencian no se rompen.
    await agente.get(`/api/plataforma/planes/${plan._id}`).expect(200);
  });
});

describe('onboarding de un gimnasio', () => {
  it('crea tenant + dueno + primera sede, y la sede queda dentro del tenant', async () => {
    await crearSuperAdmin();
    const plan = await crearPlanPlataforma();
    const agente = await entrarComo('root@gymsaas.co');

    const respuesta = await agente
      .post('/api/plataforma/tenants')
      .send(cuerpoOnboarding(plan))
      .expect(201);

    const { tenant, dueno, sede } = respuesta.body.data;
    expect(tenant.estado).toBe(ESTADOS_TENANT.TRIAL);
    expect(dueno.rol).toBe(ROLES.TENANT_OWNER);
    expect(dueno.debeCambiarContrasena).toBe(true);
    expect(respuesta.body.data).not.toHaveProperty('dueno.contrasenaHash');

    // La sede nacio DENTRO del contexto del tenant nuevo.
    const sedesDelTenant = await ejecutarConTenant(tenant._id, () =>
      obtenerModelo('Sede').find(),
    );
    expect(sedesDelTenant).toHaveLength(1);
    expect(String(sedesDelTenant[0]._id)).toBe(String(sede._id));

    // Y otro tenant no la ve.
    const otro = await crearGimnasioConDuena(plan, { slug: 'otro-gimnasio' });
    const sedesDelOtro = await ejecutarConTenant(otro.tenant._id, () =>
      obtenerModelo('Sede').find(),
    );
    expect(sedesDelOtro).toHaveLength(0);
  });

  it('el dueno nuevo puede entrar y queda obligado a cambiar la contrasena', async () => {
    await crearSuperAdmin();
    const plan = await crearPlanPlataforma();
    const agente = await entrarComo('root@gymsaas.co');
    await agente.post('/api/plataforma/tenants').send(cuerpoOnboarding(plan)).expect(201);

    const sesionDueno = await peticion(app)
      .post('/api/auth/iniciar-sesion')
      .send({ identificador: 'marta@powerzone.co', contrasena: CONTRASENA_DUENO_NUEVO })
      .expect(200);

    expect(sesionDueno.body.data.debeCambiarContrasena).toBe(true);
  });

  it('rechaza un slug ya ocupado con 409 y no deja nada a medias', async () => {
    await crearSuperAdmin();
    const plan = await crearPlanPlataforma();
    await crearGimnasioConDuena(plan, { slug: 'powerzone' });
    const agente = await entrarComo('root@gymsaas.co');

    await agente.post('/api/plataforma/tenants').send(cuerpoOnboarding(plan)).expect(409);

    const duenos = await ejecutarSinTenant(() =>
      obtenerModelo('Usuario').find({ email: 'marta@powerzone.co' }),
    );
    expect(duenos).toHaveLength(0);
  });

  it('rechaza un plan archivado', async () => {
    await crearSuperAdmin();
    const plan = await crearPlanPlataforma({ activo: false });
    const agente = await entrarComo('root@gymsaas.co');

    await agente.post('/api/plataforma/tenants').send(cuerpoOnboarding(plan)).expect(400);
  });

  it('si falla la creacion de la sede, deshace el tenant y el dueno (compensacion)', async () => {
    await crearSuperAdmin();
    const plan = await crearPlanPlataforma();
    const agente = await entrarComo('root@gymsaas.co');

    // Se sabotea el paso 3 (la sede) para comprobar que los pasos 1 y 2 se deshacen.
    const Sede = obtenerConexion().models.Sede;
    vi.spyOn(Sede, 'create').mockRejectedValueOnce(new Error('fallo simulado'));

    await agente.post('/api/plataforma/tenants').send(cuerpoOnboarding(plan)).expect(500);

    const restos = await ejecutarSinTenant(async () => ({
      tenants: await obtenerModelo('Tenant').find({ slug: 'powerzone' }),
      duenos: await obtenerModelo('Usuario').find({ email: 'marta@powerzone.co' }),
    }));

    expect(restos.tenants).toHaveLength(0);
    expect(restos.duenos).toHaveLength(0);
  });
});

describe('ciclo de vida del tenant', () => {
  /**
   * Suspender cierra el gimnasio, no la puerta: su duena entra igual, pero solo
   * puede llegar a Facturacion. Si no pudiera entrar, no podria pagar.
   */
  it('suspender cierra las rutas de negocio pero deja entrar; reactivar lo devuelve todo', async () => {
    await crearSuperAdmin();
    const plan = await crearPlanPlataforma();
    const { tenant } = await crearGimnasioConDuena(plan);
    const agente = await entrarComo('root@gymsaas.co');

    await agente.patch(`/api/plataforma/tenants/${tenant._id}/suspender`).expect(200);

    const duena = await entrarComo('laura@gimnasio-existente.co');
    await duena.get('/api/miembros').expect(403);
    await duena.get('/api/facturacion').expect(200);

    await agente.patch(`/api/plataforma/tenants/${tenant._id}/reactivar`).expect(200);

    const duenaReactivada = await entrarComo('laura@gimnasio-existente.co');
    await duenaReactivada.get('/api/miembros').expect(200);
  });

  it('cancelar si cierra la puerta: sus usuarios no entran', async () => {
    await crearSuperAdmin();
    const plan = await crearPlanPlataforma();
    const { tenant } = await crearGimnasioConDuena(plan);
    const agente = await entrarComo('root@gymsaas.co');

    await agente.patch(`/api/plataforma/tenants/${tenant._id}/cancelar`).expect(200);

    await peticion(app)
      .post('/api/auth/iniciar-sesion')
      .send({ identificador: 'laura@gimnasio-existente.co', contrasena: CONTRASENA })
      .expect(403);
  });

  it('cancelado es terminal: no se puede reactivar', async () => {
    await crearSuperAdmin();
    const plan = await crearPlanPlataforma();
    const { tenant } = await crearGimnasioConDuena(plan);
    const agente = await entrarComo('root@gymsaas.co');

    await agente.patch(`/api/plataforma/tenants/${tenant._id}/cancelar`).expect(200);
    await agente.patch(`/api/plataforma/tenants/${tenant._id}/reactivar`).expect(409);
  });

  it('lista los tenants con su plan, su dueno y su numero de sedes', async () => {
    await crearSuperAdmin();
    const plan = await crearPlanPlataforma({ nombre: 'Pro' });
    const { tenant } = await crearGimnasioConDuena(plan);

    await ejecutarConTenant(tenant._id, () =>
      obtenerModelo('Sede').create({ nombre: 'Norte', direccion: 'Calle 1' }),
    );

    const agente = await entrarComo('root@gymsaas.co');
    const respuesta = await agente.get('/api/plataforma/tenants').expect(200);

    expect(respuesta.body.data).toHaveLength(1);
    const fila = respuesta.body.data[0];
    expect(fila.planPlataforma.nombre).toBe('Pro');
    expect(fila.dueno.email).toBe('laura@gimnasio-existente.co');
    expect(fila.totalSedes).toBe(1);
    // Las credenciales de WhatsApp no viajan ni al super_admin.
    expect(fila.config?.whatsapp?.credenciales).toBeUndefined();
  });

  it('edita los datos basicos de un gimnasio (nombre, nit, slug, plan)', async () => {
    await crearSuperAdmin();
    const plan = await crearPlanPlataforma({ nombre: 'Basico' });
    const otroPlan = await crearPlanPlataforma({ nombre: 'Pro' });
    const { tenant } = await crearGimnasioConDuena(plan);
    const agente = await entrarComo('root@gymsaas.co');

    const respuesta = await agente
      .patch(`/api/plataforma/tenants/${tenant._id}`)
      .send({
        nombre: 'Gimnasio Renombrado',
        slug: 'gym-nuevo-slug',
        planPlataforma: String(otroPlan._id),
        dueno: { nombres: 'Laura Nueva', email: 'nueva@correo.co' },
      })
      .expect(200);

    expect(respuesta.body.data.nombre).toBe('Gimnasio Renombrado');
    expect(respuesta.body.data.slug).toBe('gym-nuevo-slug');
    expect(respuesta.body.data.planPlataforma.nombre).toBe('Pro');
    expect(respuesta.body.data.dueno.nombres).toBe('Laura Nueva');
    expect(respuesta.body.data.dueno.email).toBe('nueva@correo.co');

    // El dueno ahora entra con el correo nuevo.
    await entrarComo('nueva@correo.co');
  });

  it('rechaza editar un gimnasio con un slug ya ocupado (409)', async () => {
    await crearSuperAdmin();
    const plan = await crearPlanPlataforma();
    const { tenant: a } = await crearGimnasioConDuena(plan, { slug: 'gym-a' });
    await crearGimnasioConDuena(plan, { slug: 'gym-b' });
    const agente = await entrarComo('root@gymsaas.co');

    await agente
      .patch(`/api/plataforma/tenants/${a._id}`)
      .send({ slug: 'gym-b' })
      .expect(409);
  });

  it('filtra por estado', async () => {
    await crearSuperAdmin();
    const plan = await crearPlanPlataforma();
    const { tenant } = await crearGimnasioConDuena(plan);
    const agente = await entrarComo('root@gymsaas.co');

    await agente.patch(`/api/plataforma/tenants/${tenant._id}/suspender`).expect(200);

    const suspendidos = await agente
      .get('/api/plataforma/tenants')
      .query({ estado: ESTADOS_TENANT.SUSPENDIDO })
      .expect(200);
    expect(suspendidos.body.data).toHaveLength(1);

    const activos = await agente
      .get('/api/plataforma/tenants')
      .query({ estado: ESTADOS_TENANT.ACTIVO })
      .expect(200);
    expect(activos.body.data).toHaveLength(0);
  });
});
