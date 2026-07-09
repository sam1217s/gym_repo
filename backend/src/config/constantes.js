/**
 * Constantes de dominio. Ningun numero ni string magico debe aparecer suelto en
 * servicios o controladores: si tiene significado de negocio, vive aqui.
 */

export const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  TENANT_OWNER: 'tenant_owner',
  SEDE_ADMIN: 'sede_admin',
});

export const LISTA_ROLES = Object.values(ROLES);

export const ESTADOS_TENANT = Object.freeze({
  TRIAL: 'trial',
  ACTIVO: 'activo',
  SUSPENDIDO: 'suspendido',
  CANCELADO: 'cancelado',
});

export const LISTA_ESTADOS_TENANT = Object.values(ESTADOS_TENANT);

/** Unicos estados con los que un usuario de gimnasio puede iniciar sesion. */
export const ESTADOS_TENANT_OPERATIVOS = Object.freeze([
  ESTADOS_TENANT.TRIAL,
  ESTADOS_TENANT.ACTIVO,
]);

export const METODOS_PAGO = Object.freeze({
  EFECTIVO: 'efectivo',
  TRANSFERENCIA: 'transferencia',
});

export const LISTA_METODOS_PAGO = Object.values(METODOS_PAGO);

export const PROVEEDORES_WHATSAPP = Object.freeze({
  BAILEYS: 'baileys',
  CLOUD_API: 'cloud_api',
  N8N: 'n8n',
  NINGUNO: 'ninguno',
});

export const LISTA_PROVEEDORES_WHATSAPP = Object.values(PROVEEDORES_WHATSAPP);

export const CANALES_NOTIFICACION = Object.freeze({ WHATSAPP: 'whatsapp' });

export const TIPOS_NOTIFICACION = Object.freeze({
  PROXIMO_VENCIMIENTO: 'proximo_vencimiento',
});

export const ESTADOS_NOTIFICACION = Object.freeze({
  ENVIADO: 'enviado',
  FALLIDO: 'fallido',
});

/** Dias de antelacion con que se avisa a un miembro que su mensualidad vence. */
export const DIAS_AVISO_VENCIMIENTO = 3;

/** Configuracion regional del producto. */
export const MONEDA_POR_DEFECTO = 'COP';
export const ZONA_HORARIA_POR_DEFECTO = 'America/Bogota';

/** Vida util de los tokens. El de acceso es corto a proposito. */
export const DURACION_TOKEN_ACCESO = '15m';
export const DURACION_TOKEN_REFRESCO = '7d';
export const DURACION_TOKEN_REFRESCO_MS = 7 * 24 * 60 * 60 * 1000;
export const DURACION_TOKEN_ACCESO_MS = 15 * 60 * 1000;

/** Nombres de las cookies HttpOnly que transportan los tokens. */
export const COOKIE_ACCESO = 'gs_acceso';
export const COOKIE_REFRESCO = 'gs_refresco';

/** El refresh token solo viaja hacia su propio endpoint, nunca al resto de la API. */
export const RUTA_COOKIE_REFRESCO = '/api/auth/refrescar';

/** Coste de bcrypt. 12 es el equilibrio actual entre seguridad y latencia. */
export const RONDAS_BCRYPT = 12;
