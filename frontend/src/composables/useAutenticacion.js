import { useQuasar } from 'quasar';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ROLES, useAutenticacionStore } from 'src/stores/autenticacion.js';
import { useGimnasioStore } from 'src/stores/gimnasio.js';

/** El backend pide el gimnasio cuando el mismo correo o cedula existe en varios. */
const CAMPO_GIMNASIO_REQUERIDO = 'slugGimnasio';

/**
 * Envuelve el store de sesion con lo que necesita la vista: estado de carga,
 * notificaciones y navegacion. El store se queda con los datos; el ruido de la
 * interfaz se queda aqui.
 */
export function useAutenticacion() {
  const autenticacion = useAutenticacionStore();
  const gimnasio = useGimnasioStore();
  const enrutador = useRouter();
  const ruta = useRoute();
  const quasar = useQuasar();

  const cargando = ref(false);

  /** Se activa cuando el correo existe en mas de un gimnasio. */
  const exigeGimnasio = ref(false);

  const usuario = computed(() => autenticacion.usuario);
  const estaAutenticado = computed(() => autenticacion.estaAutenticado);

  function extraerMensaje(error, respaldo) {
    return error.response?.data?.error?.mensaje ?? respaldo;
  }

  /** Cuenta los reportes de maquina sin leer y, si hay, lanza el aviso. */
  async function hayReportesPendientes() {
    try {
      const total = await gimnasio.contarReportesNoLeidos();
      if (total > 0) {
        quasar.notify({
          type: 'warning',
          icon: 'report_problem',
          position: 'top',
          timeout: 6000,
          message: `Tienes ${total} ${total === 1 ? 'maquina reportada' : 'maquinas reportadas'} para revisar`,
        });
        return true;
      }
    } catch {
      // Un fallo aqui no debe impedir entrar: se sigue al panel normal.
    }
    return false;
  }

  async function iniciarSesion(credenciales) {
    cargando.value = true;
    try {
      const sesion = await autenticacion.iniciarSesion(credenciales);

      if (sesion.debeCambiarContrasena) {
        await enrutador.push({ name: 'cambiar-contrasena' });
        return sesion;
      }

      // Dueño con maquinas reportadas SIN LEER: se le avisa y se le lleva directo
      // al panel de reportes. Una vez ahi se marcan leidas y no vuelve a saltar,
      // aunque el equipo siga sin arreglarse (para verlas de nuevo entra a Reportes).
      if (sesion.rol === ROLES.TENANT_OWNER && (await hayReportesPendientes())) {
        await enrutador.push({ name: 'reportes' });
        return sesion;
      }

      // `redirigir` lo pone el guard cuando alguien intenta entrar a una ruta
      // protegida sin sesion: se le devuelve a donde queria ir.
      await enrutador.push(ruta.query.redirigir ?? { name: 'panel' });
      return sesion;
    } catch (error) {
      const detalles = error.response?.data?.error?.detalles ?? [];
      exigeGimnasio.value = detalles.some((detalle) => detalle.campo === CAMPO_GIMNASIO_REQUERIDO);

      quasar.notify({
        type: 'negative',
        message: extraerMensaje(error, 'No se pudo iniciar sesion'),
      });
      return null;
    } finally {
      cargando.value = false;
    }
  }

  async function cambiarContrasena(datos) {
    cargando.value = true;
    try {
      await autenticacion.cambiarContrasena(datos);
      quasar.notify({ type: 'positive', message: 'Contrasena actualizada' });
      await enrutador.push({ name: 'panel' });
      return true;
    } catch (error) {
      quasar.notify({
        type: 'negative',
        message: extraerMensaje(error, 'No se pudo cambiar la contrasena'),
      });
      return false;
    } finally {
      cargando.value = false;
    }
  }

  async function cerrarSesion() {
    await autenticacion.cerrarSesion();
    await enrutador.push({ name: 'iniciar-sesion' });
  }

  return {
    usuario,
    estaAutenticado,
    cargando,
    exigeGimnasio,
    iniciarSesion,
    cambiarContrasena,
    cerrarSesion,
  };
}
