<template>
  <q-page padding class="pagina-plataforma">
    <div class="row items-end justify-between q-mb-lg">
      <div>
        <div class="ceja">Plataforma</div>
        <h1 class="titulo-display titulo-pagina q-my-none">Gimnasios</h1>
        <div class="text-caption text-grey-7">
          {{ plataforma.gimnasios.length }} dados de alta
        </div>
      </div>

      <q-btn
        color="primary"
        unelevated
        no-caps
        icon="add"
        label="Dar de alta un gimnasio"
        @click="dialogoAbierto = true"
      />
    </div>

    <!-- Los contadores son discos: la banda de color dice el estado, como en
         un disco de competicion dice el peso. -->
    <div class="fila-discos q-mb-lg">
      <div v-for="resumen in discosEstado" :key="resumen.estado" class="celda-disco">
        <div class="disco" :style="{ borderColor: resumen.color }">
          <span class="titulo-display numero-disco cifra-tabular">{{ resumen.total }}</span>
        </div>
        <div class="etiqueta-disco">{{ resumen.etiqueta }}</div>
      </div>
    </div>

    <q-table
      flat
      bordered
      row-key="_id"
      :rows="plataforma.gimnasios"
      :columns="COLUMNAS"
      :loading="plataforma.cargando"
      :pagination="{ rowsPerPage: 15 }"
      :hide-bottom="plataforma.gimnasios.length <= 15"
      no-data-label="Aun no hay gimnasios. Da de alta el primero."
    >
      <template #body-cell-gimnasio="props">
        <q-td :props="props">
          <div class="text-weight-medium">{{ props.row.nombre }}</div>
          <div class="text-caption text-grey-7">{{ props.row.slug }}</div>
        </q-td>
      </template>

      <template #body-cell-dueno="props">
        <q-td :props="props">
          <template v-if="props.row.dueno">
            <div>{{ props.row.dueno.nombreCompleto }}</div>
            <div class="text-caption text-grey-7">{{ props.row.dueno.email }}</div>
          </template>
          <span v-else class="text-grey-6">Sin dueño</span>
        </q-td>
      </template>

      <template #body-cell-estado="props">
        <q-td :props="props">
          <span class="chip-banda" :style="{ '--banda': APARIENCIA_ESTADO[props.row.estado].color }">
            {{ APARIENCIA_ESTADO[props.row.estado].etiqueta }}
          </span>
        </q-td>
      </template>

      <template #body-cell-acciones="props">
        <q-td :props="props" class="text-right">
          <q-btn
            v-if="puedeSuspender(props.row)"
            flat
            dense
            no-caps
            size="sm"
            color="warning"
            label="Suspender"
            @click="confirmarSuspension(props.row)"
          />
          <q-btn
            v-if="props.row.estado === ESTADOS_GIMNASIO.SUSPENDIDO"
            flat
            dense
            no-caps
            size="sm"
            color="positive"
            label="Reactivar"
            @click="confirmarReactivacion(props.row)"
          />
          <q-btn
            v-if="props.row.estado !== ESTADOS_GIMNASIO.CANCELADO"
            flat
            dense
            no-caps
            size="sm"
            color="negative"
            label="Cancelar"
            @click="confirmarCancelacion(props.row)"
          />
          <span v-if="props.row.estado === ESTADOS_GIMNASIO.CANCELADO" class="text-grey-6">—</span>
        </q-td>
      </template>
    </q-table>

    <FormularioOnboarding v-model="dialogoAbierto" />
  </q-page>
</template>

<script setup>
import { useQuasar } from 'quasar';
import { computed, onMounted, ref } from 'vue';

import FormularioOnboarding from 'src/components/FormularioOnboarding.vue';
import { ESTADOS_GIMNASIO, usePlataformaStore } from 'src/stores/plataforma.js';

/**
 * Panel del super_admin: los gimnasios-clientes de la plataforma, su estado y
 * las acciones sobre su ciclo de vida. La comprobacion real de permisos la
 * hace el backend; aqui solo se pinta.
 */

const plataforma = usePlataformaStore();
const quasar = useQuasar();

const dialogoAbierto = ref(false);

/** Color de la banda y nombre visible de cada estado. */
const APARIENCIA_ESTADO = {
  [ESTADOS_GIMNASIO.ACTIVO]: { etiqueta: 'Activo', plural: 'Activos', color: 'var(--q-positive)' },
  [ESTADOS_GIMNASIO.TRIAL]: { etiqueta: 'En prueba', plural: 'En prueba', color: 'var(--q-info)' },
  [ESTADOS_GIMNASIO.SUSPENDIDO]: { etiqueta: 'Suspendido', plural: 'Suspendidos', color: 'var(--q-warning)' },
  [ESTADOS_GIMNASIO.CANCELADO]: { etiqueta: 'Cancelado', plural: 'Cancelados', color: '#667085' },
};

