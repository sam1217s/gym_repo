import { ejecutarSinTenant } from '../contexto/contextoTenant.js';
import { obtenerModelo } from '../modelos/indice.js';
import { aE164 } from '../proveedores/twilio.proveedor.js';
import * as verifyPorDefecto from '../proveedores/twilioVerify.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';

/**
 * Login por telefono con codigo (OTP), alternativa a correo/cedula + contrasena.
 * Solo para el personal (`Usuario`): dueno y administradores.
 *
 * El codigo lo maneja Twilio Verify (envio, expiracion, reintentos); aqui solo
 * se decide a QUIEN se le permite y se emite la sesion. `verificador` se inyecta
 * para poder probar sin tocar la red.
 *
 * `Usuario` no es tenant-scoped, asi que se busca bajo `ejecutarSinTenant` (el
 * login ocurre antes de que exista contexto de tenant).
 */

const MENSAJE_GENERICO = 'Codigo invalido o expirado';

function usuarioActivoPorTelefono(telefonoE164) {
  const Usuario = obtenerModelo('Usuario');
  return ejecutarSinTenant(() => Usuario.findOne({ telefono: telefonoE164, activo: true }));
}

/**
 * Envia el codigo por el canal elegido, SOLO si el telefono pertenece a un
 * usuario activo. La respuesta es generica siempre: no revela si ese numero es
 * de un usuario (evita enumerar al personal y disparar SMS a discrecion).
 */
export async function enviarCodigoOtp({ telefono, canal }, { verificador = verifyPorDefecto } = {}) {
  const e164 = aE164(telefono);
  const usuario = await usuarioActivoPorTelefono(e164);

  if (usuario) {
    await verificador.iniciarVerificacion({ telefono: e164, canal });
  }

  return { enviado: true };
}

/**
 * Comprueba el codigo con Twilio Verify y, si aprueba Y el telefono es de un
 * usuario activo, devuelve `{ usuario, tenant }` para que el controlador emita
 * las cookies (mismo shape que `auth.servicio.iniciarSesion`).
 */
export async function verificarCodigoOtp({ telefono, codigo }, { verificador = verifyPorDefecto } = {}) {
  const e164 = aE164(telefono);

  const { aprobado } = await verificador.comprobarVerificacion({ telefono: e164, codigo });
  if (!aprobado) throw ErrorApi.noAutenticado(MENSAJE_GENERICO);

  const usuario = await usuarioActivoPorTelefono(e164);
  if (!usuario) throw ErrorApi.noAutenticado(MENSAJE_GENERICO);

  const tenant = await ejecutarSinTenant(() => obtenerModelo('Tenant').findById(usuario.tenant));

  // Una sola sesion por cuenta: subir `versionToken` invalida cualquier sesion
  // anterior (mismo criterio que el login por contrasena).
  usuario.versionToken += 1;
  usuario.ultimoAcceso = new Date();
  await usuario.save();

  return { usuario, tenant };
}
