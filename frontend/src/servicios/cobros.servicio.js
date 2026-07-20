import { api } from 'boot/axios';

/**
 * Configuracion del cobro en linea a miembros (llaves Wompi del dueno). El
 * backend nunca devuelve los secretos: solo si estan puestos y la llave publica.
 */

export async function obtenerConfig() {
  const { data: respuesta } = await api.get('/cobros');
  return respuesta.data;
}

export async function guardarConfig(datos) {
  const { data: respuesta } = await api.put('/cobros', datos);
  return respuesta.data;
}
