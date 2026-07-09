import { api } from 'boot/axios';

/**
 * Capa de acceso a la API de plataforma (solo la usa el super_admin).
 * Todas las respuestas del backend tienen la forma `{ ok, data, error }`;
 * estas funciones devuelven ya solo `data`.
 */

export async function listarGimnasios(filtros = {}) {
  const { data: respuesta } = await api.get('/plataforma/tenants', { params: filtros });
  return respuesta.data;
}

export async function crearGimnasio(datos) {
  const { data: respuesta } = await api.post('/plataforma/tenants', datos);
  return respuesta.data;
}

export async function suspenderGimnasio(id) {
  const { data: respuesta } = await api.patch(`/plataforma/tenants/${id}/suspender`);
  return respuesta.data;
}

export async function reactivarGimnasio(id) {
  const { data: respuesta } = await api.patch(`/plataforma/tenants/${id}/reactivar`);
  return respuesta.data;
}

export async function cancelarGimnasio(id) {
  const { data: respuesta } = await api.patch(`/plataforma/tenants/${id}/cancelar`);
  return respuesta.data;
}

export async function listarPlanes() {
  const { data: respuesta } = await api.get('/plataforma/planes');
  return respuesta.data;
}
