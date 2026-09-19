import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import peticion from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ESTADOS_TENANT, PROVEEDORES_WHATSAPP, ROLES } from '../src/config/constantes.js';
import { entorno } from '../src/config/entorno.js';
import { ejecutarConTenant, ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo } from '../src/modelos/indice.js';
import {
  procesarEventoEntrante,
  purgarComprobantesAntiguos,
} from '../src/servicios/mensajes.servicio.js';
import { crearServidor } from '../src/servidor.js';
import { cifrarContrasena } from '../src/utilidades/contrasena.js';
import { limpiarColecciones } from './configuracion.js';

/**
 * Bandeja de WhatsApp (Twilio). Lo critico: que un evento SIN firma valida no
 * entre (si no, cualquiera inyectaria comprobantes falsos), que Twilio pueda
 * reintentar sin duplicar, y que un sede_admin solo vea la conversacion de SUS
 * miembros.
 */

const CONTRASENA = 'ClaveInicial1';
const app = crearServidor();

const NUMERO_TWILIO = '+14155238886';
const AUTH_TOKEN = 'auth-token-secreto';
const TEL_ANA = '573001110001';
const TEL_BETO = '573002220002';
const URL_WEBHOOK = `${entorno.ORIGEN_PUBLICO}/api/webhooks/whatsapp`;

async function montar() {
  const tenant = await ejecutarSinTenant(async () => {
    const plan = await obtenerModelo('PlanPlataforma').create({
      nombre: `Plan ${Math.random()}`,
      precioMensual: 100_000,
      limites: { maxSedes: 5, maxMiembros: 500, maxUsuarios: 10 },
    });
    return obtenerModelo('Tenant').create({
      nombre: 'GymMsg',
      nit: '900777',
      slug: 'gymmsg',
      estado: ESTADOS_TENANT.ACTIVO,
      planPlataforma: plan._id,
      config: {
        whatsapp: {
          proveedor: PROVEEDORES_WHATSAPP.TWILIO,
          credenciales: { accountSid: 'AC1', authToken: AUTH_TOKEN, numero: NUMERO_TWILIO },
        },
      },
    });
  });

  const datos = await ejecutarConTenant(tenant._id, async () => {
    const Sede = obtenerModelo('Sede');
    const norte = await Sede.create({ nombre: 'Norte', direccion: 'Calle 100' });
    const sur = await Sede.create({ nombre: 'Sur', direccion: 'Carrera 30' });

    const Miembro = obtenerModelo('Miembro');
    const ana = await Miembro.create({
      sede: norte._id, nombres: 'Ana', apellidos: 'Norte', documento: '111', telefono: TEL_ANA,
    });
    const beto = await Miembro.create({
      sede: sur._id, nombres: 'Beto', apellidos: 'Sur', documento: '222', telefono: TEL_BETO,
    });
    return { sedes: { norte, sur }, ana, beto };
  });

  const hash = await cifrarContrasena(CONTRASENA);
  await ejecutarSinTenant(async () => {
    const Usuario = obtenerModelo('Usuario');
    await Usuario.create({
      tenant: tenant._id, nombres: 'Laura', apellidos: 'Duena',
      email: 'owner@gymmsg.co', contrasenaHash: hash, rol: ROLES.TENANT_OWNER, debeCambiarContrasena: false,
    });
    await Usuario.create({
      tenant: tenant._id, sede: datos.sedes.sur._id, nombres: 'Carlos', apellidos: 'Sur',
      email: 'sur@gymmsg.co', contrasenaHash: hash, rol: ROLES.SEDE_ADMIN, debeCambiarContrasena: false,
    });
  });

  return { tenant, ...datos };
}

async function entrarComo(email) {
  const agente = peticion.agent(app);
  await agente.post('/api/auth/iniciar-sesion').send({ identificador: email, contrasena: CONTRASENA }).expect(200);
  return agente;
}

/** Los parametros (form-urlencoded) como los manda Twilio cuando un miembro escribe. */
function evento({ telefono = TEL_ANA, texto = 'ya hice la transferencia', sid = 'SM.AAA' } = {}) {
  return {
    To: `whatsapp:${NUMERO_TWILIO}`,
    From: `whatsapp:+${telefono}`,
    Body: texto,
    MessageSid: sid,
    NumMedia: '0',
  };
}

/** Twilio firma: base64(HMAC-SHA1(authToken, URL + params ordenados key+value)). */
function firmarTwilio(url, params, authToken = AUTH_TOKEN) {
  const datos =
    url +
    Object.keys(params)
      .sort()
      .map((clave) => clave + params[clave])
      .join('');
  return crypto.createHmac('sha1', authToken).update(Buffer.from(datos, 'utf-8')).digest('base64');
}

function enviarWebhook(params, firmaForzada) {
  return peticion(app)
    .post('/api/webhooks/whatsapp')
    .type('form')
    .set('x-twilio-signature', firmaForzada ?? firmarTwilio(URL_WEBHOOK, params))
    .send(params);
}

