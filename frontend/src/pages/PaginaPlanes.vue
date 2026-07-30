<template>
  <q-page padding class="pagina-panel">
    <div class="row items-end justify-between q-mb-lg">
      <div>
        <div class="ceja">Mi gimnasio</div>
        <h1 class="titulo-display titulo-pagina q-my-none">Planes de membresia</h1>
        <div class="text-caption text-grey-7">
          Cada sede define sus propios planes y precios
        </div>
      </div>

      <q-btn color="primary" unelevated no-caps icon="add" label="Nuevo plan" @click="abrirCreacion" />
    </div>

    <q-table
      flat
      bordered
      row-key="_id"
      :rows="gimnasio.planesMembresia"
      :columns="columnasResponsivas"
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
          <q-btn round flat dense color="grey-8" icon="edit" @click="abrirEdicion(props.row)">
            <q-tooltip>Editar</q-tooltip>
          </q-btn>
          <q-btn
            v-if="props.row.activo"
            round
            flat
            dense
            color="negative"
            icon="archive"
            @click="confirmarArchivado(props.row)"
          >
            <q-tooltip>Archivar</q-tooltip>
          </q-btn>
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
            <!-- La sede se elige al crear y no se mueve despues: los pagos ya
                 registrados con este plan pertenecen a esa sede. -->
            <q-select
              v-if="!editando && sedesVisibles"
              v-model="formulario.sede"
              label="Sede"
              outlined
              dense
              emit-value
              map-options
              :options="opcionesSede"
              :rules="[reglaObligatorio]"
            />

            <q-input v-model="formulario.nombre" label="Nombre" outlined dense :rules="[reglaObligatorio]" />
            <q-input
              v-model.number="formulario.precio"
              type="number"
              label="Precio"
              prefix="$"
              outlined
              dense
              :rules="[reglaPrecio]"
            />
            <div class="row q-col-gutter-md">
              <q-input
                v-model.number="formulario.duracion"
                class="col-6"
                type="number"
                label="Duracion"
                outlined
                dense
                :rules="[reglaDuracion]"
              />
              <q-select
                v-model="formulario.unidad"
                class="col-6"
                label="Unidad"
                outlined
                dense
                emit-value
                map-options
                :options="OPCIONES_UNIDAD"
              />
            </div>
            <div class="text-caption text-grey-7">
              Ej.: 1 mes = mensual · 3 meses = trimestral · 1 día = pase de día · 7 días = semanal
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
import { computed, onMounted, reactive, ref } from 'vue';

import { useColumnasResponsive } from 'src/composables/useColumnasResponsive.js';

import { ROLES, useAutenticacionStore } from 'src/stores/autenticacion.js';
import { useGimnasioStore } from 'src/stores/gimnasio.js';

const gimnasio = useGimnasioStore();
const autenticacion = useAutenticacionStore();
const quasar = useQuasar();

const dialogoAbierto = ref(false);
const editando = ref(false);
const guardando = ref(false);
const planActivo = ref(null);

const FORMATO_PESOS = new Intl.NumberFormat('es-CO');

// El dueno elige sede; al sede_admin se la fuerza el backend, asi no la muestra.
const sedesVisibles = computed(() => autenticacion.usuario?.rol === ROLES.TENANT_OWNER);

function nombreSede(sedeId) {
  return gimnasio.sedes.find((sede) => sede._id === sedeId)?.nombre ?? '—';
}

const opcionesSede = computed(() =>
  gimnasio.sedes.filter((sede) => sede.activa).map((sede) => ({ label: sede.nombre, value: sede._id })),
);

const COLUMNAS = [
  { name: 'nombre', label: 'Plan', field: 'nombre', align: 'left', sortable: true },
  { name: 'sede', label: 'Sede', field: (fila) => nombreSede(fila.sede), align: 'left', sortable: true },
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
    // El backend calcula la descripcion ("1 mes", "1 dia"...) como virtual.
    field: (fila) => fila.descripcionDuracion,
    align: 'right',
    classes: 'cifra-tabular',
  },
  { name: 'estado', label: 'Estado', field: 'activo', align: 'left', sortable: true },
  { name: 'acciones', label: '', field: '_id', align: 'right' },
];

// En movil, la columna de acciones va primero (ver el composable).
const columnasResponsivas = useColumnasResponsive(COLUMNAS);

const OPCIONES_UNIDAD = [
  { label: 'meses', value: 'mes' },
  { label: 'dias', value: 'dia' },
];

const reglaObligatorio = (valor) => Boolean(String(valor ?? '').trim()) || 'Este campo es obligatorio';
const reglaPrecio = (valor) => (typeof valor === 'number' && valor >= 0) || 'Precio invalido';
const reglaDuracion = (valor) => (Number.isInteger(valor) && valor >= 1) || 'Minimo 1';

const formulario = reactive({ nombre: '', precio: null, duracion: null, unidad: 'mes', sede: null });

function abrirCreacion() {
  editando.value = false;
  planActivo.value = null;
  Object.assign(formulario, { nombre: '', precio: null, duracion: null, unidad: 'mes', sede: null });
  dialogoAbierto.value = true;
}

function abrirEdicion(plan) {
  editando.value = true;
  planActivo.value = plan;
  // El plan lleva meses O dias: se descompone en cantidad + unidad para el form.
  const enDias = plan.duracionDias != null;
  Object.assign(formulario, {
    nombre: plan.nombre,
    precio: plan.precio,
    duracion: enDias ? plan.duracionDias : plan.duracionMeses,
    unidad: enDias ? 'dia' : 'mes',
    sede: plan.sede,
  });
  dialogoAbierto.value = true;
}

async function guardar() {
  guardando.value = true;
  try {
    const datos = {
      nombre: formulario.nombre,
      precio: formulario.precio,
      // Se manda una sola unidad de duracion segun lo elegido.
      ...(formulario.unidad === 'dia'
        ? { duracionDias: formulario.duracion }
        : { duracionMeses: formulario.duracion }),
    };

    if (editando.value) {
      // La sede de un plan no se cambia: sus pagos historicos pertenecen a ella.
      await gimnasio.actualizarPlanMembresia(planActivo.value._id, datos);
      quasar.notify({ type: 'positive', message: 'Plan actualizado' });
    } else {
      await gimnasio.crearPlanMembresia({
        ...datos,
        ...(formulario.sede ? { sede: formulario.sede } : {}),
      });
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
    // Las sedes hacen falta para la columna y el selector: cada plan es de una.
    await Promise.all([gimnasio.cargarPlanesMembresia(), gimnasio.cargarSedes()]);
  } catch {
    quasar.notify({ type: 'negative', message: 'No se pudieron cargar los planes' });
  }
});
</script>

<style scoped>
.pagina-panel {
  max-width: 1400px;
  margin: 0 auto;
}

.tarjeta-plan {
  width: 100%;
  max-width: 440px;
  border-top: 4px solid var(--q-primary);
}
</style>
