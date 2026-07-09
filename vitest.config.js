import { defineConfig } from 'vitest/config';

/**
 * Runner unico para todo el monorepo.
 *
 * Cada carpeta listada en `projects` aporta su propia configuracion de Vitest.
 * Hoy solo existe `backend`; cuando el frontend tenga pruebas de componentes se
 * agrega su carpeta aqui y se ejecutan todas con un solo `npm run prueba`.
 */
export default defineConfig({
  test: {
    projects: ['backend'],
  },
});
