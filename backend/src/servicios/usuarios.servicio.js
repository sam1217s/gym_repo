import { ROLES } from '../config/constantes.js';
import { obtenerContexto } from '../contexto/contextoTenant.js';
import { obtenerModelo } from '../modelos/indice.js';
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
      contrasenaHash: await cifrarContrasena(datos.contrasenaInicial),
      rol: ROLES.SEDE_ADMIN,
      sede: datos.sede,
      // La clave inicial la puso el dueno: el nuevo admin debe cambiarla al entrar.
      debeCambiarContrasena: true,
    });
  } catch (error) {
    if (error.code === CODIGO_DUPLICADO_MONGO) {
      // El indice que choco dice si fue el correo o la cedula.
      const campo = error.keyPattern?.cedula ? 'la cedula' : 'el correo';
      throw ErrorApi.conflicto(`Ya existe un usuario con ${campo} en este gimnasio`);
    }
    throw error;
  }
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

  Object.assign(usuario, datos);

  // Desactivar a alguien tambien lo saca de la sesion que tenga abierta.
  if (datos.activo === false) usuario.versionToken += 1;

  return usuario.save();
}