beforeEach(limpiarColecciones);

describe('Webhook de WhatsApp (Twilio)', () => {
  it('guarda el mensaje y lo ata al miembro por su telefono', async () => {
    const { tenant, ana } = await montar();

    await enviarWebhook(evento()).expect(200);

    const guardados = await ejecutarConTenant(tenant._id, () =>
      obtenerModelo('MensajeWhatsapp').find(),
    );
    expect(guardados).toHaveLength(1);
    expect(guardados[0]).toMatchObject({
      direccion: 'entrante',
      texto: 'ya hice la transferencia',
      telefono: TEL_ANA,
      leido: false,
    });
    expect(String(guardados[0].miembro)).toBe(String(ana._id));
    expect(String(guardados[0].sede)).toBe(String(ana.sede)); // hereda la sede
  });

  it('una firma invalida NO entra (nadie inyecta comprobantes falsos)', async () => {
    const { tenant } = await montar();

    await enviarWebhook(evento(), 'firmafalsa').expect(401);

    const guardados = await ejecutarConTenant(tenant._id, () =>
      obtenerModelo('MensajeWhatsapp').countDocuments(),
    );
    expect(guardados).toBe(0);
  });

  it('es idempotente: el mismo mensaje dos veces se guarda una sola vez', async () => {
    const { tenant } = await montar();

    await enviarWebhook(evento()).expect(200);
    await enviarWebhook(evento()).expect(200); // Twilio reintenta

    const guardados = await ejecutarConTenant(tenant._id, () =>
      obtenerModelo('MensajeWhatsapp').countDocuments(),
    );
    expect(guardados).toBe(1);
  });

  it('un numero que no es de ningun gimnasio se ignora sin romper', async () => {
    await montar();
    const ajeno = evento();
    ajeno.To = 'whatsapp:+19999999999';

    await enviarWebhook(ajeno).expect(200);
  });

  it('un comprobante con imagen se descarga y se sube a Cloudinary', async () => {
    const { tenant } = await montar();
    const params = {
      To: `whatsapp:${NUMERO_TWILIO}`,
      From: `whatsapp:+${TEL_ANA}`,
      Body: '',
      MessageSid: 'SM.media',
      NumMedia: '1',
      MediaUrl0: 'https://api.twilio.com/media/xyz',
      MediaContentType0: 'image/jpeg',
    };
    const firma = firmarTwilio(URL_WEBHOOK, params);

    const descargar = vi.fn().mockResolvedValue({ buffer: Buffer.from('img'), mimeType: 'image/jpeg' });
    const subir = vi.fn().mockResolvedValue({
      publicId: `gymsaas/comprobantes/${tenant._id}/SM.media`,
      tipoRecurso: 'image',
    });

    const resultado = await procesarEventoEntrante(
      { params, urlPublica: URL_WEBHOOK, firma },
      { subir, descargar },
    );
    expect(resultado.guardados).toBe(1);
    expect(descargar).toHaveBeenCalledOnce();
    expect(subir).toHaveBeenCalledOnce();

    const guardado = await ejecutarConTenant(tenant._id, () =>
      obtenerModelo('MensajeWhatsapp').findOne({ idMensajeWhatsapp: 'SM.media' }),
    );
    expect(guardado.tipo).toBe('imagen');
    expect(guardado.archivoPublicId).toBe(`gymsaas/comprobantes/${tenant._id}/SM.media`);
    expect(guardado.archivoTipoRecurso).toBe('image');
  });
});

describe('Bandeja de mensajes', () => {
  it('la bandeja es SOLO del dueño: un sede_admin recibe 403', async () => {
    await montar();
    await enviarWebhook(evento()).expect(200); // Ana, sede norte
    await enviarWebhook(evento({ telefono: TEL_BETO, sid: 'SM.BBB' })).expect(200); // Beto, sur

    // El dueño ve TODA la bandeja (todas las sedes).
    const dueno = await entrarComo('owner@gymmsg.co');
    const todos = await dueno.get('/api/mensajes').expect(200);
    expect(todos.body.data.mensajes).toHaveLength(2);
    expect(todos.body.data.pendientes).toBe(2);

    // Un sede_admin no la puede abrir.
    const sur = await entrarComo('sur@gymmsg.co');
    await sur.get('/api/mensajes').expect(403);
  });

  it('el dueño puede filtrar por sede y ve el nombre de la sede de cada hilo', async () => {
    const { sedes } = await montar();
    await enviarWebhook(evento()).expect(200); // Ana, sede norte
    await enviarWebhook(evento({ telefono: TEL_BETO, sid: 'SM.BBB' })).expect(200); // Beto, sur

    const dueno = await entrarComo('owner@gymmsg.co');

    // Sin filtro ve los dos, y cada mensaje trae el nombre de su sede.
    const todos = await dueno.get('/api/mensajes').expect(200);
    expect(todos.body.data.mensajes).toHaveLength(2);
    const deAna = todos.body.data.mensajes.find((m) => m.telefono === TEL_ANA);
    expect(deAna.sede.nombre).toBe('Norte');

    // Filtrando por la sede Sur solo queda el hilo de Beto.
    const soloSur = await dueno.get('/api/mensajes').query({ sede: String(sedes.sur._id) }).expect(200);
    expect(soloSur.body.data.mensajes).toHaveLength(1);
    expect(soloSur.body.data.mensajes[0].telefono).toBe(TEL_BETO);
  });

  it('marcar leidos baja el contador de pendientes', async () => {
    await montar();
    await enviarWebhook(evento()).expect(200);

    const dueno = await entrarComo('owner@gymmsg.co');
    await dueno.post('/api/mensajes/marcar-leidos').send({}).expect(200);

    const pendientes = await dueno.get('/api/mensajes/pendientes').expect(200);
    expect(pendientes.body.data.pendientes).toBe(0);
  });
});

