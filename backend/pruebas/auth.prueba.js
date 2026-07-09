import peticion from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { COOKIE_ACCESO, COOKIE_REFRESCO, ESTADOS_TENANT, ROLES } from '../src/config/constantes.js';
import { ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo } from '../src/modelos/indice.js';
import { crearServidor } from '../src/servidor.js';
import { cifrarContrasena } from '../src/utilidades/contrasena.js';
import { limpiarColecciones } from './configuracion.js';

/**
 * Flujo de autenticacion de punta a punta sobre la app real de Express:
 * cookies HttpOnly, revocacion por `versionToken`, cambio de contrasena
 * obligatorio y bloqueo de gimnasios suspendidos.
 */

const CONTRASENA = 'ClaveInicial1';
const CONTRASENA_NUEVA = 'ClaveNueva123';

const app = crearServidor();

/** Extrae una cookie por nombre de la cabecera `set-cookie`. */
function leerCookie(respuesta, nombre) {
  const cookies = respuesta.headers['set-cookie'] ?? [];
  return cookies.find((cookie) => cookie.startsWith(`${nombre}=`)) ?? null;
}

async function crearGimnasioConDuena({ estado = ESTADOS_TENANT.ACTIVO, debeCambiarContrasena = false } = {}) {
  return ejecutarSinTenant(async () => {
    const planPlataforma = await obtenerModelo('PlanPlataforma').create({
      nombre: `Plan ${Math.random()}`,
      precioMensual: 100_000,
      limites: { maxSedes: 3, maxMiembros: 500, maxUsuarios: 5 },
    });

    const tenant = await obtenerModelo('Tenant').create({
      nombre: 'Gimnasio Prueba',
      nit: '900333',
      slug: 'gimnasio-prueba',
      estado,
      planPlataforma: planPlataforma._id,
    });

    const usuario = await obtenerModelo('Usuario').create({
      tenant: tenant._id,
      nombres: 'Laura',
      apellidos: 'Duena',
      email: 'laura@gimnasio-prueba.co',
      contrasenaHash: await cifrarContrasena(CONTRASENA),
      rol: ROLES.TENANT_OWNER,
      debeCambiarContrasena,
    });

    return { tenant, usuario };
  });
}

beforeEach(limpiarColecciones);

describe('POST /api/auth/iniciar-sesion', () => {
  it('entrega las cookies de sesion como HttpOnly y no devuelve el token en el cuerpo', async () => {
    await crearGimnasioConDuena();

    const respuesta = await peticion(app)
      .post('/api/auth/iniciar-sesion')
      .send({ email: 'laura@gimnasio-prueba.co', contrasena: CONTRASENA })
      .expect(200);

    expect(respuesta.body.ok).toBe(true);
    expect(respuesta.body.data.rol).toBe(ROLES.TENANT_OWNER);

    // El token nunca viaja en el cuerpo: solo en cookies inaccesibles a JavaScript.
    expect(JSON.stringify(respuesta.body)).not.toMatch(/eyJ/);

    expect(leerCookie(respuesta, COOKIE_ACCESO)).toMatch(/HttpOnly/i);

    const cookieRefresco = leerCookie(respuesta, COOKIE_REFRESCO);
    expect(cookieRefresco).toMatch(/HttpOnly/i);
    // El refresh token no se adjunta al resto de la API.
    expect(cookieRefresco).toMatch(/Path=\/api\/auth\/refrescar/i);
  });

  it('rechaza una contrasena incorrecta sin revelar si el email existe', async () => {
    await crearGimnasioConDuena();

    const respuesta = await peticion(app)
      .post('/api/auth/iniciar-sesion')
      .send({ email: 'laura@gimnasio-prueba.co', contrasena: 'IncorrectaTotal9' })
      .expect(401);

    expect(respuesta.body.error.mensaje).toBe('Email o contrasena incorrectos');
  });

  it('devuelve el mismo mensaje cuando el email no existe', async () => {
    const respuesta = await peticion(app)
      .post('/api/auth/iniciar-sesion')
      .send({ email: 'nadie@ninguna-parte.co', contrasena: CONTRASENA })
      .expect(401);

    expect(respuesta.body.error.mensaje).toBe('Email o contrasena incorrectos');
  });

  it('bloquea el acceso a un gimnasio suspendido', async () => {
    await crearGimnasioConDuena({ estado: ESTADOS_TENANT.SUSPENDIDO });

    const respuesta = await peticion(app)
      .post('/api/auth/iniciar-sesion')
      .send({ email: 'laura@gimnasio-prueba.co', contrasena: CONTRASENA })
      .expect(403);

    expect(respuesta.body.error.mensaje).toMatch(/suspendido/i);
  });

  it('valida el cuerpo con Zod', async () => {
    const respuesta = await peticion(app)
      .post('/api/auth/iniciar-sesion')
      .send({ email: 'no-es-un-email', contrasena: '' })
      .expect(400);

    expect(respuesta.body.error.detalles).toEqual(
      expect.arrayContaining([expect.objectContaining({ campo: 'email' })]),
    );
  });
});

