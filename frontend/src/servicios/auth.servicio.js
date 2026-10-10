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

/**
 * Comprobacion periodica mientras el panel esta abierto: si otra persona inicio
 * sesion con esta cuenta, este GET recibe el 401 y el interceptor muestra el aviso
 * aunque el usuario no este tocando nada.
 */
export async function comprobarSesion() {
  await api.get('/auth/yo');
}

export async function cambiarContrasena(datos) {
  const { data: respuesta } = await api.post('/auth/cambiar-contrasena', datos);
  return respuesta.data;
}

// --- Login por telefono con codigo (OTP) ---
// `omitirRedireccion401`: son publicos; un 401 (codigo malo) no debe disparar el
// interceptor de refresco/redireccion.

export async function enviarOtp(datos) {
  const { data: respuesta } = await api.post('/auth/otp/enviar', datos, {
    omitirRedireccion401: true,
  });
  return respuesta.data;
}

export async function verificarOtp(datos) {
  const { data: respuesta } = await api.post('/auth/otp/verificar', datos, {
    omitirRedireccion401: true,
  });
  return respuesta.data;
}

/** El usuario en sesion fija su propio telefono (para poder entrar por OTP). */
export async function actualizarMiTelefono(telefono) {
  const { data: respuesta } = await api.patch('/auth/mi-telefono', { telefono });
  return respuesta.data;
}
