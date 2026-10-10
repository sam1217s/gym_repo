import { v2 as cloudinary } from 'cloudinary';

import { entorno } from '../config/entorno.js';

/**
 * Almacen de comprobantes en Cloudinary.
 *
 * Antes los comprobantes que mandaban los miembros por WhatsApp se guardaban en
 * el disco del servidor; ahora viven en Cloudinary. Es de la PLATAFORMA (una
 * sola cuenta, en el entorno), igual que Wompi: por eso NO se elige por gimnasio.
 * Se suben como tipo `authenticated` (no publicos): solo se ven con una URL
 * firmada, y el acceso real lo sigue controlando `GET /api/mensajes/:id/archivo`
 * (sesion + filtroSede).
 *
 * Falla RUIDOSAMENTE si faltan credenciales, en cuanto se intenta usar (mismo
 * criterio que la pasarela de Wompi): no fingir que el archivo se guardo.
 */

const CARPETA_BASE = 'gymsaas/comprobantes';
const SEGUNDOS_DESCARGA_PRIVADA = 300;

function configurar() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = entorno;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error(
      'Cloudinary no esta configurado: faltan CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY o CLOUDINARY_API_SECRET',
    );
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });

  return cloudinary;
}

/**
 * Sube un comprobante (un buffer ya descargado) a la carpeta del gimnasio.
 * `publicId` es un identificador estable del mensaje (el MessageSid de Twilio),
 * para que un reintento no cree duplicados.
 *
 * Devuelve lo necesario para BORRARLO y FIRMAR su URL despues: el `public_id`
 * completo (incluye la carpeta) y el `resource_type` que eligio Cloudinary.
 */
export async function subirComprobante(buffer, { tenantId, publicId }) {
  const cl = configurar();

  return new Promise((resolver, rechazar) => {
    const flujo = cl.uploader.upload_stream(
      {
        folder: `${CARPETA_BASE}/${tenantId}`,
        public_id: publicId,
        type: 'authenticated',
        resource_type: 'auto',
        overwrite: true,
      },
      (error, resultado) => {
        if (error) return rechazar(error);
        resolver({ publicId: resultado.public_id, tipoRecurso: resultado.resource_type });
      },
    );

    flujo.end(buffer);
  });
}

/** Borra un comprobante de Cloudinary. `tipoRecurso` = el que devolvio la subida. */
export async function borrarComprobante(publicId, { tipoRecurso = 'image' } = {}) {
  const cl = configurar();
  return cl.uploader.destroy(publicId, {
    type: 'authenticated',
    resource_type: tipoRecurso,
    invalidate: true,
  });
}

/**
 * URL de DESCARGA privada (API de Cloudinary, caduca en minutos). Es la via para
 * los PDF: Cloudinary bloquea por defecto la ENTREGA de PDF ("Allow delivery of
 * PDF and ZIP files" apagado) y la URL firmada de `urlFirmada` responde 401
 * "deny or ACL failure"; la descarga privada no esta sujeta a ese bloqueo.
 * `formato` es la extension (un PDF subido con `resource_type: auto` queda como
 * `image` sin extension en el public_id).
 */
export function urlDescargaPrivada(publicId, { tipoRecurso = 'image', formato = '' } = {}) {
  const cl = configurar();
  return cl.utils.private_download_url(publicId, formato, {
    resource_type: tipoRecurso,
    type: 'authenticated',
    expires_at: Math.floor(Date.now() / 1000) + SEGUNDOS_DESCARGA_PRIVADA,
  });
}

/**
 * URL firmada de un comprobante `authenticated`. La firma impide adivinar la URL;
 * el control de acceso real lo hace el endpoint que redirige aqui.
 */
export function urlFirmada(publicId, { tipoRecurso = 'image' } = {}) {
  const cl = configurar();
  return cl.url(publicId, {
    type: 'authenticated',
    resource_type: tipoRecurso,
    sign_url: true,
    secure: true,
  });
}
