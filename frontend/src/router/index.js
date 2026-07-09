import { defineRouter } from '#q-app/wrappers';
import { createMemoryHistory, createRouter, createWebHashHistory, createWebHistory } from 'vue-router';

import { registrarGuardias } from './guardias.js';
import rutas from './rutas.js';

/**
 * Quasar detecta este archivo por convencion (`src/router/index`), asi que su
 * nombre no se traduce. El contenido si va en espanol.
 */
export default defineRouter(function ({ store }) {
  const crearHistorial = process.env.SERVER
    ? createMemoryHistory
    : process.env.VUE_ROUTER_MODE === 'history'
      ? createWebHistory
      : createWebHashHistory;

  const enrutador = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes: rutas,
    history: crearHistorial(process.env.VUE_ROUTER_BASE),
  });

  // `store` es la instancia de Pinia: el guard la necesita porque corre fuera de
  // un componente, donde no hay una Pinia activa implicita.
  registrarGuardias(enrutador, store);

  return enrutador;
});
