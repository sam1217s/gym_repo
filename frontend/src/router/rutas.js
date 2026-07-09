import { ROLES } from 'src/stores/autenticacion.js';

/**
 * Mapa de rutas.
 *
 * `meta.publica` marca las rutas accesibles sin sesion.
 * `meta.roles` restringe una ruta a ciertos roles; sin `meta.roles`, cualquier
 * usuario autenticado entra. El guard de `router/guardias.js` los aplica.
 */
const rutas = [
  {
    path: '/',
    component: () => import('layouts/LayoutAutenticacion.vue'),
    children: [
      {
        path: 'iniciar-sesion',
        name: 'iniciar-sesion',
        component: () => import('pages/IniciarSesion.vue'),
        meta: { publica: true },
      },
    ],
  },

  {
    path: '/panel',
    component: () => import('layouts/LayoutPrincipal.vue'),
    children: [
      {
        path: '',
        name: 'panel',
        component: () => import('pages/PanelInicio.vue'),
      },
      {
        path: 'cambiar-contrasena',
        name: 'cambiar-contrasena',
        component: () => import('pages/CambiarContrasena.vue'),
      },
      {
        // Fase 2: panel de la plataforma (gestion de gimnasios y planes).
        path: 'plataforma',
        name: 'plataforma',
        component: () => import('pages/PanelInicio.vue'),
        meta: { roles: [ROLES.SUPER_ADMIN] },
      },
    ],
  },

  {
    path: '/:rutaInexistente(.*)*',
    component: () => import('pages/ErrorNoEncontrado.vue'),
    meta: { publica: true },
  },
];

export default rutas;
