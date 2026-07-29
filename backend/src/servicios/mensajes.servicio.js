import crypto from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { PROVEEDORES_WHATSAPP } from '../config/constantes.js';
import { entorno } from '../config/entorno.js';
import { ejecutarConTenant, ejecutarSinTenant } from '../contexto/contextoTenant.js';
import { obtenerModelo } from '../modelos/indice.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';

/**
 * Bandeja de WhatsApp: los mensajes que mandan los miembros (sobre todo
 * comprobantes de pago) y las respuestas del gimnasio.
 *
 * Existe porque un numero conectado a la Cloud API no tiene bandeja: sin esto,
 * el comprobante llega a Meta y no lo ve nadie.
 *
 * COMO SE AUTENTICA EL WEBHOOK (mismo patron que el webhook de Wompi de los
 * miembros): Meta manda TODOS los mensajes de TODOS los gimnasios a una sola
 * URL. Se lee el `phone_number_id` del payload -dato no confiable- solo para
 * saber DE QUE GIMNASIO es y con que secreto verificar; la firma HMAC es la que
 * autentica. Sin secreto configurado no se acepta nada: aceptar mensajes sin
 * verificar permitiria inyectar comprobantes falsos.
 */

const VERSION_GRAFO = 'v21.0';
const TIEMPO_LIMITE_MS = 15_000;

/** Tipos de Meta que sabemos guardar; el resto entra como "otro". */
const TIPOS = { text: 'texto', image: 'imagen', document: 'documento' };

// --- Webhook -----------------------------------------------------------------

/** El handshake con el que Meta da de alta la URL. */
export function verificarSuscripcion({ modo, token, desafio }) {
  if (modo === 'subscribe' && token === entorno.WHATSAPP_TOKEN_VERIFICACION) return desafio;
  throw ErrorApi.prohibido('Token de verificacion invalido');
}

