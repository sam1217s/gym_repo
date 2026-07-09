<template>
  <q-page padding>
    <div class="text-h5 q-mb-md">Hola, {{ usuario?.nombres }}</div>

    <q-banner rounded class="bg-blue-1 text-primary">
      <template #avatar><q-icon name="construction" /></template>
      El panel con ingresos, miembros activos y vencimientos llega en la Fase 4.
    </q-banner>

    <q-card flat bordered class="q-mt-md">
      <q-card-section>
        <div class="text-subtitle2 text-grey-7">Sesion actual</div>
      </q-card-section>
      <q-separator />
      <q-list dense>
        <q-item v-for="dato in datosSesion" :key="dato.etiqueta">
          <q-item-section>{{ dato.etiqueta }}</q-item-section>
          <q-item-section side class="text-weight-medium">{{ dato.valor }}</q-item-section>
        </q-item>
      </q-list>
    </q-card>
  </q-page>
</template>

<script setup>
import { computed } from 'vue';

import { useAutenticacion } from 'src/composables/useAutenticacion.js';

const { usuario } = useAutenticacion();

const SIN_DATO = '—';

const datosSesion = computed(() => [
  { etiqueta: 'Correo', valor: usuario.value?.email ?? SIN_DATO },
  { etiqueta: 'Rol', valor: usuario.value?.rol ?? SIN_DATO },
  { etiqueta: 'Gimnasio', valor: usuario.value?.tenant ?? 'Plataforma' },
  { etiqueta: 'Sede', valor: usuario.value?.sede ?? 'Todas' },
]);
</script>
