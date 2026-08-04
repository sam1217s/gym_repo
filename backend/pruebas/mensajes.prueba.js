import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import peticion from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ESTADOS_TENANT, PROVEEDORES_WHATSAPP, ROLES } from '../src/config/constantes.js';
import { entorno } from '../src/config/entorno.js';
import { ejecutarConTenant, ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo } from '../src/modelos/indice.js';
import { purgarComprobantesAntiguos } from '../src/servicios/mensajes.servicio.js';
import { crearServidor } from '../src/servidor.js';
import { cifrarContrasena } from '../src/utilidades/contrasena.js';
import { limpiarColecciones } from './configuracion.js';

/**
 * Bandeja de WhatsApp. Lo critico: que un evento SIN firma valida no entre (si
 * no, cualquiera inyectaria comprobantes falsos), que Meta pueda reintentar sin
 * duplicar, y que un sede_admin solo vea la conversacion de SUS miembros.
 */

const CONTRASENA = 'ClaveInicial1';
const app = crearServidor();

const ID_TELEFONO = '111222333';
const SECRETO_APP = 'secreto-de-la-app';
const TEL_ANA = '573001110001';

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
          proveedor: PROVEEDORES_WHATSAPP.CLOUD_API,
          credenciales: { idTelefono: ID_TELEFONO, token: 'token-x', secretoApp: SECRETO_APP },
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
      sede: sur._id, nombres: 'Beto', apellidos: 'Sur', documento: '222', telefono: '573002220002',
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

/** Un evento de Meta como el que llega cuando un miembro escribe. */
function evento({ telefono = TEL_ANA, texto = 'ya hice la transferencia', wamid = 'wamid.AAA' } = {}) {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: ID_TELEFONO },
              messages: [{ from: telefono, id: wamid, type: 'text', text: { body: texto } }],
            },
          },
        ],
      },
    ],
  };
}

/** Meta firma el cuerpo CRUDO con el secreto de la app. */
function firmar(cuerpo) {
  const crudo = JSON.stringify(cuerpo);
  const firma = `sha256=${crypto.createHmac('sha256', SECRETO_APP).update(crudo).digest('hex')}`;
  return { crudo, firma };
}

function enviarWebhook(cuerpo, firmaForzada) {
  const { crudo, firma } = firmar(cuerpo);
  return peticion(app)
    .post('/api/webhooks/whatsapp')
    .set('Content-Type', 'application/json')
    .set('x-hub-signature-256', firmaForzada ?? firma)
    .send(crudo);
}

beforeEach(limpiarColecciones);

describe('Webhook de WhatsApp', () => {
  it('el handshake de Meta responde el desafio con el token correcto', async () => {
    const respuesta = await peticion(app)
      .get('/api/webhooks/whatsapp')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'gymsaas-verificacion', 'hub.challenge': '12345' })
      .expect(200);

    expect(respuesta.text).toBe('12345');
  });

  it('rechaza el handshake con un token equivocado', async () => {
    await peticion(app)
      .get('/api/webhooks/whatsapp')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'otro', 'hub.challenge': '12345' })
      .expect(403);
  });

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

    await enviarWebhook(evento(), 'sha256=firmafalsa').expect(401);

    const guardados = await ejecutarConTenant(tenant._id, () =>
      obtenerModelo('MensajeWhatsapp').countDocuments(),
    );
    expect(guardados).toBe(0);
  });

  it('es idempotente: el mismo mensaje dos veces se guarda una sola vez', async () => {
    const { tenant } = await montar();

    await enviarWebhook(evento()).expect(200);
    await enviarWebhook(evento()).expect(200); // Meta reintenta

    const guardados = await ejecutarConTenant(tenant._id, () =>
      obtenerModelo('MensajeWhatsapp').countDocuments(),
    );
    expect(guardados).toBe(1);
  });

  it('un numero que no es de ningun gimnasio se ignora sin romper', async () => {
    await montar();
    const ajeno = evento();
    ajeno.entry[0].changes[0].value.metadata.phone_number_id = '999999';

    await enviarWebhook(ajeno).expect(200);
  });
});

