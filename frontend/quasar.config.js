import { defineConfig } from '#q-app/wrappers';

/**
 * Configuracion del proyecto Quasar.
 * https://v2.quasar.dev/quasar-cli-vite/quasar-config-file
 */
export default defineConfig(() => ({
  // Archivos de `src/boot` que corren antes de montar la app.
  boot: ['axios'],

  css: ['app.scss'],

  extras: ['roboto-font', 'material-icons'],

  build: {
    target: { browser: ['es2022', 'firefox115', 'chrome115', 'safari14'], node: 'node20' },
    vueRouterMode: 'history',
  },

  devServer: {
    port: 9000,
    open: false,

    /**
     * El proxy es lo que hace que las cookies HttpOnly funcionen en desarrollo:
     * el navegador ve todo saliendo de `localhost:9000`, asi que las peticiones
     * a `/api` son same-origin y no hay CORS ni problemas de `SameSite`.
     * En produccion no existe este proxy: ver la seccion de CORS en CLAUDE.md.
     */
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },

  framework: {
    plugins: ['Notify', 'Loading'],
    config: {
      notify: { position: 'top-right', timeout: 3000 },
    },
  },

  animations: [],
}));
