import peticion from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { ROLES } from '../src/config/constantes.js';
import { ejecutarConTenant, ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo } from '../src/modelos/indice.js';
import { crearServidor } from '../src/servidor.js';
import { cifrarContrasena } from '../src/utilidades/contrasena.js';
import { limpiarColecciones } from './configuracion.js';

/**
 * Bitacora de auditoria. La escribe un middleware transversal tras cada
 * operacion exitosa que muta datos. Lo critico: registra QUIEN hizo QUE (dueño y
 * encargados), el dueño la ve entera, y no ensucia con GETs ni operaciones
 * fallidas. La escritura es asincrona (res.on('finish')), asi que se hace poll.
 */

const CONTRASENA = 'ClaveInicial1';
const app = crearServidor();

async function montarGimnasio() {
  const tenant = await ejecutarSinTenant(async () => {
    return obtenerModelo('Tenant').create({
      nombre: 'GymAud',
      nit: '900555',
      slug: 'gymaud',
    });
  });

  const sedes = await ejecutarConTenant(tenant._id, async () => {
    const Sede = obtenerModelo('Sede');
    const norte = await Sede.create({ nombre: 'Norte', direccion: 'Calle 100' });
    return { norte };
  });

  const hash = await cifrarContrasena(CONTRASENA);
  await ejecutarSinTenant(async () => {
    const Usuario = obtenerModelo('Usuario');
    await Usuario.create({
      tenant: tenant._id, nombres: 'Laura', apellidos: 'Duena',
      email: 'owner@gymaud.co', contrasenaHash: hash, rol: ROLES.TENANT_OWNER, debeCambiarContrasena: false,
    });
    await Usuario.create({
      tenant: tenant._id, sede: sedes.norte._id, nombres: 'Carlos', apellidos: 'Norte',
      email: 'norte@gymaud.co', contrasenaHash: hash, rol: ROLES.SEDE_ADMIN, debeCambiarContrasena: false,
    });
  });

  return { tenant, sedes };
}

async function entrarComo(email) {
  const agente = peticion.agent(app);
  await agente.post('/api/auth/iniciar-sesion').send({ identificador: email, contrasena: CONTRASENA }).expect(200);
  return agente;
}

const dormir = (ms) => new Promise((res) => setTimeout(res, ms));

/** La auditoria se escribe async: se reintenta hasta que aparezca. */
async function esperarBitacora(agente, minimo) {
  for (let i = 0; i < 30; i++) {
    const r = await agente.get('/api/auditoria').expect(200);
    if (r.body.data.length >= minimo) return r.body.data;
    await dormir(30);
  }
  throw new Error('La bitacora no registro a tiempo');
}

beforeEach(limpiarColecciones);

describe('Auditoria de movimientos', () => {
  it('anota quien registra un miembro, con su nombre y un detalle', async () => {
    const { sedes } = await montarGimnasio();
    const recepcion = await entrarComo('norte@gymaud.co');
    await recepcion
      .post('/api/miembros')
      .send({ nombres: 'Ana', apellidos: 'Perez', documento: '123', telefono: '573001234567', sede: String(sedes.norte._id) })
      .expect(201);

    const dueno = await entrarComo('owner@gymaud.co');
    const bitacora = await esperarBitacora(dueno, 1);

    const mov = bitacora.find((m) => m.recurso === 'miembros');
    expect(mov).toBeTruthy();
    expect(mov).toMatchObject({
      accion: 'Registro un miembro',
      usuarioNombre: 'Carlos Norte',
      usuarioRol: ROLES.SEDE_ADMIN,
      detalle: 'Ana Perez',
    });
  });

  it('anota tambien los movimientos del dueño', async () => {
    await montarGimnasio();
    const dueno = await entrarComo('owner@gymaud.co');
    await dueno.post('/api/sedes').send({ nombre: 'Sur', direccion: 'Carrera 30' }).expect(201);

    const bitacora = await esperarBitacora(dueno, 1);
    const mov = bitacora.find((m) => m.recurso === 'sedes');
    expect(mov).toMatchObject({ accion: 'Creo una sede', usuarioNombre: 'Laura Duena', detalle: 'Sur' });
  });

  it('un sede_admin no puede abrir la bitacora (403)', async () => {
    await montarGimnasio();
    const recepcion = await entrarComo('norte@gymaud.co');
    await recepcion.get('/api/auditoria').expect(403);
  });

  it('no anota los listados (GET) ni las operaciones fallidas', async () => {
    const { sedes } = await montarGimnasio();
    const dueno = await entrarComo('owner@gymaud.co');

    // Un listado (GET) y un alta invalida (400): ninguno debe dejar rastro.
    await dueno.get('/api/vencimientos').expect(200);
    await dueno.post('/api/sedes').send({ nombre: '' }).expect(400);

    await dormir(200);
    const r = await dueno.get('/api/auditoria').expect(200);
    expect(r.body.data).toHaveLength(0);
  });
});
