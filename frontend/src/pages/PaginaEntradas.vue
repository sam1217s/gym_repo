<template>
  <q-page padding class="pagina-panel">
    <div class="row items-end justify-between q-mb-lg">
      <div>
        <div class="ceja">Mi gimnasio</div>
        <h1 class="titulo-display titulo-pagina q-my-none">Entradas</h1>
        <div class="text-caption text-grey-7">Quien paso por la puerta, con huella.</div>
      </div>

      <div class="row q-gutter-sm items-center">
        <q-input v-model="fecha" type="date" dense outlined stack-label label="Dia" @update:model-value="cargar" />
        <q-btn flat round color="grey-8" icon="refresh" :loading="cargando" @click="cargar">
          <q-tooltip>Actualizar</q-tooltip>
        </q-btn>
      </div>
    </div>

    <div class="fila-discos q-mb-lg">
      <div v-for="disco in discos" :key="disco.etiqueta" class="celda-disco">
        <div class="disco" :style="{ borderColor: disco.color }">
          <span class="titulo-display numero-disco cifra-tabular">{{ disco.total }}</span>
        </div>
        <div class="etiqueta-disco">{{ disco.etiqueta }}</div>
      </div>
    </div>

    <div class="row q-col-gutter-md q-mb-md">
      <q-select
        v-if="esDueno"
        v-model="filtroSede"
        class="col-12 col-sm-4"
        dense
        outlined
        clearable
        emit-value
        map-options
        label="Todas las sedes"
        :options="opcionesSede"
        @update:model-value="cargar"
      />
      <q-select
        v-model="filtroResultado"
        class="col-12 col-sm-4"
        dense
        outlined
        clearable
        emit-value
        map-options
        label="Permitidas y negadas"
        :options="OPCIONES_RESULTADO"
        @update:model-value="cargar"
      />
    </div>

    <q-table
      flat
      bordered
      row-key="_id"
      :rows="accesos"
      :columns="columnasResponsivas"
      :loading="cargando"
      :pagination="{ rowsPerPage: 50 }"
      :hide-bottom="accesos.length <= 50"
      no-data-label="Nadie ha pasado por la puerta este dia."
    >
      <template #body-cell-resultado="props">
        <q-td :props="props">
          <span class="chip-banda" :style="{ '--banda': APARIENCIA_MOTIVO[props.row.motivo]?.color ?? '#667085' }">
            {{ APARIENCIA_MOTIVO[props.row.motivo]?.etiqueta ?? props.row.motivo }}
          </span>
        </q-td>
      </template>
    </q-table>
  </q-page>
</template>

<script setup>
import { useQuasar } from 'quasar';
import { computed, onMounted, ref } from 'vue';

import { useAutenticacion } from 'src/composables/useAutenticacion.js';
import { useColumnasResponsive } from 'src/composables/useColumnasResponsive.js';
import { listarAccesos } from 'src/servicios/gimnasio.servicio.js';
import { ROLES } from 'src/stores/autenticacion.js';
import { useGimnasioStore } from 'src/stores/gimnasio.js';

/**
 * Historial de la puerta, por dia. Un sede_admin recibe del backend solo las
 * entradas por la puerta de SU sede (aunque el miembro sea de otra); el dueño ve
 * todas y puede filtrar.
 */

const quasar = useQuasar();
const gimnasio = useGimnasioStore();
const { usuario } = useAutenticacion();

const esDueno = computed(() => usuario.value?.rol === ROLES.TENANT_OWNER);

/** Colores de las bandas de disco, igual que los estados de vencimiento. */
const APARIENCIA_MOTIVO = {
  al_dia: { etiqueta: 'Al dia', color: 'var(--q-positive)' },
  por_vencer: { etiqueta: 'Por vencer', color: 'var(--q-positive)' },
  en_gracia: { etiqueta: 'En gracia', color: 'var(--q-warning)' },
  vencido: { etiqueta: 'Negado: vencido', color: 'var(--q-negative)' },
  sin_pagos: { etiqueta: 'Negado: sin pagos', color: 'var(--q-negative)' },
  inactivo: { etiqueta: 'Negado: inactivo', color: '#667085' },
};

const OPCIONES_RESULTADO = [
  { label: 'Solo permitidas', value: 'permitido' },
  { label: 'Solo negadas', value: 'negado' },
];

function hoyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const fecha = ref(hoyLocal());
const filtroSede = ref(null);
const filtroResultado = ref(null);
const accesos = ref([]);
const resumen = ref({ total: 0, permitidos: 0, negados: 0 });
const cargando = ref(false);

const opcionesSede = computed(() => gimnasio.sedes.map((sede) => ({ label: sede.nombre, value: sede._id })));

const discos = computed(() => [
  { etiqueta: 'Intentos', total: resumen.value.total, color: 'var(--q-secondary)' },
  { etiqueta: 'Permitidas', total: resumen.value.permitidos, color: 'var(--q-positive)' },
  { etiqueta: 'Negadas', total: resumen.value.negados, color: 'var(--q-negative)' },
]);

const COLUMNAS = [
  {
    name: 'hora',
    label: 'Hora',
    field: 'createdAt',
    format: (valor) => new Date(valor).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    align: 'left',
    classes: 'cifra-tabular',
  },
  { name: 'miembro', label: 'Miembro', field: (fila) => fila.nombreMiembro || 'Desconocido', align: 'left' },
  { name: 'sede', label: 'Puerta', field: (fila) => fila.sede?.nombre ?? '—', align: 'left' },
  { name: 'resultado', label: 'Resultado', field: 'motivo', align: 'left' },
  {
    name: 'vence',
    label: 'Vencia',
    field: 'vence',
    format: (valor) => (valor ? new Date(valor).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : '—'),
    align: 'left',
  },
];

const columnasResponsivas = useColumnasResponsive(COLUMNAS);

async function cargar() {
  cargando.value = true;
  try {
    const datos = await listarAccesos({
      fecha: fecha.value || hoyLocal(),
      ...(filtroSede.value ? { sede: filtroSede.value } : {}),
      ...(filtroResultado.value ? { resultado: filtroResultado.value } : {}),
    });
    accesos.value = datos.accesos;
    resumen.value = datos.resumen;
  } catch (error) {
    quasar.notify({ type: 'negative', message: error.response?.data?.error?.mensaje ?? 'No se pudieron cargar las entradas' });
  } finally {
    cargando.value = false;
  }
}

onMounted(async () => {
  if (esDueno.value) gimnasio.cargarSedes().catch(() => {});
  await cargar();
});
</script>

<style scoped>
.pagina-panel {
  max-width: 1400px;
  margin: 0 auto;
}
</style>
