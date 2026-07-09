import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import * as servicioAuth from 'src/servicios/auth.servicio.js';

export const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  TENANT_OWNER: 'tenant_owner',
  SEDE_ADMIN: 'sede_admin',
});

/**
 * Sesion del usuario.
 *
 * Se persiste solo `usuario`, nunca un token: el token vive en una cookie
 * HttpOnly que JavaScript no puede leer. Lo persistido es una copia optimista
 * para pintar el panel sin parpadeo; la verdad la tiene el backend, y cualquier
 * 401 la corrige (ver el interceptor en `boot/axios.js`).
 */
export const useAutenticacionStore = defineStore(
  'autenticacion',
  () => {
    const usuario = ref(null);

    /** `true` una vez que se comprobo la sesion contra el backend en esta carga. */
    const sesionVerificada = ref(false);

    const estaAutenticado = computed(() => usuario.value !== null);
    const esSuperAdmin = computed(() => usuario.value?.rol === ROLES.SUPER_ADMIN);
    const debeCambiarContrasena = computed(() => usuario.value?.debeCambiarContrasena === true);

    function limpiarSesion() {
      usuario.value = null;
      sesionVerificada.value = true;
    }

    async function iniciarSesion(credenciales) {
      usuario.value = await servicioAuth.iniciarSesion(credenciales);
      sesionVerificada.value = true;
      return usuario.value;
    }

    async function cerrarSesion() {
      try {
        await servicioAuth.cerrarSesion();
      } finally {
        // Aunque el backend falle, localmente la sesion se cierra igual.
        limpiarSesion();
      }
    }

    /**
     * Pregunta al backend quien es el usuario de la cookie. Es la unica forma de
     * saber si una sesion persistida sigue viva tras recargar la pagina.
     */
    async function verificarSesion() {
      if (sesionVerificada.value) return usuario.value;

      try {
        usuario.value = await servicioAuth.obtenerSesion();
      } catch {
        usuario.value = null;
      } finally {
        sesionVerificada.value = true;
      }

      return usuario.value;
    }

    async function cambiarContrasena(datos) {
      usuario.value = await servicioAuth.cambiarContrasena(datos);
      return usuario.value;
    }

    return {
      usuario,
      sesionVerificada,
      estaAutenticado,
      esSuperAdmin,
      debeCambiarContrasena,
      iniciarSesion,
      cerrarSesion,
      verificarSesion,
      cambiarContrasena,
      limpiarSesion,
    };
  },
  {
    // `sesionVerificada` NO se persiste: cada carga de pagina debe revalidar
    // contra el backend, porque la cookie pudo expirar mientras tanto.
    persist: { pick: ['usuario'] },
  },
);
