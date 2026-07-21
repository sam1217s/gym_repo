<template>
  <q-layout view="hHh lpR fFf">
    <!-- Tinta con la banda de disco roja debajo: la firma visual de la marca. -->
    <q-header class="encabezado-marca bg-secondary text-white">
      <q-toolbar>
        <q-btn flat dense round icon="menu" aria-label="Menu" @click="alternarMenu" />

        <!-- Titulo: el NEGOCIO manda (nombre del gimnasio); GymSaaS queda como
             ceja discreta. El super_admin ve la plataforma. -->
        <q-toolbar-title class="columna-titulo">
          <div class="ceja-marca">{{ esSuperAdmin ? 'GymSaaS' : 'GymSaaS · Panel' }}</div>
          <div class="titulo-display titulo-negocio">{{ tituloNegocio }}</div>
        </q-toolbar-title>

        <!-- La identidad y el cierre de sesion se guardan tras el avatar: asi el
             header no se satura en movil. -->
        <q-btn flat round dense icon="account_circle" aria-label="Cuenta">
          <q-menu anchor="bottom right" self="top right">
            <div class="tarjeta-cuenta">
              <div class="text-weight-medium">{{ usuario?.nombreCompleto }}</div>
              <div class="text-caption text-grey-7">{{ usuario?.email }}</div>
              <q-badge outline color="primary" class="q-mt-xs">{{ etiquetaRol }}</q-badge>
            </div>
            <q-separator />
            <q-list>
              <q-item v-close-popup clickable @click="cerrarSesion">
                <q-item-section avatar>
                  <q-icon name="logout" color="primary" />
                </q-item-section>
                <q-item-section>Cerrar sesion</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="menuAbierto" show-if-above bordered :width="252" class="drawer-nav">
      <q-list padding class="q-px-sm">
        <q-item-label header class="etiqueta-nav">Navegacion</q-item-label>

        <q-item
          v-for="enlace in enlacesVisibles"
          :key="enlace.nombre"
          clickable
          :to="{ name: enlace.nombre }"
          exact
          class="enlace-nav q-mb-xs"
          active-class="enlace-activo"
          @click="alNavegar"
        >
          <q-item-section avatar>
            <q-icon :name="enlace.icono" />
          </q-item-section>
          <q-item-section>{{ enlace.titulo }}</q-item-section>
          <q-item-section v-if="enlace.nombre === 'reportes' && gimnasio.reportesNoLeidos > 0" side>
            <q-badge color="primary" rounded>{{ gimnasio.reportesNoLeidos }}</q-badge>
          </q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { useQuasar } from 'quasar';
import { computed, onMounted, ref } from 'vue';

import { useAutenticacion } from 'src/composables/useAutenticacion.js';
import { ROLES, useAutenticacionStore } from 'src/stores/autenticacion.js';
import { useGimnasioStore } from 'src/stores/gimnasio.js';

const { usuario, cerrarSesion } = useAutenticacion();
const $q = useQuasar();
const gimnasio = useGimnasioStore();

const menuAbierto = ref(false);

const ETIQUETAS_ROL = {
  [ROLES.SUPER_ADMIN]: 'Plataforma',
  [ROLES.TENANT_OWNER]: 'Dueno',
  [ROLES.SEDE_ADMIN]: 'Sede',
};

