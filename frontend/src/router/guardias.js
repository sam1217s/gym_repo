import { useAutenticacionStore } from 'src/stores/autenticacion.js';

/**
 * Guard de sesion y de rol.
 *
 * Es una comodidad de la interfaz, no una medida de seguridad: quien decide de
 * verdad es el backend, que valida la cookie en cada peticion. Aqui solo se
 * evita mostrar pantallas que igualmente devolverian 401 o 403.
 */
export function registrarGuardias(enrutador, pinia) {
  enrutador.beforeEach(async (destino) => {
    const autenticacion = useAutenticacionStore(pinia);

    // Al recargar la pagina el store viene de `localStorage`, pero la cookie pudo
    // haber expirado. Se comprueba una vez por carga contra el backend.
    if (!autenticacion.sesionVerificada) {
      await autenticacion.verificarSesion();
    }

    if (destino.meta.publica) {
      // Quien ya tiene sesion no necesita ver la pantalla de login.
      if (destino.name === 'iniciar-sesion' && autenticacion.estaAutenticado) {
        return { name: 'panel' };
      }
      return true;
    }

    if (!autenticacion.estaAutenticado) {
      return { name: 'iniciar-sesion', query: { redirigir: destino.fullPath } };
    }

    // Contrasena inicial pendiente: no se puede ir a ningun otro sitio.
    if (autenticacion.debeCambiarContrasena && destino.name !== 'cambiar-contrasena') {
      return { name: 'cambiar-contrasena' };
    }

    const rolesPermitidos = destino.meta.roles;
    if (rolesPermitidos && !rolesPermitidos.includes(autenticacion.usuario.rol)) {
      return { name: 'panel' };
    }

    return true;
  });
}
