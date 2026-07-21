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

/** Estados en los que el gimnasio puede OPERAR: cobrar, registrar miembros, ver reportes. */
export const ESTADOS_TENANT_OPERATIVOS = Object.freeze([
  ESTADOS_TENANT.TRIAL,
  ESTADOS_TENANT.ACTIVO,
]);

/**
 * Estados con los que un usuario puede INICIAR SESION. Un gimnasio suspendido
 * entra a proposito: si no pudiera, no podria pagar la factura que lo suspendio.
 * Dentro del panel solo alcanza Facturacion (`bloquearSiGimnasioSuspendido`).
 * Un gimnasio cancelado no entra: cancelar es terminal.
 */
export const ESTADOS_TENANT_CON_ACCESO = Object.freeze([
  ...ESTADOS_TENANT_OPERATIVOS,
  ESTADOS_TENANT.SUSPENDIDO,
]);

export const METODOS_PAGO = Object.freeze({
  EFECTIVO: 'efectivo',
  TRANSFERENCIA: 'transferencia',
  // Pago en linea del propio miembro por Wompi (al Wompi del dueno del gimnasio).
  WOMPI: 'wompi',
});

export const LISTA_METODOS_PAGO = Object.values(METODOS_PAGO);

/**
 * Prefijo de la `reference` de Wompi para un pago de MIEMBRO (al gimnasio),
 * para distinguirlo del cobro de plataforma. El webhook lee de la referencia
 * a que gimnasio pertenece y con que secreto de eventos verificar la firma.
 * Formato: `MB-<tenantId>-<miembroId>-<planId>-<nonce>`.
 */
export const PREFIJO_REFERENCIA_PAGO_MIEMBRO = 'MB';

export const PROVEEDORES_WHATSAPP = Object.freeze({
  BAILEYS: 'baileys',
  CLOUD_API: 'cloud_api',
  N8N: 'n8n',
  NINGUNO: 'ninguno',
});

export const LISTA_PROVEEDORES_WHATSAPP = Object.values(PROVEEDORES_WHATSAPP);

export const CANALES_NOTIFICACION = Object.freeze({ WHATSAPP: 'whatsapp' });

/**
 * Plantilla de WhatsApp para el aviso de vencimiento (proveedor Cloud API).
 *
 * Meta solo deja mandar texto libre dentro de la ventana de 24h; un aviso de
 * vencimiento casi nunca cae ahi, asi que en produccion se envia una PLANTILLA
 * aprobada. Es una CONVENCION, igual que el plan 'Estandar': cada gimnasio
 * registra en SU WABA una plantilla con este mismo nombre e idioma. El cuerpo
 * aprobado espera 3 variables, en este orden:
 *   {{1}} = nombre del miembro · {{2}} = gimnasio · {{3}} = fecha de vencimiento.
 */
export const PLANTILLA_VENCIMIENTO = Object.freeze({
  nombre: 'aviso_vencimiento',
  idioma: 'es_CO',
});

export const TIPOS_NOTIFICACION = Object.freeze({
  PROXIMO_VENCIMIENTO: 'proximo_vencimiento',
});

export const ESTADOS_NOTIFICACION = Object.freeze({
  ENVIADO: 'enviado',
  FALLIDO: 'fallido',
});

/** Dias de antelacion con que se avisa a un miembro que su mensualidad vence. */
export const DIAS_AVISO_VENCIMIENTO = 3;

/** Todo gimnasio nuevo estrena 2 meses gratis antes de su primera factura. */
export const MESES_TRIAL_GRATIS = 2;

/**
 * La suscripcion es una sola, plana, igual para todos: `PlanPlataforma` con
 * este nombre. El registro publico lo asigna sin que nadie elija. El seed lo
 * crea. Se busca por nombre, asi que este string es la llave.
 */
export const PLAN_SUSCRIPCION_NOMBRE = 'Estandar';
export const PLAN_SUSCRIPCION_PRECIO = 100_000;

export const MILISEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Estado de membresia de un miembro. NO se guarda en ninguna coleccion: se
 * deriva del `periodoFin` de su ultimo `Pago` (ver `vencimientos.servicio.js`).
 */
export const ESTADOS_VENCIMIENTO = Object.freeze({
  AL_DIA: 'al_dia',
  POR_VENCER: 'por_vencer',
  VENCIDO: 'vencido',
  SIN_PAGOS: 'sin_pagos',
});

/**
 * Estados que merecen un aviso por WhatsApp. `al_dia` no molesta a nadie y
 * `sin_pagos` es un miembro que nunca pago: no hay periodo del que avisar.
 */
export const ESTADOS_VENCIMIENTO_AVISABLES = Object.freeze([
  ESTADOS_VENCIMIENTO.POR_VENCER,
  ESTADOS_VENCIMIENTO.VENCIDO,
]);

// --- Maquinas e implementos del gimnasio (mantenimiento) ---------------------

/**
 * Estado de una maquina o implemento. El dueño lo lee para saber que necesita
 * revision: `mantenimiento` esta fuera de servicio temporalmente, `danada` esta
 * rota y espera reparacion o baja.
 */
export const ESTADOS_MAQUINA = Object.freeze({
  OPERATIVA: 'operativa',
  MANTENIMIENTO: 'mantenimiento',
  DANADA: 'danada',
});

export const LISTA_ESTADOS_MAQUINA = Object.values(ESTADOS_MAQUINA);

/** Estados que el dueño debe atender: no operan. */
export const ESTADOS_MAQUINA_REQUIEREN_ATENCION = Object.freeze([
  ESTADOS_MAQUINA.MANTENIMIENTO,
  ESTADOS_MAQUINA.DANADA,
]);

/** Todos los dias a las 9:00, en la zona horaria del producto. */
export const EXPRESION_CRON_VENCIMIENTOS = '0 9 * * *';

/** Facturacion de plataforma: de madrugada, lejos de la hora pico del gimnasio. */
export const EXPRESION_CRON_FACTURACION = '0 3 * * *';

// --- Facturacion de plataforma (el gimnasio le paga a GymSaaS) ---------------

export const ESTADOS_FACTURA = Object.freeze({
  PENDIENTE: 'pendiente',
  PAGADA: 'pagada',
  FALLIDA: 'fallida',
  ANULADA: 'anulada',
});

export const LISTA_ESTADOS_FACTURA = Object.values(ESTADOS_FACTURA);

/** Dias que tiene un gimnasio para pagar antes de que se le suspenda la cuenta. */
export const DIAS_GRACIA_PAGO = 5;

/** Wompi cobra en centavos: $60.000 COP viajan como 6000000. */
export const CENTAVOS_POR_UNIDAD = 100;

/** Estados de una transaccion de Wompi. Solo `APPROVED` da la factura por pagada. */
export const ESTADOS_TRANSACCION_WOMPI = Object.freeze({
  APROBADA: 'APPROVED',
  RECHAZADA: 'DECLINED',
  ANULADA: 'VOIDED',
  ERROR: 'ERROR',
  PENDIENTE: 'PENDING',
});

/** El unico evento de Wompi al que se reacciona hoy. */
export const EVENTO_WOMPI_TRANSACCION = 'transaction.updated';

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