describe('rutas protegidas', () => {
  it('GET /api/auth/yo sin cookie devuelve 401', async () => {
    await peticion(app).get('/api/auth/yo').expect(401);
  });

  it('GET /api/auth/yo con cookie devuelve el usuario en sesion', async () => {
    await crearGimnasioConDuena();

    const agente = peticion.agent(app);
    await agente
      .post('/api/auth/iniciar-sesion')
      .send({ email: 'laura@gimnasio-prueba.co', contrasena: CONTRASENA })
      .expect(200);

    const respuesta = await agente.get('/api/auth/yo').expect(200);
    expect(respuesta.body.data.email).toBe('laura@gimnasio-prueba.co');
  });

  it('cerrar sesion revoca la cookie: reutilizarla devuelve 401', async () => {
    await crearGimnasioConDuena();

    const agente = peticion.agent(app);
    await agente
      .post('/api/auth/iniciar-sesion')
      .send({ email: 'laura@gimnasio-prueba.co', contrasena: CONTRASENA })
      .expect(200);

    // Se guarda la cookie ANTES de cerrar sesion para intentar reusarla despues.
    const respuestaSesion = await agente.get('/api/auth/yo').expect(200);
    expect(respuestaSesion.body.ok).toBe(true);

    const cookieRobada = leerCookie(
      await peticion(app)
        .post('/api/auth/iniciar-sesion')
        .send({ email: 'laura@gimnasio-prueba.co', contrasena: CONTRASENA }),
      COOKIE_ACCESO,
    );

    await agente.post('/api/auth/cerrar-sesion').expect(200);

    // `versionToken` subio, asi que el token viejo ya no vale aunque no haya expirado.
    await peticion(app).get('/api/auth/yo').set('Cookie', cookieRobada).expect(401);
  });
});

describe('cambio de contrasena obligatorio en el primer acceso', () => {
  it('el usuario nuevo entra marcado con debeCambiarContrasena', async () => {
    await crearGimnasioConDuena({ debeCambiarContrasena: true });

    const respuesta = await peticion(app)
      .post('/api/auth/iniciar-sesion')
      .send({ email: 'laura@gimnasio-prueba.co', contrasena: CONTRASENA })
      .expect(200);

    expect(respuesta.body.data.debeCambiarContrasena).toBe(true);
  });

  it('cambiar la contrasena limpia la marca y deja la sesion utilizable', async () => {
    await crearGimnasioConDuena({ debeCambiarContrasena: true });

    const agente = peticion.agent(app);
    await agente
      .post('/api/auth/iniciar-sesion')
      .send({ email: 'laura@gimnasio-prueba.co', contrasena: CONTRASENA })
      .expect(200);

    const respuesta = await agente
      .post('/api/auth/cambiar-contrasena')
      .send({ contrasenaActual: CONTRASENA, contrasenaNueva: CONTRASENA_NUEVA })
      .expect(200);

    expect(respuesta.body.data.debeCambiarContrasena).toBe(false);

    // El cambio sube `versionToken`; el controlador reemite cookies para no
    // expulsar a quien acaba de cambiarla.
    await agente.get('/api/auth/yo').expect(200);
  });

  it('rechaza el cambio si la contrasena actual no coincide', async () => {
    await crearGimnasioConDuena();

    const agente = peticion.agent(app);
    await agente
      .post('/api/auth/iniciar-sesion')
      .send({ email: 'laura@gimnasio-prueba.co', contrasena: CONTRASENA })
      .expect(200);

    await agente
      .post('/api/auth/cambiar-contrasena')
      .send({ contrasenaActual: 'OtraClave123', contrasenaNueva: CONTRASENA_NUEVA })
      .expect(400);
  });

  it('exige una contrasena nueva robusta', async () => {
    await crearGimnasioConDuena();

    const agente = peticion.agent(app);
    await agente
      .post('/api/auth/iniciar-sesion')
      .send({ email: 'laura@gimnasio-prueba.co', contrasena: CONTRASENA })
      .expect(200);

    await agente
      .post('/api/auth/cambiar-contrasena')
      .send({ contrasenaActual: CONTRASENA, contrasenaNueva: 'corta' })
      .expect(400);
  });
});

describe('POST /api/auth/refrescar', () => {
  it('renueva la sesion con la cookie de refresco', async () => {
    await crearGimnasioConDuena();

    const agente = peticion.agent(app);
    await agente
      .post('/api/auth/iniciar-sesion')
      .send({ email: 'laura@gimnasio-prueba.co', contrasena: CONTRASENA })
      .expect(200);

    const respuesta = await agente.post('/api/auth/refrescar').expect(200);
    expect(respuesta.body.data.email).toBe('laura@gimnasio-prueba.co');
    expect(leerCookie(respuesta, COOKIE_ACCESO)).toMatch(/HttpOnly/i);
  });

  it('sin cookie de refresco devuelve 401', async () => {
    await peticion(app).post('/api/auth/refrescar').expect(401);
  });
});
