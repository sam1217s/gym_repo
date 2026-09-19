import crypto from 'node:crypto';
import { rm } from 'node:fs/promises';
import path from 'node:path';

import {
  borrarComprobante,
  subirComprobante,
  urlFirmada,
} from '../almacenamiento/cloudinary.js';
import { MESES_RETENCION_COMPROBANTE } from '../config/constantes.js';
import { entorno } from '../config/entorno.js';
import { ejecutarConTenant, ejecutarSinTenant } from '../contexto/contextoTenant.js';
import { obtenerModelo } from '../modelos/indice.js';
import { aE164, autorizacionBasica, aWhatsapp } from '../proveedores/twilio.proveedor.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';

/**
 * Bandeja de WhatsApp: los mensajes que mandan los miembros (sobre todo
 * comprobantes de pago) y las respuestas del gimnasio.
 *
 * Existe porque un numero conectado a la API de WhatsApp no tiene bandeja: sin
 * esto, el comprobante llega al proveedor y no lo ve nadie.
 *
 * COMO SE AUTENTICA EL WEBHOOK (mismo patron que el webhook de Wompi de los
 * miembros): Twilio manda TODOS los mensajes de TODOS los gimnasios a una sola
 * URL. Se lee el numero destino (`To`) -dato no confiable- solo para saber DE
 * QUE GIMNASIO es y con que Auth Token verificar; la firma `X-Twilio-Signature`
 * es la que autentica. Sin Auth Token configurado no se acepta nada: aceptar
 * mensajes sin verificar permitiria inyectar comprobantes falsos.
 *
 * Los comprobantes se guardan en CLOUDINARY (tipo `authenticated`, no publicos).
 */

const TIEMPO_LIMITE_MS = 15_000;
/** Tope del comprobante que se baja de Twilio: evita que un archivo enorme llene todo. */
const MAX_TAMANO_MEDIA = 20 * 1024 * 1024; // 20 MB

/** MIME de Twilio -> tipo nuestro. Lo que no reconocemos entra como "otro". */
function mapearTipo(mime = '') {
  if (mime.startsWith('image/')) return 'imagen';
  if (mime === 'application/pdf') return 'documento';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return 'otro';
}

// --- Webhook -----------------------------------------------------------------

/**
 * Verifica la firma `X-Twilio-Signature`: base64(HMAC-SHA1(authToken, URL +
 * params ordenados por clave y concatenados key+value)). La URL debe ser
 * EXACTAMENTE la que Twilio invoco (la que quedo configurada en la consola).
 */