const FORMATO_FECHA = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const COLUMNAS = [
  { name: 'gimnasio', label: 'Gimnasio', field: 'nombre', align: 'left', sortable: true },
  { name: 'nit', label: 'NIT', field: 'nit', align: 'left' },
  {
    name: 'plan',
    label: 'Plan',
    field: (fila) => fila.planPlataforma?.nombre ?? '—',
    align: 'left',
    sortable: true,
  },
  { name: 'sedes', label: 'Sedes', field: 'totalSedes', align: 'center', sortable: true },
  { name: 'dueno', label: 'Dueño', field: (fila) => fila.dueno?.email ?? '', align: 'left' },
  {
    name: 'alta',
    label: 'Alta',
    field: 'fechaRegistro',
    align: 'left',
    sortable: true,
    format: (valor) => (valor ? FORMATO_FECHA.format(new Date(valor)) : '—'),
  },
  { name: 'estado', label: 'Estado', field: 'estado', align: 'left', sortable: true },
  { name: 'acciones', label: '', field: '_id', align: 'right' },
];

const discosEstado = computed(() =>
  [
    ESTADOS_GIMNASIO.ACTIVO,
    ESTADOS_GIMNASIO.TRIAL,
    ESTADOS_GIMNASIO.SUSPENDIDO,
    ESTADOS_GIMNASIO.CANCELADO,
  ].map((estado) => ({
    estado,
    etiqueta: APARIENCIA_ESTADO[estado].plural,
    color: APARIENCIA_ESTADO[estado].color,
    total: plataforma.conteosPorEstado[estado],
  })),
);

function puedeSuspender(gimnasio) {
  return (
    gimnasio.estado === ESTADOS_GIMNASIO.ACTIVO || gimnasio.estado === ESTADOS_GIMNASIO.TRIAL
  );
}

// --- Acciones con confirmacion ----------------------------------------------

function confirmarSuspension(gimnasio) {
  quasar
    .dialog({
      title: `Suspender ${gimnasio.nombre}`,
      message: 'Su gente no podra entrar al panel hasta que lo reactives.',
      cancel: { flat: true, noCaps: true, label: 'Volver' },
      ok: { color: 'warning', unelevated: true, noCaps: true, label: 'Suspender' },
    })
    .onOk(() => ejecutar(() => plataforma.suspenderGimnasio(gimnasio._id), `${gimnasio.nombre} suspendido`));
}

function confirmarReactivacion(gimnasio) {
  quasar
    .dialog({
      title: `Reactivar ${gimnasio.nombre}`,
      message: 'Su gente vuelve a entrar de inmediato.',
      cancel: { flat: true, noCaps: true, label: 'Volver' },
      ok: { color: 'positive', unelevated: true, noCaps: true, label: 'Reactivar' },
    })
    .onOk(() => ejecutar(() => plataforma.reactivarGimnasio(gimnasio._id), `${gimnasio.nombre} reactivado`));
}

function confirmarCancelacion(gimnasio) {
  quasar
    .dialog({
      title: `Cancelar ${gimnasio.nombre}`,
      message: 'Cancelar es definitivo: no se puede reactivar despues. Sus datos se conservan.',
      cancel: { flat: true, noCaps: true, label: 'Volver' },
      ok: { color: 'negative', unelevated: true, noCaps: true, label: 'Cancelar definitivamente' },
    })
    .onOk(() => ejecutar(() => plataforma.cancelarGimnasio(gimnasio._id), `${gimnasio.nombre} cancelado`));
}

async function ejecutar(accion, mensajeExito) {
  try {
    await accion();
    quasar.notify({ type: 'positive', message: mensajeExito });
  } catch (error) {
    quasar.notify({
      type: 'negative',
      message: error.response?.data?.error?.mensaje ?? 'No se pudo completar la operacion',
    });
  }
}

onMounted(async () => {
  try {
    await plataforma.cargarGimnasios();
  } catch {
    quasar.notify({ type: 'negative', message: 'No se pudieron cargar los gimnasios' });
  }
});
</script>

<style scoped>
/* Las clases del sistema (ceja, discos, chip-banda) viven en css/app.scss. */
.pagina-plataforma {
  max-width: 1100px;
  margin: 0 auto;
}
</style>
