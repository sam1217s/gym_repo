import { obtenerModelo } from '../modelos/indice.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';
import { cifrarContrasena, verificarContrasena } from '../utilidades/contrasena.js';
import { verificarTokenRefresco } from '../utilidades/token.js';

/**
 * Logica de negocio de autenticacion. No conoce Express: recibe datos planos y
 * devuelve el usuario o lanza un `ErrorApi`. Las cookies las pone el controlador.
 */

const MENSAJE_CREDENCIALES = 'Datos de acceso incorrectos';

/**
 * Hash valido de una cadena aleatoria que nadie conoce. Cuando el email no
 * existe se compara contra este, para que la respuesta tarde lo mismo que
 * cuando si existe: el tiempo de respuesta tambien filtra informacion.
 */
const HASH_SENUELO = '$2a$12$1mlFN/obbPRqUGEGZz9r3.xs1Sxo5ZNWm2E.UQFCreOOU5uQofayu';

export async function iniciarSesion({ identificador, contrasena, slugGimnasio }) {
  const usuario = await buscarUsuarioParaLogin(identificador, slugGimnasio);

  const esCorrecta = await verificarContrasena(contrasena, usuario?.contrasenaHash ?? HASH_SENUELO);

  if (!usuario || !esCorrecta) throw ErrorApi.noAutenticado(MENSAJE_CREDENCIALES);
  if (!usuario.activo) throw ErrorApi.prohibido('Tu usuario esta desactivado');

  const tenant = await exigirTenant(usuario.tenant);

  usuario.ultimoAcceso = new Date();
  await usuario.save();

  return { usuario, tenant };
}

/**
 * Se entra por correo O por cedula. Se distingue por el '@': un correo lo lleva,
 * una cedula (solo digitos) no. El correo se normaliza a minusculas, como se
 * guarda; la cedula se compara tal cual.
 *
 * Ambos son unicos por tenant, asi que un mismo dato puede existir en varios
 * gimnasios. Si pasa, se le pide al usuario que diga en cual entra.
 */
function filtroPorIdentificador(identificador) {
  return identificador.includes('@')
    ? { email: identificador.toLowerCase() }
    : { cedula: identificador };
}

async function buscarUsuarioParaLogin(identificador, slugGimnasio) {
  const Usuario = obtenerModelo('Usuario');
  const filtro = filtroPorIdentificador(identificador);

  if (slugGimnasio) {
    const Tenant = obtenerModelo('Tenant');
    const tenant = await Tenant.findOne({ slug: slugGimnasio });
    if (!tenant) throw ErrorApi.noAutenticado(MENSAJE_CREDENCIALES);

    return Usuario.findOne({ ...filtro, tenant: tenant._id }).select('+contrasenaHash');
  }

  const candidatos = await Usuario.find(filtro).select('+contrasenaHash').limit(2);

  if (candidatos.length > 1) {
    throw ErrorApi.solicitudInvalida(
      'Ese dato existe en varios gimnasios. Indica el identificador de tu gimnasio.',
      [{ campo: 'slugGimnasio', mensaje: 'Requerido' }],
    );
  }

  return candidatos[0] ?? null;
}

/** El gimnasio al que pertenece el usuario. */
async function exigirTenant(tenantId) {
  if (!tenantId) throw ErrorApi.prohibido('El usuario no pertenece a ningun gimnasio');

  const Tenant = obtenerModelo('Tenant');
  const tenant = await Tenant.findById(tenantId);

  if (!tenant) throw ErrorApi.prohibido('El gimnasio ya no existe');
  return tenant;
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

  const tenant = await exigirTenant(usuario.tenant);

  return { usuario, tenant };
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

/**
 * Datos del usuario en sesion que el frontend necesita para pintar el panel.
 */
export function describirSesion(usuario, tenant = null) {
  return {
    id: usuario._id,
    nombres: usuario.nombres,
    apellidos: usuario.apellidos,
    nombreCompleto: usuario.nombreCompleto,
    email: usuario.email,
    cedula: usuario.cedula ?? null,
    rol: usuario.rol,
    telefono: usuario.telefono ?? null,
    tenant: usuario.tenant,
    tenantNombre: tenant?.nombre ?? null,
    sede: usuario.sede,
    debeCambiarContrasena: usuario.debeCambiarContrasena,
  };
}
