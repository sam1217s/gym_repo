import peticion from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Twilio Verify se reemplaza por un doble: ninguna prueba toca la red. El codigo
// "correcto" es 123456; cualquier otro no aprueba.
vi.mock('../src/proveedores/twilioVerify.js', () => ({
  verifyConfigurado: () => true,
  iniciarVerificacion: vi.fn().mockResolvedValue({ estado: 'pending' }),
  comprobarVerificacion: vi.fn(async ({ codigo }) => ({ aprobado: codigo === '123456' })),
}));

import { COOKIE_ACCESO, ROLES } from '../src/config/constantes.js';
import { ejecutarConTenant, ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo } from '../src/modelos/indice.js';
import * as verify from '../src/proveedores/twilioVerify.js';
import { crearServidor } from '../src/servidor.js';
import { cifrarContrasena } from '../src/utilidades/contrasena.js';
import { limpiarColecciones } from './configuracion.js';

const CONTRASENA = 'ClaveInicial1';
const TEL_ADMIN = '+573001110001';
const app = crearServidor();

async function montar() {
  const tenant = await ejecutarSinTenant(() =>
    obtenerModelo('Tenant').create({ nombre: 'GymOtp', nit: '900888', slug: 'gymotp' }),
  );
  const sede = await ejecutarConTenant(tenant._id, () =>
    obtenerModelo('Sede').create({ nombre: 'Norte', direccion: 'Calle 100' }),
  );

  const hash = await cifrarContrasena(CONTRASENA);
  const { dueno, admin } = await ejecutarSinTenant(async () => {
    const Usuario = obtenerModelo('Usuario');
    const dueno = await Usuario.create({
      tenant: tenant._id, nombres: 'Laura', apellidos: 'Duena',
      email: 'owner@gymotp.co', contrasenaHash: hash, rol: ROLES.TENANT_OWNER, debeCambiarContrasena: false,
    });
    const admin = await Usuario.create({
      tenant: tenant._id, sede: sede._id, nombres: 'Carlos', apellidos: 'Norte',
      email: 'carlos@gymotp.co', contrasenaHash: hash, rol: ROLES.SEDE_ADMIN,
      telefono: TEL_ADMIN, debeCambiarContrasena: false,
    });
    return { dueno, admin };
  });

  return { tenant, sede, dueno, admin };
}

beforeEach(async () => {
  await limpiarColecciones();
  vi.clearAllMocks();
});

describe('POST /api/auth/otp/enviar', () => {
  it('envia el codigo solo si el telefono pertenece a un usuario, con respuesta generica', async () => {
    await montar();

    // Numero de un usuario -> se dispara el envio.
    await peticion(app)
      .post('/api/auth/otp/enviar')
      .send({ telefono: '573001110001', canal: 'whatsapp' })
      .expect(200);
    expect(verify.iniciarVerificacion).toHaveBeenCalledTimes(1);

    // Numero desconocido -> misma respuesta, pero NO se envia (ni se filtra que no existe).
    await peticion(app)
      .post('/api/auth/otp/enviar')
      .send({ telefono: '+573009999999', canal: 'sms' })
      .expect(200);
    expect(verify.iniciarVerificacion).toHaveBeenCalledTimes(1);
  });

  it('rechaza un canal invalido', async () => {
    await peticion(app)
      .post('/api/auth/otp/enviar')
      .send({ telefono: '573001110001', canal: 'paloma' })
      .expect(400);
  });
});

describe('POST /api/auth/otp/verificar', () => {
  it('con codigo correcto y telefono de un usuario, abre sesion (cookie HttpOnly)', async () => {
    await montar();

    const respuesta = await peticion(app)
      .post('/api/auth/otp/verificar')
      .send({ telefono: '573001110001', codigo: '123456' })
      .expect(200);

    expect(respuesta.body.data.rol).toBe(ROLES.SEDE_ADMIN);
    expect(respuesta.body.data.telefono).toBe(TEL_ADMIN);
    const cookies = respuesta.headers['set-cookie'] ?? [];
    expect(cookies.find((c) => c.startsWith(`${COOKIE_ACCESO}=`))).toMatch(/HttpOnly/i);
  });

  it('con codigo incorrecto responde 401 y no abre sesion', async () => {
    await montar();
    const respuesta = await peticion(app)
      .post('/api/auth/otp/verificar')
      .send({ telefono: '573001110001', codigo: '000000' })
      .expect(401);
    expect(respuesta.headers['set-cookie']).toBeUndefined();
  });

  it('codigo correcto pero telefono sin usuario: 401 (no crea sesion)', async () => {
    await montar();
    await peticion(app)
      .post('/api/auth/otp/verificar')
      .send({ telefono: '+573009999999', codigo: '123456' })
      .expect(401);
  });
});

describe('PATCH /api/auth/mi-telefono', () => {
  async function entrarComo(email) {
    const agente = peticion.agent(app);
    await agente.post('/api/auth/iniciar-sesion').send({ identificador: email, contrasena: CONTRASENA }).expect(200);
    return agente;
  }

  it('el dueno fija su propio telefono y luego puede entrar por OTP', async () => {
    await montar();
    const dueno = await entrarComo('owner@gymotp.co');

    const res = await dueno.patch('/api/auth/mi-telefono').send({ telefono: '573007778888' }).expect(200);
    expect(res.body.data.telefono).toBe('+573007778888');

    // Ahora el dueno puede pedir y verificar OTP con ese numero.
    await peticion(app)
      .post('/api/auth/otp/verificar')
      .send({ telefono: '573007778888', codigo: '123456' })
      .expect(200);
  });

  it('rechaza un telefono ya usado por otro usuario (409)', async () => {
    await montar();
    const dueno = await entrarComo('owner@gymotp.co');

    // TEL_ADMIN ya es del sede_admin.
    await dueno.patch('/api/auth/mi-telefono').send({ telefono: '573001110001' }).expect(409);
  });
});
