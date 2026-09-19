import { COOKIE_ACCESO } from '../config/constantes.js';
import { obtenerModelo } from '../modelos/indice.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';
import { manejadorAsync } from '../utilidades/manejadorAsync.js';
import { verificarTokenAcceso } from '../utilidades/token.js';

/**
 * Verifica la cookie de acceso y deja el usuario en `peticion.usuario`.
 *
 * Consulta la base de datos en cada peticion (dos lecturas: Usuario y Tenant).
 * Es deliberado: sin eso, desactivar un usuario o suspender un gimnasio no
 * tendria efecto hasta que expirara su token de acceso. Ambas colecciones son
 * de nivel plataforma, asi que se consultan sin contexto de tenant.
 */
export const autenticar = manejadorAsync(async (peticion, _respuesta, siguiente) => {
  const token = peticion.cookies?.[COOKIE_ACCESO];
  if (!token) throw ErrorApi.noAutenticado();

  let carga;
  try {
    carga = verificarTokenAcceso(token);
  } catch {
    throw ErrorApi.noAutenticado('Sesion expirada o token invalido');
  }

  const Usuario = obtenerModelo('Usuario');
  const usuario = await Usuario.findById(carga.sub);

  if (!usuario || !usuario.activo) throw ErrorApi.noAutenticado('Usuario inexistente o inactivo');

  // Cerrar sesion o cambiar la contrasena incrementa `versionToken`, lo que
  // invalida de inmediato cualquier token emitido antes.
  if (usuario.versionToken !== carga.version) {
    throw ErrorApi.noAutenticado('Sesion revocada, vuelve a iniciar sesion');
  }

  peticion.tenant = await exigirTenant(usuario.tenant);

  peticion.usuario = usuario;
  return siguiente();
});

/** El gimnasio al que pertenece el usuario. Se deja en `peticion.tenant`. */
async function exigirTenant(tenantId) {
  if (!tenantId) throw ErrorApi.prohibido('El usuario no pertenece a ningun gimnasio');

  const Tenant = obtenerModelo('Tenant');
  const tenant = await Tenant.findById(tenantId);

  if (!tenant) throw ErrorApi.prohibido('El gimnasio ya no existe');
  return tenant;
}
