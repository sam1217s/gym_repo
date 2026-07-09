<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div>
        <div class="text-h5">Gimnasios</div>
        <div class="text-caption text-grey-7">
          Administracion de la plataforma. Solo visible para el rol super_admin.
        </div>
      </div>
    </div>

    <q-banner rounded class="bg-blue-1 text-primary q-mb-md">
      <template #avatar><q-icon name="construction" /></template>
      El CRUD de gimnasios, los planes de plataforma y el onboarding llegan en la Fase 2.
    </q-banner>

    <q-card flat bordered>
      <q-card-section>
        <div class="text-subtitle2 text-grey-7">Lo que ira aqui</div>
      </q-card-section>
      <q-separator />
      <q-list dense>
        <q-item v-for="tarea in TAREAS_PENDIENTES" :key="tarea">
          <q-item-section avatar>
            <q-icon name="radio_button_unchecked" size="xs" color="grey-5" />
          </q-item-section>
          <q-item-section>{{ tarea }}</q-item-section>
        </q-item>
      </q-list>
    </q-card>
  </q-page>
</template>

<script setup>
/**
 * Marcador de posicion del panel de plataforma. Existe como pagina propia (y no
 * reutilizando PanelInicio) para que la ruta `/panel/plataforma` se distinga de
 * `/panel`: si ambas pintaran lo mismo, el enlace pareceria roto.
 */
const TAREAS_PENDIENTES = [
  'Listar, crear, suspender y reactivar gimnasios',
  'CRUD de planes de plataforma (limites y features)',
  'Onboarding: crear un gimnasio con su primer tenant_owner y su primera sede',
];
</script>
