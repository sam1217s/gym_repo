import { PROVEEDORES_WHATSAPP } from '../config/constantes.js';
import { proveedorDeshabilitado } from './NotificacionProvider.js';
import { crearProveedorBaileys } from './baileys.proveedor.js';
import { crearProveedorCloudApi } from './cloudApi.proveedor.js';
import { crearProveedorN8n } from './n8n.proveedor.js';

/**
 * Unico punto donde se decide QUE implementacion atiende a un gimnasio. El
 * servicio de notificaciones solo conoce el contrato `NotificacionProvider`.
 *
 * El proveedor sale de `tenant.config.whatsapp.proveedor`, nunca de una
 * variable de entorno: dos gimnasios en el mismo servidor pueden usar canales
 * distintos.
 */
const FABRICAS = {
  [PROVEEDORES_WHATSAPP.NINGUNO]: () => proveedorDeshabilitado(PROVEEDORES_WHATSAPP.NINGUNO),
  [PROVEEDORES_WHATSAPP.N8N]: crearProveedorN8n,
  [PROVEEDORES_WHATSAPP.CLOUD_API]: crearProveedorCloudApi,
  [PROVEEDORES_WHATSAPP.BAILEYS]: crearProveedorBaileys,
};

/**
 * @param {{ proveedor?: string, credenciales?: object }} configWhatsapp
 * @param {{ plantilla?: object }} [opciones] Plantilla a usar (cloud_api). Sin
 *   ella, cada fabrica usa su plantilla por defecto (la de vencimiento). Los
 *   proveedores de texto (n8n, baileys) ignoran esto y usan el `mensaje`.
 * @returns {import('./NotificacionProvider.js').NotificacionProvider}
 */
export function crearProveedor(configWhatsapp = {}, opciones = {}) {
  const nombre = configWhatsapp.proveedor ?? PROVEEDORES_WHATSAPP.NINGUNO;
  const fabrica = FABRICAS[nombre];

  if (!fabrica) throw new Error(`Proveedor de WhatsApp desconocido: "${nombre}"`);

  return fabrica(configWhatsapp.credenciales ?? {}, opciones);
}