// Cada enlace declara que roles pueden verlo, igual que `meta.roles` en las rutas.
const ENLACES = [
  { nombre: 'panel', titulo: 'Inicio', icono: 'dashboard', roles: null },
  { nombre: 'plataforma', titulo: 'Gimnasios', icono: 'apartment', roles: [ROLES.SUPER_ADMIN] },
  {
    nombre: 'miembros',
    titulo: 'Miembros',
    icono: 'groups',
    roles: [ROLES.TENANT_OWNER, ROLES.SEDE_ADMIN],
  },
  {
    nombre: 'inventario',
    titulo: 'Inventario',
    icono: 'inventory_2',
    roles: [ROLES.TENANT_OWNER, ROLES.SEDE_ADMIN],
  },
  {
    nombre: 'ventas',
    titulo: 'Ventas',
    icono: 'point_of_sale',
    roles: [ROLES.TENANT_OWNER, ROLES.SEDE_ADMIN],
  },
  {
    nombre: 'maquinas',
    titulo: 'Maquinas',
    icono: 'fitness_center',
    roles: [ROLES.TENANT_OWNER, ROLES.SEDE_ADMIN],
  },
  { nombre: 'reportes', titulo: 'Reportes', icono: 'report_problem', roles: [ROLES.TENANT_OWNER] },
  { nombre: 'sedes', titulo: 'Sedes', icono: 'store', roles: [ROLES.TENANT_OWNER] },
  { nombre: 'equipo', titulo: 'Equipo', icono: 'badge', roles: [ROLES.TENANT_OWNER] },
  { nombre: 'planes', titulo: 'Planes', icono: 'sell', roles: [ROLES.TENANT_OWNER] },
  { nombre: 'facturacion', titulo: 'Facturacion', icono: 'receipt_long', roles: [ROLES.TENANT_OWNER] },
];

const etiquetaRol = computed(() => ETIQUETAS_ROL[usuario.value?.rol] ?? '');

const autenticacion = useAutenticacionStore();
const esSuperAdmin = computed(() => usuario.value?.rol === ROLES.SUPER_ADMIN);

// El titulo del header es el nombre del NEGOCIO. El super_admin opera la
// plataforma, no un gimnasio; si por lo que sea no llega el nombre, cae a GymSaaS.
const tituloNegocio = computed(() => {
  if (esSuperAdmin.value) return 'Plataforma';
  return usuario.value?.tenantNombre || 'GymSaaS';
});

const enlacesVisibles = computed(() => {
  // Un gimnasio suspendido solo puede ir a Facturacion: mostrar el resto seria
  // ofrecerle puertas que el guard le cierra en la cara.
  if (autenticacion.gimnasioSuspendido) {
    return ENLACES.filter((enlace) => enlace.nombre === 'facturacion');
  }

  // Facturacion (la suscripcion del gimnasio a la plataforma) se oculta mientras
  // el gimnasio opera normal: durante la prueba gratis no hay nada que cobrar, y
  // no queremos mostrarle cobros al cliente. Reaparece solo si se le suspende
  // por impago (rama de arriba), que es cuando de verdad necesita pagar.
  return ENLACES.filter(
    (enlace) =>
      enlace.nombre !== 'facturacion' &&
      (!enlace.roles || enlace.roles.includes(usuario.value?.rol)),
  );
});

function alternarMenu() {
  menuAbierto.value = !menuAbierto.value;
}

// En movil el drawer es un overlay: al elegir una opcion, se cierra solo. En
// escritorio (>= 1024px) es fijo y se queda abierto.
function alNavegar() {
  if ($q.screen.lt.md) menuAbierto.value = false;
}

// El badge de "Reportes" (solo dueño). Se cuenta al montar el panel; la propia
// pagina de reportes lo baja a 0 cuando el dueño la abre.
onMounted(() => {
  if (usuario.value?.rol === ROLES.TENANT_OWNER) {
    gimnasio.contarReportesNoLeidos().catch(() => {});
  }
});
</script>

<style scoped>
.encabezado-marca {
  border-bottom: 3px solid var(--q-primary);
}

.columna-titulo {
  display: flex;
  flex-direction: column;
  justify-content: center;
  line-height: 1.1;
  min-width: 0; /* deja que el nombre largo se recorte en vez de empujar */
}

.ceja-marca {
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0.65;
}

.titulo-negocio {
  font-size: 1.35rem;
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tarjeta-cuenta {
  padding: 12px 16px;
  min-width: 200px;
  max-width: 260px;
}

.etiqueta-nav {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--q-secondary);
  opacity: 0.7;
}

/* Enlaces con forma de pastilla; el activo lleva la banda de disco roja. */
.enlace-nav {
  border-radius: 10px;
  min-height: 46px;
  color: var(--q-secondary);
}

.enlace-nav:hover {
  background: rgba(0, 0, 0, 0.04);
}

.enlace-activo {
  background: rgba(206, 17, 38, 0.1);
  color: var(--q-primary);
  font-weight: 600;
}

.enlace-activo :deep(.q-icon) {
  color: var(--q-primary);
}
</style>
