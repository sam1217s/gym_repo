<template>
  <q-page padding class="pagina-panel">
    <div class="row items-end justify-between q-mb-lg">
      <div>
        <div class="ceja">Mi gimnasio</div>
        <h1 class="titulo-display titulo-pagina q-my-none">Auditoria</h1>
        <div class="text-caption text-grey-7">Cada movimiento del gimnasio y quien lo hizo</div>
      </div>

      <q-btn flat round dense icon="refresh" :loading="cargando" @click="cargar">
        <q-tooltip>Actualizar</q-tooltip>
      </q-btn>
    </div>

    <q-input v-model="busqueda" dense outlined clearable placeholder="Buscar por usuario, accion o detalle" class="q-mb-md">
      <template #prepend><q-icon name="search" /></template>
    </q-input>

    <q-table
      flat
      bordered
      row-key="_id"
      :rows="filas"
      :columns="columnas"
      :loading="cargando"
      :pagination="{ rowsPerPage: 25, sortBy: 'fecha', descending: true }"
      no-data-label="Aun no hay movimientos registrados."
    >
      <template #body-cell-usuario="props">
        <q-td :props="props">
          <div class="text-weight-medium">{{ props.row.usuarioNombre }}</div>
          <q-badge outline :color="COLOR_ROL[props.row.usuarioRol]" class="q-mt-xs">
            {{ ETIQUETA_ROL[props.row.usuarioRol] }}
          </q-badge>
        </q-td>
      </template>

      <template #body-cell-accion="props">
        <q-td :props="props">
          <span class="chip-banda" :style="{ '--banda': `var(--q-${COLOR_RECURSO[props.row.recurso] || 'secondary'})` }">
            {{ props.row.accion }}
          </span>
        </q-td>
      </template>
    </q-table>
  </q-page>
</template>

<script setup>
import { useQuasar } from 'quasar';
import { computed, onMounted, ref } from 'vue';

import { ROLES } from 'src/stores/autenticacion.js';
import { useGimnasioStore } from 'src/stores/gimnasio.js';

/**
 * Bitacora del dueño: quien hizo que en el gimnasio. La alimenta un middleware
 * transversal en el backend; aqui solo se lista y se filtra.
 */

const gimnasio = useGimnasioStore();
const quasar = useQuasar();

const cargando = ref(false);
const busqueda = ref('');

const ETIQUETA_ROL = {
  [ROLES.TENANT_OWNER]: 'Dueno',
  [ROLES.SEDE_ADMIN]: 'Encargado',
};
const COLOR_ROL = {
  [ROLES.TENANT_OWNER]: 'primary',
  [ROLES.SEDE_ADMIN]: 'info',
};
// El color de la banda por tipo de recurso (reusa la paleta de la marca).
const COLOR_RECURSO = {
  pagos: 'positive',
  ventas: 'positive',
  miembros: 'info',
  inventario: 'secondary',
  maquinas: 'warning',
  sedes: 'secondary',
  usuarios: 'secondary',
  'planes-membresia': 'secondary',
};

const FORMATO_FECHA = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const columnas = [
  {
    name: 'fecha',
    label: 'Fecha',
    field: 'createdAt',
    align: 'left',
    sortable: true,
    format: (valor) => FORMATO_FECHA.format(new Date(valor)),
  },
  { name: 'usuario', label: 'Usuario', field: 'usuarioNombre', align: 'left', sortable: true },
  { name: 'accion', label: 'Movimiento', field: 'accion', align: 'left', sortable: true },
  { name: 'detalle', label: 'Detalle', field: 'detalle', align: 'left', format: (v) => v || '—' },
];

const filas = computed(() => {
  const texto = (busqueda.value ?? '').trim().toLowerCase();
  if (!texto) return gimnasio.auditoria;
  return gimnasio.auditoria.filter((m) =>
    `${m.usuarioNombre} ${m.accion} ${m.detalle ?? ''}`.toLowerCase().includes(texto),
  );
});

async function cargar() {
  cargando.value = true;
  try {
    await gimnasio.cargarAuditoria();
  } catch {
    quasar.notify({ type: 'negative', message: 'No se pudo cargar la auditoria' });
  } finally {
    cargando.value = false;
  }
}

onMounted(cargar);
</script>

<style scoped>
.pagina-panel {
  max-width: 1400px;
  margin: 0 auto;
}
</style>
