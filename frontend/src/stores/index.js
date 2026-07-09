import { defineStore } from '#q-app/wrappers';
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';

/**
 * Entrada de Pinia. Quasar detecta este archivo por convencion (`src/stores/index`),
 * asi que su nombre no se traduce.
 *
 * La persistencia guarda UNICAMENTE el perfil del usuario, para que el panel se
 * pinte sin parpadeo al recargar. El token de sesion vive en una cookie HttpOnly
 * inaccesible a JavaScript, y la sesion real siempre la decide el backend: si la
 * cookie caduco, la primera peticion devuelve 401 y el store se limpia.
 */
export default defineStore(() => {
  const pinia = createPinia();
  pinia.use(piniaPluginPersistedstate);
  return pinia;
});
