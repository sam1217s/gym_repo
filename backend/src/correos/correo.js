import nodemailer from 'nodemailer';

import { entorno, esProduccion } from '../config/entorno.js';

/**
 * Envio de correo, aislado tras una sola funcion.
 *
 * Es infraestructura, como `pasarelas/` (Wompi) o `proveedores/` (WhatsApp): el
 * resto del codigo pide `enviarCorreo(...)` y no sabe que hay nodemailer detras.
 *
 * Sin `SMTP_HOST`:
 *   - en produccion LANZA. No se finge que un correo salio cuando no hay por
 *     donde mandarlo.
 *   - en desarrollo/pruebas imprime el contenido en consola, para poder seguir
 *     el flujo (p. ej. copiar el enlace de verificacion) sin montar un servidor
 *     de correo.
 *
 * El transporte se crea una vez y se reutiliza.
 */

let transporteCache = null;

function obtenerTransporte() {
  if (!entorno.SMTP_HOST) return null;

  transporteCache ??= nodemailer.createTransport({
    host: entorno.SMTP_HOST,
    port: entorno.SMTP_PUERTO,
    // 465 es SMTPS (TLS directo); 587 y 25 negocian STARTTLS.
    secure: entorno.SMTP_PUERTO === 465,
    auth: { user: entorno.SMTP_USUARIO, pass: entorno.SMTP_CONTRASENA },
  });

  return transporteCache;
}

/**
 * @param {{ para: string, asunto: string, texto: string, html?: string }} correo
 */
export async function enviarCorreo({ para, asunto, texto, html }) {
  const transporte = obtenerTransporte();

  if (!transporte) {
    if (esProduccion) {
      throw new Error('SMTP no configurado: falta SMTP_HOST para enviar correo en produccion.');
    }

    console.log(
      `\n[correo] SMTP sin configurar; en produccion esto se enviaria.\n` +
        `  Para:   ${para}\n` +
        `  Asunto: ${asunto}\n` +
        `  ${texto.replace(/\n/g, '\n  ')}\n`,
    );
    return;
  }

  await transporte.sendMail({ from: entorno.SMTP_REMITENTE, to: para, subject: asunto, text: texto, html });
}
