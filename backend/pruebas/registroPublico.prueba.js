import peticion from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ESTADOS_TENANT,
  MESES_TRIAL_GRATIS,
  PLAN_SUSCRIPCION_NOMBRE,
  PLAN_SUSCRIPCION_PRECIO,
  ROLES,
} from '../src/config/constantes.js';
import { ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo } from '../src/modelos/indice.js';
import { registrarGimnasioPublico } from '../src/servicios/registroPublico.servicio.js';
import { ejecutarCobranza } from '../src/tareas/facturacion.tarea.js';
import { crearServidor } from '../src/servidor.js';
import { firmarTokenVerificacion } from '../src/utilidades/token.js';
import { sumarMeses } from '../src/utilidades/fechas.js';
import { limpiarColecciones } from './configuracion.js';

/**
 * Registro publico: cualquiera da de alta su gimnasio, estrena 2 meses gratis y
 * no entra hasta confirmar el correo.
 *
 * Lo critico: (1) sin verificar el correo NO se puede iniciar sesion, y (2) el
 * cron de cobranza NO factura durante la prueba gratis. Un fallo en cualquiera
 * de las dos regala o cobra de mas.
 */

const app = crearServidor();

/** El plan unico tiene que existir para poder registrarse. */
async function crearPlanDeSuscripcion() {
  return ejecutarSinTenant(() =>
    obtenerModelo('PlanPlataforma').create({
      nombre: PLAN_SUSCRIPCION_NOMBRE,
      precioMensual: PLAN_SUSCRIPCION_PRECIO,
      limites: { maxSedes: 10, maxMiembros: 2000, maxUsuarios: 50 },
      features: { whatsapp: true, reportes: true },
    }),
  );
}

function cuerpoRegistro(sobrescribir = {}) {
  return {
    gimnasio: { nombre: 'PowerZone', nit: '901234567-8', slug: 'powerzone', ...sobrescribir.gimnasio },
    dueno: {
      nombres: 'Marta',
      apellidos: 'Gomez',
      email: 'marta@powerzone.co',
      contrasena: 'ClaveFuerte123',
      ...sobrescribir.dueno,
    },
    sede: { nombre: 'Sede Principal', direccion: 'Calle 45 #12-30', ...sobrescribir.sede },
  };
}

const registrar = (cuerpo) => peticion(app).post('/api/auth/registrar-gimnasio').send(cuerpo);

const entrar = (email, contrasena) =>
  peticion(app).post('/api/auth/iniciar-sesion').send({ identificador: email, contrasena });

function leerDueno(email) {
  return ejecutarSinTenant(() => obtenerModelo('Usuario').findOne({ email }));
}

beforeEach(async () => {
  await limpiarColecciones();
  vi.restoreAllMocks();
});

describe('POST /api/auth/registrar-gimnasio', () => {
  it('crea el gimnasio en trial con 2 meses gratis, y un dueno sin verificar', async () => {
    await crearPlanDeSuscripcion();

    const respuesta = await registrar(cuerpoRegistro()).expect(201);
    expect(respuesta.body.data).toMatchObject({ email: 'marta@powerzone.co', gimnasio: 'PowerZone' });
    // No abre sesion: el registro no entrega cookies.
    expect(respuesta.headers['set-cookie']).toBeUndefined();

    const tenant = await ejecutarSinTenant(() => obtenerModelo('Tenant').findOne({ slug: 'powerzone' }));
    expect(tenant.estado).toBe(ESTADOS_TENANT.TRIAL);

    // finTrial ~ hoy + 2 meses (se compara por dia, la corrida tarda milisegundos).
    const esperado = sumarMeses(new Date(), MESES_TRIAL_GRATIS);
    expect(tenant.finTrial.toDateString()).toBe(esperado.toDateString());

    const dueno = await leerDueno('marta@powerzone.co');
    expect(dueno.rol).toBe(ROLES.TENANT_OWNER);
    expect(dueno.emailVerificado).toBe(false);
    // Eligio su clave: no se le obliga a cambiarla.
    expect(dueno.debeCambiarContrasena).toBe(false);
  });

  it('dispara el correo de verificacion con un enlace que lleva token', async () => {
    await crearPlanDeSuscripcion();

    const enviado = [];
    await registrarGimnasioPublico(cuerpoRegistro(), {
      enviarCorreo: (aviso) => {
        enviado.push(aviso);
      },
    });

    expect(enviado).toHaveLength(1);
    expect(enviado[0].dueno.email).toBe('marta@powerzone.co');
    expect(enviado[0].enlace).toMatch(/\/verificar-email\?token=.+/);
  });

  it('rechaza un slug ya ocupado y no deja al dueno a medias', async () => {
    await crearPlanDeSuscripcion();
    await registrar(cuerpoRegistro()).expect(201);

    // Otro correo, mismo slug.
    await registrar(cuerpoRegistro({ dueno: { email: 'otra@powerzone.co' } })).expect(409);

    const duenos = await ejecutarSinTenant(() =>
      obtenerModelo('Usuario').find({ email: 'otra@powerzone.co' }),
    );
    expect(duenos).toHaveLength(0);
  });

  it('exige una contrasena robusta', async () => {
    await crearPlanDeSuscripcion();
    await registrar(cuerpoRegistro({ dueno: { contrasena: 'corta' } })).expect(400);
  });

  it('si no hay plan de suscripcion configurado, responde con un error claro', async () => {
    // Sin crear el plan.
    const respuesta = await registrar(cuerpoRegistro()).expect(400);
    expect(respuesta.body.error.mensaje).toMatch(/no esta disponible/i);
  });
});

