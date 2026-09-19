/**
 * Constantes de dominio. Ningun numero ni string magico debe aparecer suelto en
 * servicios o controladores: si tiene significado de negocio, vive aqui.
 */

export const ROLES = Object.freeze({
  TENANT_OWNER: 'tenant_owner',
  SEDE_ADMIN: 'sede_admin',
});

export const LISTA_ROLES = Object.values(ROLES);

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

export const CANALES_NOTIFICACION = Object.freeze({ WHATSAPP: 'whatsapp' });

/** Canales por los que se puede pedir el codigo OTP de login (Twilio Verify). */
export const CANALES_OTP = Object.freeze({ SMS: 'sms', WHATSAPP: 'whatsapp' });
export const LISTA_CANALES_OTP = Object.values(CANALES_OTP);

/**
 * Plantilla de WhatsApp para el aviso de vencimiento.
 *
 * WhatsApp solo deja mandar texto libre dentro de la ventana de 24h; un aviso de
 * vencimiento casi nunca cae ahi, asi que en produccion se envia una PLANTILLA
 * aprobada. Con Twilio cada plantilla es un "Content Template" identificado por
 * su Content SID (`HX...`), que el gimnasio registra en SU cuenta de Twilio y
 * pega en el panel; `clave` es como se busca ese SID en las credenciales del
 * tenant (`credenciales.plantillas[clave]`). El cuerpo espera 4 variables:
 *   {{1}} = nombre · {{2}} = gimnasio · {{3}} = fecha de vencimiento · {{4}} = valor.
 *
 * `nombre`/`idioma` se conservan como referencia y los usan los proveedores de
 * texto (n8n), que ignoran el Content SID y mandan el `mensaje`.
 */
export const PLANTILLA_VENCIMIENTO = Object.freeze({
  clave: 'vencimiento',
  nombre: 'avisa_vence2',
  idioma: 'es_CO',
});

/**
 * Plantilla de BIENVENIDA: se envia al registrar un miembro para darle contexto
 * de que por WhatsApp se manejan los avisos y comprobantes de la mensualidad.
 * Misma convencion que la de vencimiento (cada gimnasio la registra en SU cuenta
 * de Twilio). El cuerpo espera 2 variables, en este orden:
 *   {{1}} = nombre del miembro · {{2}} = gimnasio.
 */
export const PLANTILLA_BIENVENIDA = Object.freeze({
  clave: 'bienvenida',
  nombre: 'msg_bienvenida',
  idioma: 'es_CO',
});

/**
 * Recibo de pago: se envia al registrar un pago (efectivo o transferencia) desde
 * el panel, para confirmarle al miembro. Es una plantilla (mensaje iniciado por
 * el negocio). El cuerpo espera 4 variables, en este orden:
 *   {{1}} = nombre · {{2}} = gimnasio · {{3}} = valor pagado · {{4}} = vence el.
 */
export const PLANTILLA_RECIBO = Object.freeze({
  clave: 'recibo',
  nombre: 'recibo_pago',
  idioma: 'es_CR',
});

export const TIPOS_NOTIFICACION = Object.freeze({
  PROXIMO_VENCIMIENTO: 'proximo_vencimiento',
});

export const ESTADOS_NOTIFICACION = Object.freeze({
  ENVIADO: 'enviado',
  FALLIDO: 'fallido',
});

/**
 * Umbral (en dias) con que el PANEL pinta a un miembro como "por vencer". Es
 * solo presentacion; el aviso por WhatsApp usa sus propios umbrales de abajo.
 */
export const DIAS_AVISO_VENCIMIENTO = 3;

/**
 * Avisos por WhatsApp: DOS por ciclo de pago, cada uno una sola vez.
 *  - `POR_VENCER`: faltando este numero de dias (o menos) para vencer.
 *  - `VENCIDO`: cuando lleva este numero de dias (o mas) vencido.
 */
export const DIAS_AVISO_POR_VENCER = 2;
export const DIAS_AVISO_VENCIDO = 2;

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

// --- Finanzas: gastos y deudas del gimnasio ----------------------------------

/**
 * En que se va la plata. Un gasto pertenece a UNA sede (arriendo, servicios,
 * nomina...) o al gimnasio entero (`sede: null`), que es donde caen las
 * obligaciones del dueño. `DEUDA` es la categoria de los abonos a una `Deuda`.
 */
export const CATEGORIAS_GASTO = Object.freeze({
  ARRIENDO: 'arriendo',
  SERVICIOS: 'servicios',
  EMPLEADOS: 'empleados',
  DEUDA: 'deuda',
  OTROS: 'otros',
});

export const LISTA_CATEGORIAS_GASTO = Object.values(CATEGORIAS_GASTO);

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

/** Limpieza de comprobantes: a las 4, antes del dia. */
export const EXPRESION_CRON_PURGA_COMPROBANTES = '0 4 * * *';

/**
 * Cuanto se conserva la IMAGEN de un comprobante de WhatsApp antes de borrarla
 * (de Cloudinary, o del disco en archivos heredados). El registro del mensaje
 * (quien, cuando, texto) se conserva; solo se suelta el archivo, que ya cumplio
 * su funcion de verificar el pago.
 */
export const MESES_RETENCION_COMPROBANTE = 3;

// --- Cobro en linea del miembro (Wompi del gimnasio) -------------------------

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
