import { api } from 'boot/axios';

/** Facturacion de plataforma: lo que el gimnasio le paga a GymSaaS. */

export async function misFacturas() {
  const { data: respuesta } = await api.get('/facturacion');
  return respuesta.data;
}

/** Devuelve la URL del checkout de Wompi, ya firmada por el backend. */
export async function obtenerEnlaceDePago(facturaId) {
  const { data: respuesta } = await api.post(`/facturacion/${facturaId}/enlace-pago`);
  return respuesta.data.url;
}
