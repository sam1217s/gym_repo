import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const LONGITUD_MINIMA_SECRETO = 32;

/**
 * Contrato de las variables de entorno. Se valida una sola vez, al importar
 * este modulo, para que un `.env` incompleto haga fallar el arranque en vez de
 * producir un error confuso a las tres horas de estar corriendo.
 */
const esquemaEntorno = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PUERTO: z.coerce.number().int().positive().default(3000),
  MONGO_URI: z.string().min(1, 'MONGO_URI es obligatoria'),
  JWT_SECRETO_ACCESO: z.string().min(LONGITUD_MINIMA_SECRETO),
  JWT_SECRETO_REFRESCO: z.string().min(LONGITUD_MINIMA_SECRETO),
  ORIGEN_FRONTEND: z.string().url().default('http://localhost:9000'),

  /**
   * Base publica del backend, accesible desde el celular del miembro y desde
   * Wompi: es donde vive el enlace de pago `/api/pagar/:token` que lleva el
   * boton de WhatsApp, y el webhook de pagos de miembro. En desarrollo cae al
   * mismo origen del backend; en produccion es el dominio desplegado (HTTPS).
   */
  ORIGEN_PUBLICO: z.string().url().default('http://localhost:3000'),
  SEMILLA_SUPERADMIN_EMAIL: z.string().email().default('admin@gymsaas.co'),
  SEMILLA_SUPERADMIN_CONTRASENA: z.string().min(8).default('CambiaEstaClave123'),

  /**
   * Cron de avisos de vencimiento. Se apaga en todas las instancias menos una:
   * con dos procesos de la API corriendo, cada miembro recibiria el aviso dos
   * veces. `z.coerce.boolean()` no sirve aqui: convierte la cadena "false" en
   * `true`, porque toda cadena no vacia es verdadera.
   */
  HABILITAR_CRON: z
    .enum(['true', 'false'])
    .default('true')
    .transform((valor) => valor === 'true'),

  /**
   * Wompi: la pasarela con la que GymSaaS le cobra a los gimnasios.
   *
   * A diferencia del proveedor de WhatsApp (que se elige por gimnasio, en
   * `tenant.config.whatsapp`), la pasarela es de la PLATAFORMA: hay una sola
   * cuenta de Wompi, la de GymSaaS. Por eso vive en el entorno.
   *
   * Son opcionales para que el proyecto arranque sin credenciales; la pasarela
   * lanza, con un mensaje claro, en cuanto se la intenta usar sin ellas.
   */
  WOMPI_LLAVE_PUBLICA: z.string().default(''),
  WOMPI_SECRETO_INTEGRIDAD: z.string().default(''),
  WOMPI_SECRETO_EVENTOS: z.string().default(''),
  WOMPI_URL_CHECKOUT: z.string().url().default('https://checkout.wompi.co/p/'),
  WOMPI_URL_REDIRECCION: z.string().url().default('http://localhost:9000/panel/facturacion'),

  /**
   * Wompi DEL GIMNASIO: con estas llaves el propio miembro paga su mensualidad en
   * linea (nivel de cobro "miembro"). Antes vivian por gimnasio en
   * `tenant.config.wompi`; siendo un solo gimnasio, van al entorno. Opcionales:
   * sin ellas el pago en linea del miembro simplemente no esta disponible.
   */
  WOMPI_MIEMBRO_LLAVE_PUBLICA: z.string().default(''),
  WOMPI_MIEMBRO_SECRETO_INTEGRIDAD: z.string().default(''),
  WOMPI_MIEMBRO_SECRETO_EVENTOS: z.string().default(''),

  /**
   * Twilio WhatsApp: el canal por el que salen los avisos y entran los
   * comprobantes. Siendo un solo gimnasio, vive en el entorno (antes por gimnasio
   * en `tenant.config.whatsapp`). Opcionales: sin ellas el canal queda apagado.
   * Los Content SID son los de las plantillas aprobadas en Twilio.
   */
  TWILIO_ACCOUNT_SID: z.string().default(''),
  TWILIO_AUTH_TOKEN: z.string().default(''),
  TWILIO_NUMERO: z.string().default(''),
  // Verify Service para el login por telefono con codigo (OTP).
  TWILIO_VERIFY_SERVICE_SID: z.string().default(''),
  TWILIO_CONTENT_SID_VENCIMIENTO: z.string().default(''),
  TWILIO_CONTENT_SID_BIENVENIDA: z.string().default(''),
  TWILIO_CONTENT_SID_RECIBO: z.string().default(''),
  // Aviso de seguridad al dueño cuando inicia sesion (plantilla propia).
  TWILIO_CONTENT_SID_LOGIN: z.string().default(''),

  /**
   * Cloudinary: donde se guardan los comprobantes que mandan los miembros por
   * WhatsApp (antes iban al disco). Es de la PLATAFORMA (una sola cuenta), igual
   * que Wompi: por eso vive en el entorno y no por gimnasio. Opcionales para que
   * el proyecto arranque sin ellas; `almacenamiento/cloudinary.js` LANZA, con un
   * mensaje claro, en cuanto se intenta subir/borrar sin credenciales.
   */
  CLOUDINARY_CLOUD_NAME: z.string().default(''),
  CLOUDINARY_API_KEY: z.string().default(''),
  CLOUDINARY_API_SECRET: z.string().default(''),

  /**
   * Carpeta donde vivian los comprobantes en disco. Se conserva para servir
   * archivos HEREDADOS (los que se guardaron antes de migrar a Cloudinary).
   */
  ALMACEN_ARCHIVOS: z.string().default('almacen'),

  SMTP_HOST: z.string().default(''),
  SMTP_PUERTO: z.coerce.number().int().positive().default(587),
  SMTP_USUARIO: z.string().default(''),
  SMTP_CONTRASENA: z.string().default(''),
  SMTP_REMITENTE: z.string().default('GymSaaS <no-responder@gymsaas.local>'),
});

function cargarEntorno() {
  const resultado = esquemaEntorno.safeParse(process.env);

  if (!resultado.success) {
    const detalles = resultado.error.issues
      .map((problema) => `  - ${problema.path.join('.')}: ${problema.message}`)
      .join('\n');
    throw new Error(`Variables de entorno invalidas:\n${detalles}`);
  }

  if (resultado.data.JWT_SECRETO_ACCESO === resultado.data.JWT_SECRETO_REFRESCO) {
    throw new Error('JWT_SECRETO_ACCESO y JWT_SECRETO_REFRESCO deben ser distintos');
  }

  return resultado.data;
}

export const entorno = cargarEntorno();

export const esProduccion = entorno.NODE_ENV === 'production';
export const esPrueba = entorno.NODE_ENV === 'test';
