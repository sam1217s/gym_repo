import { ROLES } from '../config/constantes.js';
import { obtenerContexto } from '../contexto/contextoTenant.js';
import { obtenerModelo } from '../modelos/indice.js';
import { aE164 } from '../proveedores/twilio.proveedor.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';
import { cifrarContrasena } from '../utilidades/contrasena.js';
import { exigirSede } from './sedes.servicio.js';

/**
 * Usuarios del gimnasio (staff). OJO: `Usuario` NO lleva el plugin de
 * aislamiento (el login necesita buscar sin filtro), asi que ESTE servicio es
 * responsable de filtrar por tenant A MANO en cada consulta. Es la unica
 * coleccion donde el aislamiento depende de la disciplina del codigo.
 *
 * Un `tenant_owner` solo administra `sede_admin`: no puede crear otros duenos
 * ni tocarse a si mismo desde aqui (para eso esta /auth/cambiar-contrasena).
 */

const CODIGO_DUPLICADO_MONGO = 11000;

function tenantActual() {
  const tenantId = obtenerContexto()?.tenantId;
  if (!tenantId) throw new Error('usuarios.servicio requiere contexto de tenant');
  return tenantId;
}

export function listarUsuarios() {
  const Usuario = obtenerModelo('Usuario');
  return Usuario.find({ tenant: tenantActual() }).sort({ createdAt: 1 });
}

export async function crearUsuario(datos) {
  const Usuario = obtenerModelo('Usuario');

  // La sede tiene que existir en ESTE gimnasio (el plugin filtra la busqueda).
  await exigirSede(datos.sede);

  try {
    return await Usuario.create({
      tenant: tenantActual(),
      nombres: datos.nombres,
      apellidos: datos.apellidos,
      email: datos.email,
      // Opcional: si no vino, se deja sin definir para que el indice parcial no la cuente.
      cedula: datos.cedula,
      // Telefono normalizado a +E164 para que coincida con la busqueda del login OTP.
      telefono: datos.telefono ? aE164(datos.telefono) : undefined,
      contrasenaHash: await cifrarContrasena(datos.contrasenaInicial),
      rol: ROLES.SEDE_ADMIN,
      sede: datos.sede,
      // La clave inicial la puso el dueno: el nuevo admin debe cambiarla al entrar.
      debeCambiarContrasena: true,
    });
  } catch (error) {
    if (error.code === CODIGO_DUPLICADO_MONGO) {
      throw ErrorApi.conflicto(`Ya existe un usuario con ${campoDuplicado(error)} en este gimnasio`);
    }
    throw error;
  }
}

/** Traduce el indice unico que choco (11000) al campo legible para el mensaje. */
function campoDuplicado(error) {
  if (error.keyPattern?.cedula) return 'la cedula';
  if (error.keyPattern?.telefono) return 'el telefono';
  return 'el correo';
}

export async function actualizarUsuario(id, datos) {
  const Usuario = obtenerModelo('Usuario');

  // Filtro por tenant Y por rol: el dueno solo administra sede_admin.
  const usuario = await Usuario.findOne({
    _id: id,
    tenant: tenantActual(),
    rol: ROLES.SEDE_ADMIN,
  });

  if (!usuario) throw ErrorApi.noEncontrado('El usuario no existe o no es administrable');

  if (datos.sede) await exigirSede(datos.sede);

  // El telefono se normaliza a +E164 (igual que al crear) antes de asignarlo.
  if (datos.telefono) datos.telefono = aE164(datos.telefono);

  Object.assign(usuario, datos);

  // Desactivar a alguien tambien lo saca de la sesion que tenga abierta.
  if (datos.activo === false) usuario.versionToken += 1;

  try {
    return await usuario.save();
  } catch (error) {
    if (error.code === CODIGO_DUPLICADO_MONGO) {
      throw ErrorApi.conflicto(`Ya existe un usuario con ${campoDuplicado(error)} en este gimnasio`);
    }
    throw error;
  }
}

/**
 * Cualquier miembro del staff fija SU propio telefono (para poder entrar por
 * OTP). No pasa por el CRUD del dueno: es self-service, asi que el dueno tambien
 * puede ponerse el suyo. `Usuario` no es tenant-scoped; el doc ya trae su tenant.
 */
export async function actualizarMiTelefono(usuarioId, telefono) {
  const Usuario = obtenerModelo('Usuario');
  const usuario = await Usuario.findById(usuarioId);
  if (!usuario) throw ErrorApi.noAutenticado();

  usuario.telefono = aE164(telefono);

  try {
    await usuario.save();
  } catch (error) {
    if (error.code === CODIGO_DUPLICADO_MONGO) {
      throw ErrorApi.conflicto('Ese telefono ya esta en uso por otro usuario');
    }
    throw error;
  }

  return usuario;
}

/**
 * El dueno restablece la contrasena de un integrante del equipo. Por defecto la
 * nueva clave es su NUMERO DE CEDULA registrado (un valor que el dueno conoce y
 * le puede dictar); si el integrante no tiene cedula, el dueno debe dar una
 * contrasena a mano. En ambos casos:
 *   - se marca `debeCambiarContrasena`: al entrar se le exige cambiarla (la
 *     cedula es un default conocido, no una clave definitiva);
 *   - se sube `versionToken`: se cierra cualquier sesion que tuviera abierta.
 *
 * Mismo candado que editar: solo `sede_admin` de ESTE gimnasio.
 */
export async function restablecerContrasena(id, { contrasena } = {}) {
  const Usuario = obtenerModelo('Usuario');

  const usuario = await Usuario.findOne({
    _id: id,
    tenant: tenantActual(),
    rol: ROLES.SEDE_ADMIN,
  });

  if (!usuario) throw ErrorApi.noEncontrado('El usuario no existe o no es administrable');

  const nueva = contrasena ?? usuario.cedula;
  if (!nueva) {
    throw ErrorApi.solicitudInvalida(
      'Este integrante no tiene cedula registrada. Editalo para agregarla o define una contrasena.',
    );
  }

  usuario.contrasenaHash = await cifrarContrasena(nueva);
  usuario.debeCambiarContrasena = true;
  usuario.versionToken += 1;
  await usuario.save();

  // NUNCA se devuelve la clave; solo si se uso la cedula, para el mensaje al dueno.
  return { id: usuario._id, usoCedula: contrasena == null };
}

/**
 * Elimina a un integrante del equipo. Mismo candado que editar: solo
 * `sede_admin` de ESTE gimnasio (el dueno no puede borrarse a si mismo ni a
 * otro dueno). Es un borrado real; el historial (pagos, auditoria) guarda el
 * nombre como foto, asi que no se rompe al desaparecer el usuario.
 */
export async function eliminarUsuario(id) {
  const Usuario = obtenerModelo('Usuario');

  const usuario = await Usuario.findOne({
    _id: id,
    tenant: tenantActual(),
    rol: ROLES.SEDE_ADMIN,
  });

  if (!usuario) throw ErrorApi.noEncontrado('El usuario no existe o no es administrable');

  await usuario.deleteOne();
  return { id };
}
