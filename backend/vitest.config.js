import { defineConfig } from 'vitest/config';

const SECRETO_PRUEBA_ACCESO = 'secreto-de-pruebas-para-el-token-de-acceso-0001';
const SECRETO_PRUEBA_REFRESCO = 'secreto-de-pruebas-para-el-token-de-refresco-0002';

/** Credenciales de Wompi de mentira: las pruebas firman y verifican con estas. */
const WOMPI_SECRETO_INTEGRIDAD = 'test_integrity_secreto_de_prueba';
const WOMPI_SECRETO_EVENTOS = 'test_events_secreto_de_prueba';

export default defineConfig({
  test: {
    name: 'backend',
    environment: 'node',
    include: ['pruebas/**/*.prueba.js'],
    setupFiles: ['./pruebas/configuracion.js'],

    /**
     * `src/config/entorno.js` valida el entorno al importarse, asi que estas
     * variables tienen que existir antes de que cualquier prueba cargue el
     * codigo. La `MONGO_URI` real la sustituye `configuracion.js` con la del
     * servidor en memoria.
     */
    env: {
      NODE_ENV: 'test',
      MONGO_URI: 'mongodb://127.0.0.1:27017/gymsaas-placeholder',
      JWT_SECRETO_ACCESO: SECRETO_PRUEBA_ACCESO,
      JWT_SECRETO_REFRESCO: SECRETO_PRUEBA_REFRESCO,

      WOMPI_LLAVE_PUBLICA: 'pub_test_llave_publica_de_prueba',
      WOMPI_SECRETO_INTEGRIDAD,
      WOMPI_SECRETO_EVENTOS,

      // Wompi DEL GIMNASIO (pago en linea del miembro): las pruebas de
      // `pagosMiembro` firman/verifican con estos valores.
      WOMPI_MIEMBRO_LLAVE_PUBLICA: 'pub_test_llave',
      WOMPI_MIEMBRO_SECRETO_INTEGRIDAD: 'test_integrity_xyz',
      WOMPI_MIEMBRO_SECRETO_EVENTOS: 'test_events_abc',

      // Twilio se deja SIN configurar a proposito: asi el canal queda
      // deshabilitado y bienvenida/recibo (fire-and-forget) no tocan la red.
      // Las pruebas de la bandeja inyectan las credenciales que necesitan.
      // Se fijan a '' EXPLICITAMENTE (no basta con omitirlas): `dotenv` rellena
      // con el `.env` real toda clave que aqui no exista, asi que un `.env` de
      // desarrollo con Twilio configurado activaria el canal y romperia las
      // pruebas de "sin canal". Fijarlas vacias bloquea esa filtracion.
      TWILIO_ACCOUNT_SID: '',
      TWILIO_AUTH_TOKEN: '',
      TWILIO_NUMERO: '',
      TWILIO_VERIFY_SERVICE_SID: '',
      TWILIO_CONTENT_SID_VENCIMIENTO: '',
      TWILIO_CONTENT_SID_BIENVENIDA: '',
      TWILIO_CONTENT_SID_RECIBO: '',
      TWILIO_CONTENT_SID_LOGIN: '',
      CLOUDINARY_CLOUD_NAME: '',
      CLOUDINARY_API_KEY: '',
      CLOUDINARY_API_SECRET: '',

      // El cron nunca se programa en pruebas: sus funciones se llaman a mano.
      HABILITAR_CRON: 'false',
    },

    // La primera ejecucion descarga el binario de MongoDB.
    hookTimeout: 180_000,
    testTimeout: 30_000,
  },
});
