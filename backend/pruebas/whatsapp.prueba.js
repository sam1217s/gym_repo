import peticion from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { ESTADOS_TENANT, PROVEEDORES_WHATSAPP, ROLES } from '../src/config/constantes.js';
import { ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo } from '../src/modelos/indice.js';
import { crearServidor } from '../src/servidor.js';
import { cifrarContrasena } from '../src/utilidades/contrasena.js';
import { limpiarColecciones } from './configuracion.js';

/**
 * Config del canal de WhatsApp (Twilio) de un gimnasio. La pone el SUPER_ADMIN,
 * igual que las llaves de Wompi y por el mismo motivo: el Auth Token es un
 * secreto. Lo critico: que el AUTH TOKEN nunca vuelva al cliente y que el dueño
 * no la toque.
 */

const CONTRASENA = 'ClaveInicial1';
const app = crearServidor();

const CREDENCIALES = {
  proveedor: PROVEEDORES_WHATSAPP.TWILIO,
  accountSid: 'AC0123456789',
  authToken: 'auth-token-secreto',
  numero: '+14155238886',
  plantillaVencimiento: 'HXvence123',
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
      nit: '900222',
      slug: 'glowup-wa',
      estado: ESTADOS_TENANT.ACTIVO,
      planPlataforma: plan._id,
    });
    await obtenerModelo('Usuario').create({
      tenant: null, nombres: 'Super', apellidos: 'Admin',
      email: 'admin@gymsaas.co', contrasenaHash: hash, rol: ROLES.SUPER_ADMIN, debeCambiarContrasena: false,
    });
    await obtenerModelo('Usuario').create({
      tenant: tenant._id, nombres: 'Laura', apellidos: 'Duena',
      email: 'owner@glowup-wa.co', contrasenaHash: hash, rol: ROLES.TENANT_OWNER, debeCambiarContrasena: false,
    });
    return { tenant };
  });
}

async function entrarComo(email) {
  const agente = peticion.agent(app);
  await agente.post('/api/auth/iniciar-sesion').send({ identificador: email, contrasena: CONTRASENA }).expect(200);
  return agente;
}

const rutaWhatsapp = (id) => `/api/plataforma/tenants/${id}/whatsapp`;

beforeEach(limpiarColecciones);

describe('Canal de WhatsApp del gimnasio (config del super_admin)', () => {
  it('arranca sin configurar y dice que plantilla de referencia usar', async () => {
    const { tenant } = await montar();
    const admin = await entrarComo('admin@gymsaas.co');

    const respuesta = await admin.get(rutaWhatsapp(tenant._id)).expect(200);
    expect(respuesta.body.data).toMatchObject({
      proveedor: PROVEEDORES_WHATSAPP.NINGUNO,
      configurado: false,
      plantillaReferencia: { nombre: 'avisa_vence2', idioma: 'es_CO' },
    });
  });

  it('guarda las credenciales SIN devolver el Auth Token', async () => {
    const { tenant } = await montar();
    const admin = await entrarComo('admin@gymsaas.co');

    const respuesta = await admin.put(rutaWhatsapp(tenant._id)).send(CREDENCIALES).expect(200);
    expect(respuesta.body.data).toMatchObject({
      proveedor: PROVEEDORES_WHATSAPP.TWILIO,
      configurado: true,
      accountSid: CREDENCIALES.accountSid, // identificador, no secreto
      numero: CREDENCIALES.numero,
    });
    expect(respuesta.body.data.plantillas.vencimiento).toBe(CREDENCIALES.plantillaVencimiento);
    expect(JSON.stringify(respuesta.body)).not.toContain(CREDENCIALES.authToken);

    // Pero SI quedo guardado: el cron lo necesita para enviar.
    const guardado = await ejecutarSinTenant(() => obtenerModelo('Tenant').findById(tenant._id));
    expect(guardado.config.whatsapp.credenciales.authToken).toBe(CREDENCIALES.authToken);
  });

  it('twilio sin Auth Token (ni guardado previo) es 400', async () => {
    const { tenant } = await montar();
    const admin = await entrarComo('admin@gymsaas.co');

    await admin
      .put(rutaWhatsapp(tenant._id))
      .send({ proveedor: PROVEEDORES_WHATSAPP.TWILIO, accountSid: 'AC1', numero: '+1' })
      .expect(400);
  });

  it('se puede apagar el canal volviendo a "ninguno"', async () => {
    const { tenant } = await montar();
    const admin = await entrarComo('admin@gymsaas.co');
    await admin.put(rutaWhatsapp(tenant._id)).send(CREDENCIALES).expect(200);

    const apagado = await admin
      .put(rutaWhatsapp(tenant._id))
      .send({ proveedor: PROVEEDORES_WHATSAPP.NINGUNO })
      .expect(200);

    expect(apagado.body.data).toMatchObject({ proveedor: PROVEEDORES_WHATSAPP.NINGUNO, configurado: false });
  });

  it('un dueño NO puede tocar el canal (403: es cosa del super_admin)', async () => {
    const { tenant } = await montar();
    const duena = await entrarComo('owner@glowup-wa.co');

    await duena.get(rutaWhatsapp(tenant._id)).expect(403);
    await duena.put(rutaWhatsapp(tenant._id)).send(CREDENCIALES).expect(403);
  });
});
