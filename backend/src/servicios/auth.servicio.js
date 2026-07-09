import { ROLES } from '../config/constantes.js';
import { obtenerModelo } from '../modelos/indice.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';
import { cifrarContrasena, verificarContrasena } from '../utilidades/contrasena.js';
import { verificarTokenRefresco } from '../utilidades/token.js';

/**
 * Logica de negocio de autenticacion. No conoce Express: recibe datos planos y
 * devuelve el usuario o lanza un `ErrorApi`. Las cookies las pone el controlador.
 */

const MENSAJE_CREDENCIALES = 'Email o contrasena incorrectos';

/**
 * Hash valido de una cadena aleatoria que nadie conoce. Cuando el email no
 * existe se compara contra este, para que la respuesta tarde lo mismo que
 * cuando si existe: el tiempo de respuesta tambien filtra informacion.
 */
const HASH_SENUELO = '$2a$12$1mlFN/obbPRqUGEGZz9r3.xs1Sxo5ZNWm2E.UQFCreOOU5uQofayu';

export async function iniciarSesion({ email, contrasena, slugGimnasio }) {
  const usuario = await buscarUsuarioParaLogin(email, slugGimnasio);

  const esCorrecta = await verificarContrasena(contrasena, usuario?.contrasenaHash ?? HASH_SENUELO);

  if (!usuario || !esCorrecta) throw ErrorApi.noAutenticado(MENSAJE_CREDENCIALES);
  if (!usuario.activo) throw ErrorApi.prohibido('Tu usuario esta desactivado');

  if (usuario.rol !== ROLES.SUPER_ADMIN) {
    await exigirTenantOperativo(usuario.tenant);
  }

  usuario.ultimoAcceso = new Date();
  await usuario.save();

  return usuario;
}

/**
 * El email es unico por tenant, asi que un mismo correo puede existir en varios
 * gimnasios. Si pasa, se le pide al usuario que diga en cual entra.
 */
async function buscarUsuarioParaLogin(email, slugGimnasio) {
  const Usuario = obtenerModelo('Usuario');

  if (slugGimnasio) {
    const Tenant = obtenerModelo('Tenant');
    const tenant = await Tenant.findOne({ slug: slugGimnasio });
    if (!tenant) throw ErrorApi.noAutenticado(MENSAJE_CREDENCIALES);

    return Usuario.findOne({ email, tenant: tenant._id }).select('+contrasenaHash');
  }

  const candidatos = await Usuario.find({ email }).select('+contrasenaHash').limit(2);

  if (candidatos.length > 1) {
    throw ErrorApi.solicitudInvalida(
      'Ese correo existe en varios gimnasios. Indica el identificador de tu gimnasio.',
      [{ campo: 'slugGimnasio', mensaje: 'Requerido' }],
    );
  }

  return candidatos[0] ?? null;
}

async function exigirTenantOperativo(tenantId) {
  if (!tenantId) throw ErrorApi.prohibido('El usuario no pertenece a ningun gimnasio');

  const Tenant = obtenerModelo('Tenant');
  const tenant = await Tenant.findById(tenantId);

  if (!tenant) throw ErrorApi.prohibido('El gimnasio ya no existe');
  if (!tenant.estaOperativo()) {
    throw ErrorApi.prohibido(`El gimnasio esta ${tenant.estado}. Contacta a soporte.`);
  }
}

/**
 * Canjea un refresh token por un usuario valido. Como los refresh tokens no se
 * guardan en la base de datos, la revocacion se comprueba contra `versionToken`.
 */
export async function refrescarSesion(tokenRefresco) {
  if (!tokenRefresco) throw ErrorApi.noAutenticado('No hay sesion que refrescar');

  let carga;
  try {
    carga = verificarTokenRefresco(tokenRefresco);
  } catch {
    throw ErrorApi.noAutenticado('Sesion expirada, vuelve a iniciar sesion');
  }

  const Usuario = obtenerModelo('Usuario');
  const usuario = await Usuario.findById(carga.sub);

  if (!usuario || !usuario.activo) throw ErrorApi.noAutenticado('Usuario inexistente o inactivo');
  if (usuario.versionToken !== carga.version) throw ErrorApi.noAutenticado('Sesion revocada');

  if (usuario.rol !== ROLES.SUPER_ADMIN) {
    await exigirTenantOperativo(usuario.tenant);
  }

  return usuario;
}

/** Cerrar sesion invalida TODOS los tokens del usuario, no solo el de este navegador. */
export async function cerrarSesion(usuarioId) {
  const Usuario = obtenerModelo('Usuario');
  await Usuario.updateOne({ _id: usuarioId }, { $inc: { versionToken: 1 } });
}

/**
 * Cambia la contrasena y revoca las sesiones anteriores. Devuelve el usuario ya
 * con la nueva `versionToken`, para que el controlador reemita cookies frescas y
 * quien acaba de cambiarla no se quede fuera.
 */
export async function cambiarContrasena(usuarioId, { contrasenaActual, contrasenaNueva }) {
  const Usuario = obtenerModelo('Usuario');
  const usuario = await Usuario.findById(usuarioId).select('+contrasenaHash');

  if (!usuario) throw ErrorApi.noAutenticado();

  const esCorrecta = await verificarContrasena(contrasenaActual, usuario.contrasenaHash);
  if (!esCorrecta) throw ErrorApi.solicitudInvalida('La contrasena actual no es correcta');

  usuario.contrasenaHash = await cifrarContrasena(contrasenaNueva);
  usuario.debeCambiarContrasena = false;
  usuario.versionToken += 1;
  await usuario.save();

  return usuario;
}

/** Datos del usuario en sesion que el frontend necesita para pintar el panel. */
export function describirSesion(usuario) {
  return {
    id: usuario._id,
    nombres: usuario.nombres,
    apellidos: usuario.apellidos,
    nombreCompleto: usuario.nombreCompleto,
    email: usuario.email,
    rol: usuario.rol,
    tenant: usuario.tenant,
    sede: usuario.sede,
    debeCambiarContrasena: usuario.debeCambiarContrasena,
  };
}
