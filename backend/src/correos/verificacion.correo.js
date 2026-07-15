import { enviarCorreo } from './correo.js';

/**
 * Correo que confirma el email de un dueno que registro su gimnasio por su
 * cuenta. Se separa del transporte para poder pasar un envio falso en pruebas
 * (mismo patron que la fabrica de proveedores de WhatsApp).
 *
 * @param {{ dueno, tenant, enlace: string }} datos
 */
export async function enviarCorreoVerificacion({ dueno, tenant, enlace }) {
  const asunto = `Confirma tu correo para activar ${tenant.nombre} en GymSaaS`;

  const texto =
    `Hola ${dueno.nombres},\n\n` +
    `Ya casi. Confirma este correo para activar ${tenant.nombre} y empezar tus 2 meses gratis:\n\n` +
    `${enlace}\n\n` +
    `Si no fuiste tu, ignora este mensaje.`;

  const html =
    `<p>Hola ${dueno.nombres},</p>` +
    `<p>Ya casi. Confirma este correo para activar <strong>${tenant.nombre}</strong> ` +
    `y empezar tus 2 meses gratis:</p>` +
    `<p><a href="${enlace}">Confirmar mi correo</a></p>` +
    `<p style="color:#667085;font-size:13px">Si no fuiste tu, ignora este mensaje.</p>`;

  await enviarCorreo({ para: dueno.email, asunto, texto, html });
}