export function firmaValidaTwilio(urlPublica, params, firma, authToken) {
  if (!firma || !authToken) return false;

  const datos =
    urlPublica +
    Object.keys(params)
      .sort()
      .map((clave) => clave + params[clave])
      .join('');

  const esperada = crypto.createHmac('sha1', authToken).update(Buffer.from(datos, 'utf-8')).digest('base64');

  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  // Longitudes distintas rompen timingSafeEqual: se comprueba antes.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** El unico gimnasio. Siendo software a la medida, hay exactamente un Tenant. */
async function tenantDelGimnasio() {
  const Tenant = obtenerModelo('Tenant');
  return ejecutarSinTenant(() => Tenant.findOne());
}

/** Credenciales de Twilio (del entorno) para descargar media y verificar la firma. */
function credencialesTwilio() {
  return { accountSid: entorno.TWILIO_ACCOUNT_SID, authToken: entorno.TWILIO_AUTH_TOKEN };
}

/** Descarga un archivo de Twilio (requiere Basic Auth) y lo devuelve como buffer. */
async function descargarMedia(url, credenciales) {
  const respuesta = await fetch(url, {
    headers: { Authorization: autorizacionBasica(credenciales) },
    signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
  });
  if (!respuesta.ok) throw new Error(`Twilio respondio ${respuesta.status} al descargar el archivo`);

  const tamano = Number(respuesta.headers.get('content-length'));
  if (tamano > MAX_TAMANO_MEDIA) throw new Error(`El archivo pesa ${tamano} bytes, supera el limite`);

  const buffer = Buffer.from(await respuesta.arrayBuffer());
  if (buffer.length > MAX_TAMANO_MEDIA) throw new Error('El archivo supera el limite de tamano');

  const mimeType = respuesta.headers.get('content-type')?.split(';')[0] ?? null;
  return { buffer, mimeType };
}

/**
 * Procesa un evento entrante de Twilio (un mensaje por webhook). Devuelve cuantos
 * mensajes se guardaron.
 *
 * NUNCA lanza hacia Twilio por un comprobante que no se pueda descargar: se
 * guarda igual el mensaje (sin archivo) y se sigue. A Twilio se le responde 200
 * o reintenta en bucle. La descarga y la subida se inyectan para poder probar
 * sin tocar la red.
 */
export async function procesarEventoEntrante(
  { params = {}, urlPublica, firma },
  {
    subir = subirComprobante,
    descargar = descargarMedia,
    authToken = entorno.TWILIO_AUTH_TOKEN,
    numero = entorno.TWILIO_NUMERO,
    accountSid = entorno.TWILIO_ACCOUNT_SID,
  } = {},
) {
  const destino = params.To ? aE164(params.To) : null;
  const origen = params.From;

  if (!destino || !origen) return { guardados: 0, motivo: 'sin mensaje' };

  if (!authToken) return { guardados: 0, motivo: 'canal sin configurar' };
  const credenciales = { accountSid, authToken };

  // El numero destino debe ser el del gimnasio (defensa; la firma es lo que autentica).
  if (numero && aE164(numero) !== destino) {
    return { guardados: 0, motivo: 'numero desconocido' };
  }
  if (!firmaValidaTwilio(urlPublica, params, firma, credenciales.authToken)) {
    throw ErrorApi.noAutenticado('Firma invalida');
  }

  const tenant = await tenantDelGimnasio();
  if (!tenant) return { guardados: 0, motivo: 'sin gimnasio' };

  // El telefono se guarda en internacional sin '+' ("573001234567"), como el resto.
  const telefono = aE164(origen).replace(/^\+/, '');
  const numMedia = Number(params.NumMedia ?? 0);

  let guardados = 0;

  await ejecutarConTenant(tenant._id, async () => {
    const Mensaje = obtenerModelo('MensajeWhatsapp');
    const Miembro = obtenerModelo('Miembro');

    // Se ata al miembro por telefono; si no existe, queda suelto (lo ve el dueño).
    const miembro = await Miembro.findOne({ telefono });

    // Twilio manda cada archivo en MediaUrl{i}; para un comprobante casi siempre
    // es uno. Se guarda el primero en este mensaje.
    const mediaUrl = numMedia > 0 ? params.MediaUrl0 : null;
    const mediaMime = params.MediaContentType0 ?? null;

    let archivoPublicId = null;
    let archivoTipoRecurso = null;
    let mimeType = mediaMime;

    if (mediaUrl) {
      try {
        const { buffer, mimeType: mimeDescarga } = await descargar(mediaUrl, credenciales);
        const subido = await subir(buffer, {
          tenantId: tenant._id,
          publicId: params.MessageSid,
        });
        archivoPublicId = subido.publicId;
        archivoTipoRecurso = subido.tipoRecurso;
        mimeType = mimeDescarga ?? mediaMime;
      } catch (error) {
        // El mensaje se guarda igual: mejor un comprobante sin imagen que perderlo.
        console.error('[whatsapp] no se pudo guardar el archivo:', error.message);
      }
    }

    try {
      await Mensaje.create({
        sede: miembro?.sede ?? null,
        miembro: miembro?._id ?? null,
        telefono,
        direccion: 'entrante',
        tipo: mediaUrl ? mapearTipo(mimeType ?? '') : 'texto',
        texto: params.Body ?? '',
        mediaId: params.MediaSid0 ?? null,
        archivoPublicId,
        archivoTipoRecurso,
        mimeType,
        idMensajeWhatsapp: params.MessageSid ?? null,
        leido: false,
      });
      guardados += 1;
    } catch (error) {
      // Indice unico: Twilio reintento el mismo mensaje. No es un error.
      if (error.code !== 11000) throw error;
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
 * Responde por WhatsApp. Es texto LIBRE, que WhatsApp solo acepta dentro de las
 * 24h desde el ultimo mensaje del cliente; por eso responder no cuesta nada, y
 * por eso la respuesta se ofrece desde la bandeja y no como algo suelto.
 */
export async function responder({ mensaje: idMensaje, texto }, filtroSede = {}, usuarioId = null) {
  const Mensaje = obtenerModelo('MensajeWhatsapp');

  const original = await Mensaje.findOne({ _id: idMensaje, ...filtroSede });
  if (!original) throw ErrorApi.noEncontrado('El mensaje no existe');

  const { accountSid, authToken } = credencialesTwilio();
  const numero = entorno.TWILIO_NUMERO;
  if (!accountSid || !authToken || !numero) {
    throw ErrorApi.solicitudInvalida('El canal de WhatsApp (Twilio) no esta configurado');
  }

  const respuesta = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: autorizacionBasica({ accountSid, authToken }),
      },
      body: new URLSearchParams({
        From: aWhatsapp(numero),
        To: aWhatsapp(original.telefono),
        Body: texto,
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

/**
 * Borra los comprobantes mas viejos que `mesesRetencion` (de Cloudinary, o del
 * disco si son heredados) y suelta la referencia en el mensaje. El registro del
 * mensaje (quien escribio, cuando, el texto) se CONSERVA: solo se va el archivo,
 * que ya cumplio su funcion. Asi la cuenta de Cloudinary no crece sin tope.
 *
 * Corre a nivel plataforma (`ejecutarSinTenant`): barre los comprobantes de
 * TODOS los gimnasios de una pasada, igual que la cobranza. La llama el cron de
 * `tareas/comprobantes.tarea.js`, y se exporta aparte para poder probarla. El
 * borrado en Cloudinary se inyecta para poder probar sin red.
 */
export async function purgarComprobantesAntiguos({
  mesesRetencion = MESES_RETENCION_COMPROBANTE,
  ahora = new Date(),
  borrar = borrarComprobante,
} = {}) {
  const Mensaje = obtenerModelo('MensajeWhatsapp');

  const limite = new Date(ahora);
  limite.setMonth(limite.getMonth() - mesesRetencion);

  return ejecutarSinTenant(async () => {
    const antiguos = await Mensaje.find({
      $or: [{ archivoPublicId: { $ne: null } }, { archivo: { $ne: null } }],
      createdAt: { $lt: limite },
    }).select('_id archivo archivoPublicId archivoTipoRecurso');

    let borrados = 0;

    for (const mensaje of antiguos) {
      try {
        if (mensaje.archivoPublicId) {
          await borrar(mensaje.archivoPublicId, { tipoRecurso: mensaje.archivoTipoRecurso });
        } else if (mensaje.archivo) {
          const absoluta = path.resolve(entorno.ALMACEN_ARCHIVOS, 'whatsapp', mensaje.archivo);
          // `force`: si el archivo ya no esta, no es un error; igual limpiamos la ref.
          await rm(absoluta, { force: true });
        }
      } catch (error) {
        // Un fallo real no debe frenar el barrido; se deja el registro como esta
        // para reintentarlo mañana.
        console.error('[comprobantes] no se pudo borrar el archivo:', error.message);
        continue;
      }

      await Mensaje.updateOne(
        { _id: mensaje._id },
        { $set: { archivo: null, archivoPublicId: null, archivoTipoRecurso: null } },
      );
      borrados += 1;
    }

    return { borrados, limite };
  });
}

/**
 * Como servir el comprobante, ya comprobado el alcance por sede:
 *  - Cloudinary: una URL firmada de corta duracion a la que redirigir.
 *  - HEREDADO (disco): la ruta absoluta del archivo para streamearlo.
 */
export async function rutaArchivo(id, filtroSede = {}) {
  const Mensaje = obtenerModelo('MensajeWhatsapp');

  const mensaje = await Mensaje.findOne({ _id: id, ...filtroSede });
  if (!mensaje) throw ErrorApi.noEncontrado('El mensaje no existe');

  if (mensaje.archivoPublicId) {
    return {
      redireccion: urlFirmada(mensaje.archivoPublicId, { tipoRecurso: mensaje.archivoTipoRecurso }),
    };
  }

  if (mensaje.archivo) {
    return {
      ruta: path.resolve(entorno.ALMACEN_ARCHIVOS, 'whatsapp', mensaje.archivo),
      mimeType: mensaje.mimeType ?? 'application/octet-stream',
    };
  }

  throw ErrorApi.noEncontrado('Ese mensaje no tiene archivo');
}