describe('el correo bloquea el login', () => {
  it('un dueno sin verificar NO puede iniciar sesion', async () => {
    await crearPlanDeSuscripcion();
    await registrar(cuerpoRegistro()).expect(201);

    const respuesta = await entrar('marta@powerzone.co', 'ClaveFuerte123').expect(403);
    expect(respuesta.body.error.mensaje).toMatch(/confirma tu correo/i);
  });

  it('tras verificar el correo, ya puede entrar', async () => {
    await crearPlanDeSuscripcion();
    await registrar(cuerpoRegistro()).expect(201);

    const dueno = await leerDueno('marta@powerzone.co');
    const token = firmarTokenVerificacion(dueno);

    const verif = await peticion(app).get('/api/auth/verificar-email').query({ token }).expect(200);
    expect(verif.body.data.email).toBe('marta@powerzone.co');

    // Ahora si entra, y la sesion dice que esta en trial.
    const sesion = await entrar('marta@powerzone.co', 'ClaveFuerte123').expect(200);
    expect(sesion.body.data.tenantEstado).toBe(ESTADOS_TENANT.TRIAL);
  });

  it('verificar dos veces con el mismo enlace no falla (idempotente)', async () => {
    await crearPlanDeSuscripcion();
    await registrar(cuerpoRegistro()).expect(201);
    const token = firmarTokenVerificacion(await leerDueno('marta@powerzone.co'));

    await peticion(app).get('/api/auth/verificar-email').query({ token }).expect(200);
    await peticion(app).get('/api/auth/verificar-email').query({ token }).expect(200);
  });

  it('un token invalido se rechaza con 400', async () => {
    await peticion(app).get('/api/auth/verificar-email').query({ token: 'no-es-un-token' }).expect(400);
  });
});

describe('los 2 meses gratis frente al cron de cobranza', () => {
  async function registrarYObtenerTenant() {
    await crearPlanDeSuscripcion();
    await registrar(cuerpoRegistro()).expect(201);
    return ejecutarSinTenant(() => obtenerModelo('Tenant').findOne({ slug: 'powerzone' }));
  }

  it('durante la prueba, el cron NO emite factura', async () => {
    await registrarYObtenerTenant();

    const resumen = await ejecutarCobranza();
    expect(resumen.facturasCreadas).toBe(0);

    const facturas = await ejecutarSinTenant(() => obtenerModelo('FacturaPlataforma').find());
    expect(facturas).toHaveLength(0);
  });

  it('cuando la prueba ya termino, el cron SI factura', async () => {
    const tenant = await registrarYObtenerTenant();

    // Se adelanta el reloj: la prueba termino hace un mes.
    await ejecutarSinTenant(() =>
      obtenerModelo('Tenant').updateOne({ _id: tenant._id }, { finTrial: sumarMeses(new Date(), -1) }),
    );

    const resumen = await ejecutarCobranza();
    expect(resumen.facturasCreadas).toBe(1);

    const factura = await ejecutarSinTenant(() => obtenerModelo('FacturaPlataforma').findOne());
    expect(factura.monto).toBe(PLAN_SUSCRIPCION_PRECIO);
  });
});
