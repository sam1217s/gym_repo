<template>
  <q-page padding class="pagina-panel">
    <div class="row items-end justify-between q-mb-lg">
      <div>
        <div class="ceja">Mi gimnasio</div>
        <h1 class="titulo-display titulo-pagina q-my-none">Planes de membresia</h1>
        <div class="text-caption text-grey-7">Lo que tus miembros pagan y por cuantos meses</div>
      </div>

      <q-btn color="primary" unelevated no-caps icon="add" label="Nuevo plan" @click="abrirCreacion" />
    </div>

    <q-table
      flat
      bordered
      row-key="_id"
      :rows="gimnasio.planesMembresia"
      :columns="COLUMNAS"
      :pagination="{ rowsPerPage: 15 }"
      :hide-bottom="gimnasio.planesMembresia.length <= 15"
      no-data-label="Aun no hay planes. Sin un plan no se pueden registrar pagos."
    >
      <template #body-cell-estado="props">
        <q-td :props="props">
          <span
            class="chip-banda"
            :style="{ '--banda': props.row.activo ? 'var(--q-positive)' : '#667085' }"
          >
            {{ props.row.activo ? 'Activo' : 'Archivado' }}
          </span>
        </q-td>
      </template>

      <template #body-cell-acciones="props">
        <q-td :props="props" class="text-right">
          <q-btn flat dense no-caps size="sm" color="grey-8" label="Editar" @click="abrirEdicion(props.row)" />
          <q-btn
            v-if="props.row.activo"
            flat
            dense
            no-caps
            size="sm"
            color="negative"
            label="Archivar"
            @click="confirmarArchivado(props.row)"
          />
        </q-td>
      </template>
    </q-table>

    <q-dialog v-model="dialogoAbierto">
      <q-card class="tarjeta-plan">
        <q-card-section class="q-pb-sm">
          <div class="text-h6 titulo-display">{{ editando ? 'Editar plan' : 'Nuevo plan' }}</div>
        </q-card-section>

        <q-separator />

        <q-form @submit.prevent="guardar">
          <q-card-section class="q-gutter-y-sm">
            <q-input v-model="formulario.nombre" label="Nombre" outlined dense :rules="[reglaObligatorio]" />
            <div class="row q-col-gutter-md">
              <q-input
                v-model.number="formulario.precio"
                class="col-6"
                type="number"
                label="Precio"
                prefix="$"
                outlined
                dense
                :rules="[reglaPrecio]"
              />
              <q-input
                v-model.number="formulario.duracionMeses"
                class="col-6"
                type="number"
                label="Duracion (meses)"
                hint="1 = mensual, 3 = trimestral"
                outlined
                dense
                :rules="[reglaDuracion]"
              />
            </div>
          </q-card-section>

          <q-separator />

          <q-card-actions align="right" class="q-pa-md">
            <q-btn flat no-caps label="Descartar" :disable="guardando" @click="dialogoAbierto = false" />
            <q-btn
              type="submit"
              color="primary"
              unelevated
              no-caps
              :label="editando ? 'Guardar cambios' : 'Crear plan'"
              :loading="guardando"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { useQuasar } from 'quasar';
import { onMounted, reactive, ref } from 'vue';

import { useGimnasioStore } from 'src/stores/gimnasio.js';

const gimnasio = useGimnasioStore();
const quasar = useQuasar();

const dialogoAbierto = ref(false);
const editando = ref(false);
const guardando = ref(false);
const planActivo = ref(null);

const FORMATO_PESOS = new Intl.NumberFormat('es-CO');

const COLUMNAS = [
  { name: 'nombre', label: 'Plan', field: 'nombre', align: 'left', sortable: true },
  {
    name: 'precio',
    label: 'Precio',
    field: 'precio',
    align: 'right',
    sortable: true,
    format: (valor) => `$${FORMATO_PESOS.format(valor)}`,
    classes: 'cifra-tabular',
  },
  {
    name: 'duracion',
    label: 'Duracion',
    field: 'duracionMeses',
    align: 'right',
    sortable: true,
    format: (valor) => (valor === 1 ? '1 mes' : `${valor} meses`),
    classes: 'cifra-tabular',
  },
  { name: 'estado', label: 'Estado', field: 'activo', align: 'left', sortable: true },
  { name: 'acciones', label: '', field: '_id', align: 'right' },
];

const reglaObligatorio = (valor) => Boolean(String(valor ?? '').trim()) || 'Este campo es obligatorio';
const reglaPrecio = (valor) => (typeof valor === 'number' && valor >= 0) || 'Precio invalido';
const reglaDuracion = (valor) => (Number.isInteger(valor) && valor >= 1) || 'Minimo 1 mes';

const formulario = reactive({ nombre: '', precio: null, duracionMeses: null });

function abrirCreacion() {
  editando.value = false;
  planActivo.value = null;
  Object.assign(formulario, { nombre: '', precio: null, duracionMeses: null });
  dialogoAbierto.value = true;
}

function abrirEdicion(plan) {
  editando.value = true;
  planActivo.value = plan;
  Object.assign(formulario, {
    nombre: plan.nombre,
    precio: plan.precio,
    duracionMeses: plan.duracionMeses,
  });
  dialogoAbierto.value = true;
}

async function guardar() {
  guardando.value = true;
  try {
    const datos = {
      nombre: formulario.nombre,
      precio: formulario.precio,
      duracionMeses: formulario.duracionMeses,
    };

    if (editando.value) {
      await gimnasio.actualizarPlanMembresia(planActivo.value._id, datos);
      quasar.notify({ type: 'positive', message: 'Plan actualizado' });
    } else {
      await gimnasio.crearPlanMembresia(datos);
      quasar.notify({ type: 'positive', message: 'Plan creado' });
    }

    dialogoAbierto.value = false;
  } catch (error) {
    quasar.notify({
      type: 'negative',
      message: error.response?.data?.error?.mensaje ?? 'No se pudo guardar el plan',
    });
  } finally {
    guardando.value = false;
  }
}

function confirmarArchivado(plan) {
  quasar
    .dialog({
      title: `Archivar ${plan.nombre}`,
      message:
        'No se podra usar en pagos nuevos. Los pagos ya registrados con este plan no cambian.',
      cancel: { flat: true, noCaps: true, label: 'Volver' },
      ok: { color: 'negative', unelevated: true, noCaps: true, label: 'Archivar' },
    })
    .onOk(async () => {
      try {
        await gimnasio.archivarPlanMembresia(plan._id);
        quasar.notify({ type: 'positive', message: `${plan.nombre} archivado` });
      } catch (error) {
        quasar.notify({
          type: 'negative',
          message: error.response?.data?.error?.mensaje ?? 'No se pudo archivar el plan',
        });
      }
    });
}

onMounted(async () => {
  try {
    await gimnasio.cargarPlanesMembresia();
  } catch {
    quasar.notify({ type: 'negative', message: 'No se pudieron cargar los planes' });
  }
});
</script>

<style scoped>
.pagina-panel {
  max-width: 1100px;
  margin: 0 auto;
}

.tarjeta-plan {
  width: 100%;
  max-width: 440px;
  border-top: 4px solid var(--q-primary);
}
</style>
