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
      // Sin esto, `/` resolveria al layout sin ningun hijo: pantalla en blanco.
      // Se manda al panel y que el guard decida: si no hay sesion, va al login.
      { path: '', redirect: { name: 'panel' } },
      {
        path: 'iniciar-sesion',
        name: 'iniciar-sesion',
        component: () => import('pages/IniciarSesion.vue'),
        meta: { publica: true },
      },
      {
        path: 'registrar',
        name: 'registrar',
        component: () => import('pages/RegistrarGimnasio.vue'),
        meta: { publica: true },
      },
      {
        path: 'verificar-email',
        name: 'verificar-email',
        component: () => import('pages/VerificarEmail.vue'),
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
        path: 'plataforma',
        name: 'plataforma',
        component: () => import('pages/PanelPlataforma.vue'),
        meta: { roles: [ROLES.SUPER_ADMIN] },
      },
      {
        path: 'miembros',
        name: 'miembros',
        component: () => import('pages/PaginaMiembros.vue'),
        meta: { roles: [ROLES.TENANT_OWNER, ROLES.SEDE_ADMIN] },
      },
      {
        path: 'inventario',
        name: 'inventario',
        component: () => import('pages/PaginaInventario.vue'),
        meta: { roles: [ROLES.TENANT_OWNER, ROLES.SEDE_ADMIN] },
      },
      {
        path: 'maquinas',
        name: 'maquinas',
        component: () => import('pages/PaginaMaquinas.vue'),
        meta: { roles: [ROLES.TENANT_OWNER, ROLES.SEDE_ADMIN] },
      },
      {
        path: 'sedes',
        name: 'sedes',
        component: () => import('pages/PaginaSedes.vue'),
        meta: { roles: [ROLES.TENANT_OWNER] },
      },
      {
        path: 'equipo',
        name: 'equipo',
        component: () => import('pages/PaginaUsuarios.vue'),
        meta: { roles: [ROLES.TENANT_OWNER] },
      },
      {
        path: 'planes',
        name: 'planes',
        component: () => import('pages/PaginaPlanes.vue'),
        meta: { roles: [ROLES.TENANT_OWNER] },
      },
      {
        // `meta.permiteSuspendido`: la unica pantalla que alcanza un gimnasio
        // suspendido, porque es donde se pone al dia.
        path: 'facturacion',
        name: 'facturacion',
        component: () => import('pages/PaginaFacturacion.vue'),
        meta: { roles: [ROLES.TENANT_OWNER], permiteSuspendido: true },
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
