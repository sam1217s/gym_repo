import { defineConfig } from 'vitest/config';

const SECRETO_PRUEBA_ACCESO = 'secreto-de-pruebas-para-el-token-de-acceso-0001';
const SECRETO_PRUEBA_REFRESCO = 'secreto-de-pruebas-para-el-token-de-refresco-0002';

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
    },

    // La primera ejecucion descarga el binario de MongoDB.
    hookTimeout: 180_000,
    testTimeout: 30_000,
  },
});