describe('Bandeja de mensajes', () => {
  it('la bandeja es SOLO del dueño: un sede_admin recibe 403', async () => {
    await montar();
    await enviarWebhook(evento()).expect(200); // Ana, sede norte
    await enviarWebhook(evento({ telefono: '573002220002', wamid: 'wamid.BBB' })).expect(200); // Beto, sur

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
    await enviarWebhook(evento({ telefono: '573002220002', wamid: 'wamid.BBB' })).expect(200); // Beto, sur

    const dueno = await entrarComo('owner@gymmsg.co');

    // Sin filtro ve los dos, y cada mensaje trae el nombre de su sede.
    const todos = await dueno.get('/api/mensajes').expect(200);
    expect(todos.body.data.mensajes).toHaveLength(2);
    const deAna = todos.body.data.mensajes.find((m) => m.telefono === TEL_ANA);
    expect(deAna.sede.nombre).toBe('Norte');

    // Filtrando por la sede Sur solo queda el hilo de Beto.
    const soloSur = await dueno.get('/api/mensajes').query({ sede: String(sedes.sur._id) }).expect(200);
    expect(soloSur.body.data.mensajes).toHaveLength(1);
    expect(soloSur.body.data.mensajes[0].telefono).toBe('573002220002');
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

  it('borra la imagen vieja y suelta la referencia; conserva el mensaje y el reciente', async () => {
    const { tenant } = await montar();

    const raiz = path.resolve(entorno.ALMACEN_ARCHIVOS, 'whatsapp');
    carpetaComprobantes = path.join(raiz, String(tenant._id));
    await mkdir(carpetaComprobantes, { recursive: true });

    const relVieja = `${tenant._id}/viejo.jpeg`;
    const relNueva = `${tenant._id}/nuevo.jpeg`;
    const absVieja = path.resolve(raiz, relVieja);
    const absNueva = path.resolve(raiz, relNueva);
    await writeFile(absVieja, 'imagen-vieja');
    await writeFile(absNueva, 'imagen-nueva');

    const ids = await ejecutarConTenant(tenant._id, async () => {
      const Mensaje = obtenerModelo('MensajeWhatsapp');
      const viejo = await Mensaje.create({
        telefono: TEL_ANA, direccion: 'entrante', tipo: 'imagen',
        archivo: relVieja, mimeType: 'image/jpeg', idMensajeWhatsapp: 'wamid.viejo',
      });
      const nuevo = await Mensaje.create({
        telefono: TEL_ANA, direccion: 'entrante', tipo: 'imagen',
        archivo: relNueva, mimeType: 'image/jpeg', idMensajeWhatsapp: 'wamid.nuevo',
      });
      await envejecer(Mensaje, viejo._id, 3); // 3 meses: mas que la retencion (2)
      return { viejo: viejo._id, nuevo: nuevo._id };
    });

    const resultado = await purgarComprobantesAntiguos();
    expect(resultado.borrados).toBe(1);

    expect(existsSync(absVieja)).toBe(false); // el archivo viejo se borro
    expect(existsSync(absNueva)).toBe(true); // el reciente sigue

    const enBase = await ejecutarConTenant(tenant._id, async () => {
      const Mensaje = obtenerModelo('MensajeWhatsapp');
      return {
        viejo: await Mensaje.findById(ids.viejo),
        nuevo: await Mensaje.findById(ids.nuevo),
      };
    });
    expect(enBase.viejo).not.toBeNull(); // el mensaje se conserva
    expect(enBase.viejo.archivo).toBeNull(); // sin la referencia al archivo
    expect(enBase.nuevo.archivo).toBe(relNueva); // el reciente, intacto
  });

  it('si el archivo ya no esta en disco, igual suelta la referencia sin romper', async () => {
    const { tenant } = await montar();
    const rel = `${tenant._id}/fantasma.jpeg`; // nunca se escribe en disco

    const id = await ejecutarConTenant(tenant._id, async () => {
      const Mensaje = obtenerModelo('MensajeWhatsapp');
      const m = await Mensaje.create({
        telefono: TEL_ANA, direccion: 'entrante', tipo: 'imagen',
        archivo: rel, mimeType: 'image/jpeg', idMensajeWhatsapp: 'wamid.fantasma',
      });
      await envejecer(Mensaje, m._id, 3);
      return m._id;
    });

    const resultado = await purgarComprobantesAntiguos();
    expect(resultado.borrados).toBe(1);

    const enBase = await ejecutarConTenant(tenant._id, () =>
      obtenerModelo('MensajeWhatsapp').findById(id),
    );
    expect(enBase.archivo).toBeNull();
  });
});
