<template>
  <q-layout view="hHh lpR fFf">
    <!-- Tinta con la banda de disco roja debajo: la firma visual de la marca. -->
    <q-header class="encabezado-marca bg-secondary text-white">
      <q-toolbar>
        <q-btn flat dense round icon="menu" aria-label="Menu" @click="alternarMenu" />

        <q-toolbar-title class="titulo-display">GymSaaS</q-toolbar-title>

        <div class="q-mr-md text-caption">
          {{ usuario?.nombreCompleto }}
          <q-badge outline align="middle" class="q-ml-sm">{{ etiquetaRol }}</q-badge>
        </div>

        <q-btn flat dense round icon="logout" aria-label="Cerrar sesion" @click="cerrarSesion" />
      </q-toolbar>
    </q-header>

    <q-drawer v-model="menuAbierto" show-if-above bordered>
      <q-list>
        <q-item-label header>Navegacion</q-item-label>

        <q-item v-for="enlace in enlacesVisibles" :key="enlace.nombre" clickable :to="{ name: enlace.nombre }" exact>
          <q-item-section avatar>
            <q-icon :name="enlace.icono" />
          </q-item-section>
          <q-item-section>{{ enlace.titulo }}</q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { computed, ref } from 'vue';

import { useAutenticacion } from 'src/composables/useAutenticacion.js';
import { ROLES, useAutenticacionStore } from 'src/stores/autenticacion.js';

const { usuario, cerrarSesion } = useAutenticacion();

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
  { nombre: 'sedes', titulo: 'Sedes', icono: 'store', roles: [ROLES.TENANT_OWNER] },
  { nombre: 'equipo', titulo: 'Equipo', icono: 'badge', roles: [ROLES.TENANT_OWNER] },
  { nombre: 'planes', titulo: 'Planes', icono: 'sell', roles: [ROLES.TENANT_OWNER] },
  { nombre: 'facturacion', titulo: 'Facturacion', icono: 'receipt_long', roles: [ROLES.TENANT_OWNER] },
];

const etiquetaRol = computed(() => ETIQUETAS_ROL[usuario.value?.rol] ?? '');

const autenticacion = useAutenticacionStore();

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
</script>

<style scoped>
.encabezado-marca {
  border-bottom: 3px solid var(--q-primary);
}
</style>
