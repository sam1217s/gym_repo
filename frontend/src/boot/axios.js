import { defineBoot } from '#q-app/wrappers';
import axios from 'axios';

/**
 * Cliente HTTP de la app.
 *
 * `withCredentials: true` es obligatorio: el token de sesion viaja en cookies
 * HttpOnly, y sin esto el navegador no las adjunta. En desarrollo el proxy del
 * dev-server manda `/api` al backend, asi que todo es same-origin.
 */
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 15_000,
});

/** Rutas donde un 401 es una respuesta legitima y no debe disparar el refresco. */
const RUTAS_SIN_REFRESCO = ['/auth/iniciar-sesion', '/auth/refrescar', '/auth/cerrar-sesion'];
// Pantallas publicas: un 401 estando en ellas no redirige a ningun sitio.
const RUTAS_PUBLICAS_401 = ['inicio', 'iniciar-sesion'];

/**
 * Refresco compartido: si varias peticiones reciben 401 a la vez, todas esperan
 * al mismo `POST /auth/refrescar` en lugar de dispararlo una vez por peticion.
 */
let refrescoEnCurso = null;

function refrescarSesion() {
  // El refresco es fontaneria interna: si el tambien da 401, la decision de
  // redirigir es del interceptor de la peticion ORIGINAL, no de este POST. Sin
  // `omitirRedireccion401`, el 401 del refresco redirige a login por su cuenta
  // y expulsa de cualquier pagina publica que no sea el propio login (registrar,
  // verificar-email), donde el guard solo estaba comprobando la sesion de fondo.
  refrescoEnCurso ??= api
    .post('/auth/refrescar', null, { omitirRedireccion401: true })
    .finally(() => {
      refrescoEnCurso = null;
    });

  return refrescoEnCurso;
}

export default defineBoot(({ app, router }) => {
  app.config.globalProperties.$api = api;

  api.interceptors.response.use(
    (respuesta) => respuesta,
    async (error) => {
      const peticionOriginal = error.config;
      const esNoAutenticado = error.response?.status === 401;
      const puedeRefrescar =
        esNoAutenticado &&
        peticionOriginal &&
        !peticionOriginal.yaReintentada &&
        !RUTAS_SIN_REFRESCO.includes(peticionOriginal.url);

      // Por que se cayo la sesion. `sesion_reemplazada` = alguien inicio sesion con
      // esta cuenta en otro dispositivo (una sola sesion por cuenta).
      let codigoSesion = error.response?.data?.error?.codigo ?? null;

      if (puedeRefrescar) {
        try {
          await refrescarSesion();
          peticionOriginal.yaReintentada = true;
          return await api.request(peticionOriginal);
        } catch (errorRefresco) {
          // El refresco tambien fallo: la sesion esta muerta de verdad.
          codigoSesion = codigoSesion ?? errorRefresco.response?.data?.error?.codigo ?? null;
        }
      }

      if (esNoAutenticado) {
        // Import diferido para no crear un ciclo entre el store y este boot file.
        const { useAutenticacionStore } = await import('src/stores/autenticacion.js');
        useAutenticacionStore().limpiarSesion();

        /**
         * `omitirRedireccion401` lo pone quien ya esta gestionando la navegacion,
         * como el guard del router al comprobar la sesion al arrancar. Sin esto,
         * el interceptor abortaria la navegacion en curso con un push simultaneo.
         */
        const debeRedirigir =
          !peticionOriginal?.omitirRedireccion401 &&
          !RUTAS_PUBLICAS_401.includes(router.currentRoute.value.name);

        // Si otra persona entro con esta cuenta, se lleva al login CON el aviso:
        // salir en silencio no explica nada. Si solo expiro, de vuelta a la portada.
        // Ambos respetan `debeRedirigir`: la comprobacion de fondo del guard al abrir
        // la portada (cookie vieja de una sesion reemplazada en ese dispositivo) no
        // puede sacar al visitante de la pagina publica hacia el login.
        if (codigoSesion === 'sesion_reemplazada' && debeRedirigir) {
          await router.push({ name: 'iniciar-sesion', query: { motivo: 'otra-sesion' } });
        } else if (debeRedirigir) {
          await router.push({ name: 'inicio' });
        }
      }

      return Promise.reject(error);
    },
  );
});
