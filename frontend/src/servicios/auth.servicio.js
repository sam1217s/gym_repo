import { api } from 'boot/axios';

/**
 * Capa de acceso a la API de autenticacion. Los componentes y los stores no
 * llaman a `api` directamente: llaman aqui. Asi, si cambia una ruta del backend,
 * solo se toca este archivo.
 *
 * Todas las respuestas del backend tienen la forma `{ ok, data, error }`.
 * Estas funciones devuelven ya solo `data`.
 */

export async function iniciarSesion(credenciales) {
  const { data: respuesta } = await api.post('/auth/iniciar-sesion', credenciales);
  return respuesta.data;
}

export async function cerrarSesion() {
  await api.post('/auth/cerrar-sesion');
}

/**
 * Comprueba contra el backend si la cookie de sesion sigue viva.
 *
 * `omitirRedireccion401` evita que el interceptor redirija por su cuenta: quien
 * llama a esto es el guard del router, que ya decide a donde navegar.
 */
export async function obtenerSesion() {
  const { data: respuesta } = await api.get('/auth/yo', { omitirRedireccion401: true });
  return respuesta.data;
}

export async function cambiarContrasena(datos) {
  const { data: respuesta } = await api.post('/auth/cambiar-contrasena', datos);
  return respuesta.data;
}
