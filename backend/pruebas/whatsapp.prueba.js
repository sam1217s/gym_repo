import peticion from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { ESTADOS_TENANT, PROVEEDORES_WHATSAPP, ROLES } from '../src/config/constantes.js';
import { ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo } from '../src/modelos/indice.js';
import { crearServidor } from '../src/servidor.js';
import { cifrarContrasena } from '../src/utilidades/contrasena.js';
import { limpiarColecciones } from './configuracion.js';

/**
 * Config del canal de WhatsApp de un gimnasio. La pone el SUPER_ADMIN, igual que
 * las llaves de Wompi y por el mismo motivo: el token de Meta es un secreto.
 * Lo critico: que el TOKEN nunca vuelva al cliente y que el dueño no la toque.
 */

const CONTRASENA = 'ClaveInicial1';
const app = crearServidor();

const CREDENCIALES = {
  proveedor: PROVEEDORES_WHATSAPP.CLOUD_API,
  idTelefono: '123456789012345',
  token: 'EAAG-token-permanente-secreto',
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
  it('arranca sin configurar y dice que plantilla hay que aprobar en Meta', async () => {
    const { tenant } = await montar();
    const admin = await entrarComo('admin@gymsaas.co');

    const respuesta = await admin.get(rutaWhatsapp(tenant._id)).expect(200);
    expect(respuesta.body.data).toMatchObject({
      proveedor: PROVEEDORES_WHATSAPP.NINGUNO,
      configurado: false,
      plantilla: { nombre: 'aviso_vencimiento', idioma: 'es_CO' },
    });
  });

  it('guarda las credenciales SIN devolver el token', async () => {
    const { tenant } = await montar();
    const admin = await entrarComo('admin@gymsaas.co');

    const respuesta = await admin.put(rutaWhatsapp(tenant._id)).send(CREDENCIALES).expect(200);
    expect(respuesta.body.data).toMatchObject({
      proveedor: PROVEEDORES_WHATSAPP.CLOUD_API,
      configurado: true,
      idTelefono: CREDENCIALES.idTelefono, // identificador, no secreto
    });
    expect(JSON.stringify(respuesta.body)).not.toContain(CREDENCIALES.token);

    // Pero SI quedo guardado: el cron lo necesita para enviar.
    const guardado = await ejecutarSinTenant(() => obtenerModelo('Tenant').findById(tenant._id));
    expect(guardado.config.whatsapp.credenciales.token).toBe(CREDENCIALES.token);
  });

  it('cloud_api sin token es 400', async () => {
    const { tenant } = await montar();
    const admin = await entrarComo('admin@gymsaas.co');

    await admin
      .put(rutaWhatsapp(tenant._id))
      .send({ proveedor: PROVEEDORES_WHATSAPP.CLOUD_API, idTelefono: '123' })
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