/** `sha256=...` calculado sobre el cuerpo CRUDO con el secreto de la app. */
function firmaValida(cuerpoCrudo, firma, secreto) {
  if (!firma || !cuerpoCrudo) return false;

  const esperada = `sha256=${crypto.createHmac('sha256', secreto).update(cuerpoCrudo).digest('hex')}`;
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  // Longitudes distintas rompen timingSafeEqual: se comprueba antes.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Descarga el comprobante de Meta y lo deja en el almacen del gimnasio. */
async function descargarArchivo({ mediaId, token, tenantId }) {
  const cabeceras = { Authorization: `Bearer ${token}` };

  const meta = await fetch(`https://graph.facebook.com/${VERSION_GRAFO}/${mediaId}`, {
    headers: cabeceras,
    signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
  });
  if (!meta.ok) throw new Error(`Meta respondio ${meta.status} al pedir el archivo`);
  const { url, mime_type: mimeType } = await meta.json();

  const binario = await fetch(url, {
    headers: cabeceras,
    signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
  });
  if (!binario.ok) throw new Error(`Meta respondio ${binario.status} al descargar`);

  const extension = (mimeType?.split('/')[1] ?? 'bin').split(';')[0];
  const relativa = path.join(String(tenantId), `${mediaId}.${extension}`);
  const absoluta = path.resolve(entorno.ALMACEN_ARCHIVOS, 'whatsapp', relativa);

  await mkdir(path.dirname(absoluta), { recursive: true });
  await writeFile(absoluta, Buffer.from(await binario.arrayBuffer()));

  return { archivo: relativa, mimeType };
}

/** El tenant dueño del numero al que le escribieron. */
async function tenantPorNumero(idTelefono) {
  const Tenant = obtenerModelo('Tenant');
  return ejecutarSinTenant(() =>
    Tenant.findOne({ 'config.whatsapp.credenciales.idTelefono': idTelefono }),
  );
}

/**
 * Procesa un evento de Meta. Devuelve cuantos mensajes se guardaron.
 *
 * NUNCA lanza hacia Meta por un mensaje suelto que falle: si un comprobante no
 * se puede descargar, se guarda igual el mensaje (sin archivo) y se sigue. A
 * Meta hay que responderle 200 o reintenta en bucle.
 */
export async function procesarEventoEntrante({ cuerpo, cuerpoCrudo, firma }) {
  const valor = cuerpo?.entry?.[0]?.changes?.[0]?.value;
  const idTelefono = valor?.metadata?.phone_number_id;
  const mensajes = valor?.messages ?? [];

  // Los avisos de estado (entregado, leido) llegan por aqui y se ignoran.
  if (!idTelefono || mensajes.length === 0) return { guardados: 0, motivo: 'sin mensajes' };

  const tenant = await tenantPorNumero(idTelefono);
  if (!tenant) return { guardados: 0, motivo: 'numero desconocido' };

  const credenciales = tenant.config?.whatsapp?.credenciales ?? {};
  if (!credenciales.secretoApp) return { guardados: 0, motivo: 'sin secreto de app' };
  if (!firmaValida(cuerpoCrudo, firma, credenciales.secretoApp)) {
    throw ErrorApi.noAutenticado('Firma invalida');
  }

  let guardados = 0;

  await ejecutarConTenant(tenant._id, async () => {
    const Mensaje = obtenerModelo('MensajeWhatsapp');
    const Miembro = obtenerModelo('Miembro');

    for (const mensaje of mensajes) {
      const telefono = mensaje.from;
      // Se ata al miembro por telefono; si no existe, queda suelto (lo ve el dueño).
      const miembro = await Miembro.findOne({ telefono });

      const tipo = TIPOS[mensaje.type] ?? 'otro';
      const media = mensaje.image ?? mensaje.document ?? null;

      let archivo = null;
      let mimeType = media?.mime_type ?? null;
      if (media?.id) {
        try {
          const guardado = await descargarArchivo({
            mediaId: media.id,
            token: credenciales.token,
            tenantId: tenant._id,
          });
          archivo = guardado.archivo;
          mimeType = guardado.mimeType ?? mimeType;
        } catch (error) {
          // El mensaje se guarda igual: mejor un comprobante sin imagen que perderlo.
          console.error('[whatsapp] no se pudo descargar el archivo:', error.message);
        }
      }

      try {
        await Mensaje.create({
          sede: miembro?.sede ?? null,
          miembro: miembro?._id ?? null,
          telefono,
          direccion: 'entrante',
          tipo,
          texto: mensaje.text?.body ?? media?.caption ?? '',
          mediaId: media?.id ?? null,
          archivo,
          mimeType,
          idMensajeWhatsapp: mensaje.id ?? null,
          leido: false,
        });
        guardados += 1;
      } catch (error) {
        // Indice unico: Meta reintento el mismo mensaje. No es un error.
        if (error.code !== 11000) throw error;
      }
    }
  });

  return { guardados };
}

// --- Bandeja -----------------------------------------------------------------

export function listarMensajes(filtroSede = {}, { miembro, pendientes, sede } = {}) {
  const Mensaje = obtenerModelo('MensajeWhatsapp');

  const filtro = { ...filtroSede };
  if (miembro) filtro.miembro = miembro;
  // El filtro del rol gana sobre el de la query: el `?sede=` solo aplica cuando
  // el rol no acota ya la sede (el dueño), nunca para saltarse el de un sede_admin.
  if (sede && !filtroSede.sede) filtro.sede = sede;
  if (pendientes === 'true') {
    filtro.direccion = 'entrante';
    filtro.leido = false;
  }

  return Mensaje.find(filtro)
    .sort({ createdAt: -1 })
    .limit(300)
    .populate('miembro', 'nombres apellidos documento sede')
    .populate('sede', 'nombre'); // para pintar de que sede es cada hilo
}

export async function contarPendientes(filtroSede = {}) {
  const Mensaje = obtenerModelo('MensajeWhatsapp');
  return Mensaje.countDocuments({ ...filtroSede, direccion: 'entrante', leido: false });
}

export async function marcarLeidos(ids, filtroSede = {}) {
  const Mensaje = obtenerModelo('MensajeWhatsapp');
  const filtro = { ...filtroSede, direccion: 'entrante', leido: false };
  if (ids?.length) filtro._id = { $in: ids };

  const resultado = await Mensaje.updateMany(filtro, { $set: { leido: true } });
  return { marcados: resultado.modifiedCount ?? 0 };
}

/**
 * Responde por WhatsApp. Es texto LIBRE, que Meta solo acepta dentro de las 24h
 * desde el ultimo mensaje del cliente; por eso responder no cuesta nada, y por
 * eso la respuesta se ofrece desde la bandeja y no como algo suelto.
 */
export async function responder({ mensaje: idMensaje, texto }, filtroSede = {}, usuarioId = null) {
  const Mensaje = obtenerModelo('MensajeWhatsapp');
  const Tenant = obtenerModelo('Tenant');

  const original = await Mensaje.findOne({ _id: idMensaje, ...filtroSede });
  if (!original) throw ErrorApi.noEncontrado('El mensaje no existe');

  const tenant = await ejecutarSinTenant(() => Tenant.findById(original.tenant));
  const whatsapp = tenant?.config?.whatsapp ?? {};
  if (whatsapp.proveedor !== PROVEEDORES_WHATSAPP.CLOUD_API) {
    throw ErrorApi.solicitudInvalida('Este gimnasio no tiene WhatsApp Cloud API configurado');
  }

  const { idTelefono, token } = whatsapp.credenciales ?? {};
  const respuesta = await fetch(
    `https://graph.facebook.com/${VERSION_GRAFO}/${idTelefono}/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: original.telefono,
        type: 'text',
        text: { body: texto },
      }),
      signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
    },
  );

  if (!respuesta.ok) {
    // Lo mas comun: se paso la ventana de 24h. Se dice claro, no un 500 mudo.
    throw ErrorApi.solicitudInvalida(
      'WhatsApp rechazo la respuesta. Puede que hayan pasado mas de 24h desde su mensaje.',
    );
  }

  // Responder es atenderlo: el hilo deja de estar pendiente.
  await Mensaje.updateMany(
    { telefono: original.telefono, direccion: 'entrante', leido: false },
    { $set: { leido: true } },
  );

  return Mensaje.create({
    sede: original.sede,
    miembro: original.miembro,
    telefono: original.telefono,
    direccion: 'saliente',
    tipo: 'texto',
    texto,
    leido: true,
    enviadoPor: usuarioId,
  });
}

/** Ruta absoluta del comprobante, ya comprobado el alcance por sede. */
export async function rutaArchivo(id, filtroSede = {}) {
  const Mensaje = obtenerModelo('MensajeWhatsapp');

  const mensaje = await Mensaje.findOne({ _id: id, ...filtroSede });
  if (!mensaje?.archivo) throw ErrorApi.noEncontrado('Ese mensaje no tiene archivo');

  return {
    ruta: path.resolve(entorno.ALMACEN_ARCHIVOS, 'whatsapp', mensaje.archivo),
    mimeType: mensaje.mimeType ?? 'application/octet-stream',
  };
}