describe('Purga de comprobantes antiguos', () => {
  let carpetaComprobantes = null;

  afterEach(async () => {
    if (carpetaComprobantes) {
      await rm(carpetaComprobantes, { recursive: true, force: true });
      carpetaComprobantes = null;
    }
  });

  /** Envejece el createdAt con el driver crudo: Mongoose lo marca inmutable. */
  async function envejecer(Mensaje, id, meses) {
    const fecha = new Date();
    fecha.setMonth(fecha.getMonth() - meses);
    await Mensaje.collection.updateOne({ _id: id }, { $set: { createdAt: fecha } });
  }

  it('borra el comprobante viejo de Cloudinary y conserva el registro; deja el reciente', async () => {
    const { tenant } = await montar();

    const publicIdViejo = `gymsaas/comprobantes/${tenant._id}/viejo`;
    const ids = await ejecutarConTenant(tenant._id, async () => {
      const Mensaje = obtenerModelo('MensajeWhatsapp');
      const viejo = await Mensaje.create({
        telefono: TEL_ANA, direccion: 'entrante', tipo: 'imagen',
        archivoPublicId: publicIdViejo, archivoTipoRecurso: 'image', idMensajeWhatsapp: 'SM.viejo',
      });
      const nuevo = await Mensaje.create({
        telefono: TEL_ANA, direccion: 'entrante', tipo: 'imagen',
        archivoPublicId: `gymsaas/comprobantes/${tenant._id}/nuevo`, archivoTipoRecurso: 'image',
        idMensajeWhatsapp: 'SM.nuevo',
      });
      await envejecer(Mensaje, viejo._id, 4); // 4 meses: mas que la retencion (3)
      return { viejo: viejo._id, nuevo: nuevo._id };
    });

    const borrar = vi.fn().mockResolvedValue({});
    const resultado = await purgarComprobantesAntiguos({ borrar });
    expect(resultado.borrados).toBe(1);
    expect(borrar).toHaveBeenCalledWith(publicIdViejo, { tipoRecurso: 'image' });

    const enBase = await ejecutarConTenant(tenant._id, async () => {
      const Mensaje = obtenerModelo('MensajeWhatsapp');
      return {
        viejo: await Mensaje.findById(ids.viejo),
        nuevo: await Mensaje.findById(ids.nuevo),
      };
    });
    expect(enBase.viejo).not.toBeNull(); // el mensaje se conserva
    expect(enBase.viejo.archivoPublicId).toBeNull(); // sin la referencia al archivo
    expect(enBase.nuevo.archivoPublicId).not.toBeNull(); // el reciente, intacto
  });

  it('purga un comprobante HEREDADO en disco y suelta la referencia', async () => {
    const { tenant } = await montar();

    const raiz = path.resolve(entorno.ALMACEN_ARCHIVOS, 'whatsapp');
    carpetaComprobantes = path.join(raiz, String(tenant._id));
    await mkdir(carpetaComprobantes, { recursive: true });

    const relVieja = `${tenant._id}/viejo.jpeg`;
    const absVieja = path.resolve(raiz, relVieja);
    await writeFile(absVieja, 'imagen-vieja');

    const id = await ejecutarConTenant(tenant._id, async () => {
      const Mensaje = obtenerModelo('MensajeWhatsapp');
      const viejo = await Mensaje.create({
        telefono: TEL_ANA, direccion: 'entrante', tipo: 'imagen',
        archivo: relVieja, mimeType: 'image/jpeg', idMensajeWhatsapp: 'SM.disco',
      });
      await envejecer(Mensaje, viejo._id, 4);
      return viejo._id;
    });

    const resultado = await purgarComprobantesAntiguos();
    expect(resultado.borrados).toBe(1);
    expect(existsSync(absVieja)).toBe(false); // el archivo de disco se borro

    const enBase = await ejecutarConTenant(tenant._id, () =>
      obtenerModelo('MensajeWhatsapp').findById(id),
    );
    expect(enBase).not.toBeNull();
    expect(enBase.archivo).toBeNull();
  });
});
